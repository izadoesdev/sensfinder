import {
  angleBetween,
  clamp,
  decomposeOffset,
  forward,
  offsetDirection,
  scale,
  taskAxis,
  type Vec3,
} from "./math3d";
import {
  buildShotOrder,
  mulberry32,
  type ScenarioDef,
  type ShotCondition,
} from "./scenario";
import type { Shot, TraceSample } from "./types";
import {
  countDirectionReversals,
  countSubmovements,
  primarySubmovement,
} from "./analysis";

export interface EngineConfig {
  sessionId: string;
  blockId: string;
  scenario: ScenarioDef;
  /** Degrees of view rotation per mouse count. The one number that defines "sensitivity" here. */
  degPerCount: number;
  cm360: number;
  /** Shots discarded after a sensitivity change, to skip the re-adaptation transient. */
  transientShots?: number;
  seed?: number;
}

export type EngineState = "idle" | "running" | "finished";

/**
 * Trace cap per shot. At 240 Hz this is ~2.7 s of continuous motion, far longer than
 * any real flick; beyond it the trace is halved by dropping every other sample, which
 * preserves the velocity profile's shape at lower resolution.
 */
const MAX_TRACE_SAMPLES = 640;

interface ActiveShot {
  condition: ShotCondition;
  seq: number;
  spawnTs: number;
  spawnDir: Vec3;
  targetDir: Vec3;
  /** Tangent direction at the spawn point, pointing toward the target. */
  axisAtSpawn: Vec3;
  /** Tangent direction at the target, pointing *away* from spawn, so +along = overshoot. */
  axisAtTarget: Vec3;
  hSign: 1 | -1;
  distanceA: number;
  firstMoveTs: number | null;
  pathLengthDeg: number;
  peakAlong: number;
  trace: TraceSample[];
  lastDir: Vec3;
  lastSampleTs: number;
}

/**
 * The aim engine is deliberately plain TypeScript with no React and no three.js
 * dependency. It owns the camera orientation, target placement, hit testing and
 * per-shot telemetry, which means all of the logic that has to be *correct* can be
 * unit-tested without a WebGL context. React only reads from it.
 */
export class AimEngine {
  readonly config: Required<EngineConfig>;
  readonly scenario: ScenarioDef;

  state: EngineState = "idle";
  yawDeg = 0;
  pitchDeg = 0;
  shots: Shot[] = [];

  private order: ShotCondition[];
  private active: ActiveShot | null = null;
  private pendingDx = 0;
  private pendingDy = 0;
  private nextSeq = 0;
  private shotIdCounter = 0;

  constructor(config: EngineConfig) {
    this.config = {
      transientShots: 6,
      seed: 1,
      ...config,
    };
    this.scenario = config.scenario;
    this.order = buildShotOrder(config.scenario, mulberry32(this.config.seed));
  }

  get targetDir(): Vec3 | null {
    return this.active?.targetDir ?? null;
  }

  get currentWidth(): number {
    return this.active?.condition.width ?? 0;
  }

  /** Sequence number of the in-flight shot, or -1. Lets the renderer detect a new spawn. */
  get activeSeq(): number {
    return this.active?.seq ?? -1;
  }

  /** performance.now() at which the current target appeared, for spawn animations. */
  get activeSpawnTs(): number {
    return this.active?.spawnTs ?? 0;
  }

  get shotsRemaining(): number {
    return Math.max(0, this.scenario.shotCount - this.nextSeq);
  }

  get progress(): number {
    return this.nextSeq / this.scenario.shotCount;
  }

  start(now: number): void {
    if (this.state !== "idle") return;
    this.state = "running";
    this.spawn(now);
  }

  /**
   * Accumulate raw mouse counts. Called from the mousemove listener, possibly many
   * times per frame at high polling rates — every event must be summed, never
   * "latest wins", or counts are silently dropped.
   */
  applyInput(dxCounts: number, dyCounts: number): void {
    this.pendingDx += dxCounts;
    this.pendingDy += dyCounts;
  }

  /** Called once per rendered frame. */
  tick(now: number): void {
    this.flush(now);
  }

  /**
   * Fire.
   *
   * Flushes pending input *first*: a click can arrive between the last frame and
   * this one, and evaluating against a stale camera orientation would throw away
   * real mouse movement and bias the endpoint error.
   *
   * Every click ends the shot, hit or miss. Endpoint spread including misses is
   * precisely what effective width is defined over — discarding misses would make
   * the accuracy half of throughput meaningless.
   */
  fire(now: number): Shot | null {
    if (this.state !== "running" || !this.active) return null;
    this.flush(now);

    const a = this.active;
    const dir = forward(this.yawDeg, this.pitchDeg);
    const angularError = angleBetween(dir, a.targetDir);
    const hit = angularError <= a.condition.width / 2;

    const endpoint = decomposeOffset(a.targetDir, a.axisAtTarget, dir);

    const shot: Shot = {
      id: `${this.config.sessionId}-${this.shotIdCounter++}`,
      sessionId: this.config.sessionId,
      blockId: this.config.blockId,
      scenarioId: this.scenario.id,
      seq: a.seq,
      isPostSwitchTransient: a.seq < this.config.transientShots,

      degPerCount: this.config.degPerCount,
      cm360: this.config.cm360,

      spawnTs: a.spawnTs,
      firstMoveTs: a.firstMoveTs,
      clickTs: now,
      hit,

      distanceA: a.distanceA,
      targetW: a.condition.width,
      indexOfDifficulty: Math.log2(a.distanceA / a.condition.width + 1),
      conditionKey: a.condition.key,

      endpointAlong: endpoint.along,
      endpointPerp: endpoint.perp,
      horizontalSign: a.hSign,

      pathLengthDeg: a.pathLengthDeg,
      overshootRatio: a.distanceA > 0 ? a.peakAlong / a.distanceA : 0,
      primarySubmovementDeg: primarySubmovement(a.trace),
      submovementCount: countSubmovements(a.trace),
      directionReversals: countDirectionReversals(a.trace),

      trace: a.trace,
    };

    this.shots.push(shot);
    this.active = null;

    if (this.nextSeq >= this.scenario.shotCount) this.state = "finished";
    else this.spawn(now);

    return shot;
  }

  /**
   * Throw away the in-flight shot and re-issue the same condition.
   *
   * Needed whenever the player loses pointer lock mid-shot: movement time is measured
   * from spawn, so a shot interrupted by an alt-tab would record a multi-second
   * "flick" and quietly poison the block it belongs to.
   */
  restartActiveShot(now: number): void {
    if (this.state !== "running" || !this.active) return;
    this.nextSeq--;
    this.active = null;
    this.pendingDx = 0;
    this.pendingDy = 0;
    this.spawn(now);
  }

  /* ------------------------------------------------------------ internals -- */

  /**
   * Which side to put the next target on.
   *
   * Free choice while both sides fit; forced inward once one side would leave the
   * area. Reflecting at the boundary this way keeps the player roughly centred over a
   * session without ever changing the distance the shot has to cover.
   */
  private horizontalSign(rand: () => number): number {
    const limit = this.scenario.areaYawDeg;
    const d = this.order[this.nextSeq].distance;
    // Camera yaw decreases as the view moves right, so a target to the right sits at
    // yaw - d.
    const rightFits = Math.abs(this.yawDeg - d) <= limit;
    const leftFits = Math.abs(this.yawDeg + d) <= limit;

    if (rightFits && leftFits) return rand() < 0.5 ? -1 : 1;
    if (rightFits) return 1;
    if (leftFits) return -1;
    // Neither fits (area narrower than the distance): head back toward the middle.
    return this.yawDeg > 0 ? 1 : -1;
  }

  private verticalOffset(rand: () => number): number {
    const spread = this.scenario.verticalSpread;
    const limit = this.scenario.areaPitchDeg;
    const raw = (rand() * 2 - 1) * spread;
    // Pitch increases upward, and a positive bearing puts the target higher.
    const resulting = this.pitchDeg + raw;
    if (Math.abs(resulting) <= limit) return raw;
    return clamp(limit * Math.sign(resulting) - this.pitchDeg, -spread, spread);
  }

  private flush(now: number): void {
    const dx = this.pendingDx;
    const dy = this.pendingDy;
    this.pendingDx = 0;
    this.pendingDy = 0;

    // Raw counts to degrees. No smoothing, no acceleration, no per-frame clamping —
    // any of those would make the measured sensitivity differ from the stated one.
    this.yawDeg -= dx * this.config.degPerCount;
    this.pitchDeg = clamp(this.pitchDeg - dy * this.config.degPerCount, -89, 89);

    const a = this.active;
    if (!a) return;

    const dir = forward(this.yawDeg, this.pitchDeg);
    const delta = angleBetween(a.lastDir, dir);
    const dtSec = Math.max(1e-4, (now - a.lastSampleTs) / 1000);

    a.pathLengthDeg += delta;
    if (a.firstMoveTs === null && a.pathLengthDeg > 0.2) a.firstMoveTs = now;

    const { along, perp } = decomposeOffset(a.spawnDir, a.axisAtSpawn, dir);
    if (along > a.peakAlong) a.peakAlong = along;

    a.trace.push({ t: now - a.spawnTs, along, perp, speed: delta / dtSec });
    a.lastDir = dir;
    a.lastSampleTs = now;

    // Path length, peak displacement and first-move time above are accumulated every
    // frame and stay exact. Only the stored trace is bounded: submovement detection
    // needs the *shape* of the velocity profile, not every frame of a shot that ran
    // long, and an unbounded array on a paused or fumbled shot is pure memory waste.
    if (a.trace.length > MAX_TRACE_SAMPLES) {
      for (let i = 1; i < a.trace.length; i += 2) a.trace[(i - 1) / 2] = a.trace[i];
      a.trace.length = a.trace.length >> 1;
    }
  }

  private spawn(now: number): void {
    const condition = this.order[this.nextSeq];
    if (!condition) {
      this.state = "finished";
      return;
    }

    const rand = mulberry32(this.config.seed * 7919 + this.nextSeq);
    const spawnDir = forward(this.yawDeg, this.pitchDeg);

    // Horizontal distance is the condition; a small vertical jitter stops the task
    // from collapsing into a pure 1-D slider that can be learned as a motor pattern.
    //
    // The *sign* is chosen to keep the target inside the play area rather than at
    // random. Distance is what the experiment controls, direction is free, so steering
    // direction costs the measurement nothing and stops the player being walked in
    // circles by a run of same-side spawns.
    const hSign = this.horizontalSign(rand);
    const horizontal = condition.distance * hSign;
    const vertical = this.verticalOffset(rand);
    const distanceA = Math.hypot(horizontal, vertical);
    const bearing = Math.atan2(vertical, horizontal);

    const targetDir = offsetDirection(spawnDir, distanceA, bearing);
    const axisAtSpawn = taskAxis(spawnDir, targetDir);
    const axisAtTarget = scale(taskAxis(targetDir, spawnDir), -1);

    this.active = {
      condition,
      seq: this.nextSeq,
      spawnTs: now,
      spawnDir,
      targetDir,
      axisAtSpawn,
      axisAtTarget,
      distanceA,
      hSign: hSign > 0 ? 1 : -1,
      firstMoveTs: null,
      pathLengthDeg: 0,
      peakAlong: 0,
      trace: [],
      lastDir: spawnDir,
      lastSampleTs: now,
    };
    this.nextSeq++;
  }
}
