import { expect, test, describe } from "bun:test";
import { AimEngine } from "./aimEngine";
import { SCENARIOS, conditionsFor, parseConditionKey } from "./scenario";
import { simulateSession as simulate } from "./simulate";
import { cm360, degPerCount, degPerCountFromCm360 } from "./sens";
import {
  alongAxis,
  angleBetween,
  forward,
  taskAxis,
  yawPitchFromForward,
  type Vec3,
} from "./math3d";
import { calibrationGain, computeThroughput, summarise } from "./analysis";

const DPI = 800;
const SENS = 0.4;
const CM360 = cm360("valorant", SENS, DPI);
const DPC = degPerCount("valorant", SENS);

function makeEngine(seed = 42) {
  return new AimEngine({
    sessionId: "test",
    blockId: "b0",
    scenario: SCENARIOS["static-flick"],
    degPerCount: DPC,
    cm360: CM360,
    seed,
  });
}

const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** Feed the engine the mouse counts required to land the crosshair on `dir`. */
function moveTo(engine: AimEngine, dir: Vec3, steps: number, t: number, dtMs = 8): number {
  const { yawDeg, pitchDeg } = yawPitchFromForward(dir);
  const dYaw = wrap(yawDeg - engine.yawDeg) / steps;
  const dPitch = (pitchDeg - engine.pitchDeg) / steps;
  for (let i = 0; i < steps; i++) {
    // yaw -= dx * degPerCount, so dx = -dYaw / degPerCount
    engine.applyInput(-dYaw / DPC, -dPitch / DPC);
    t += dtMs;
    engine.tick(t);
  }
  return t;
}

/** Hold still, so the submovement detector sees the ballistic phase end. */
function dwell(engine: AimEngine, t: number, frames = 6, dtMs = 8): number {
  for (let i = 0; i < frames; i++) {
    t += dtMs;
    engine.tick(t);
  }
  return t;
}

describe("sensitivity is physically what it claims to be", () => {
  test("moving cm/360 centimetres of mouse produces exactly 360 degrees", () => {
    const engine = makeEngine();
    engine.start(0);
    const startYaw = engine.yawDeg;

    // Physical travel of CM360 centimetres at DPI counts per inch.
    const counts = (DPI * CM360) / 2.54;
    engine.applyInput(counts, 0);
    engine.tick(16);

    expect(startYaw - engine.yawDeg).toBeCloseTo(360, 6);
  });

  test("a 40 cm/360 setting needs 20 cm of travel for a 180", () => {
    const dpc = degPerCountFromCm360(40, DPI);
    const engine = new AimEngine({
      sessionId: "t",
      blockId: "b",
      scenario: SCENARIOS["static-flick"],
      degPerCount: dpc,
      cm360: 40,
    });
    engine.start(0);
    engine.applyInput((DPI * 20) / 2.54, 0);
    engine.tick(16);
    expect(-engine.yawDeg).toBeCloseTo(180, 6);
  });
});

describe("shot lifecycle", () => {
  test("a perfect flick is a hit with near-zero endpoint error", () => {
    const engine = makeEngine();
    engine.start(0);
    const target = engine.targetDir!;

    const t = moveTo(engine, target, 10, 0);
    const shot = engine.fire(t + 8)!;

    expect(shot.hit).toBe(true);
    expect(Math.abs(shot.endpointAlong)).toBeLessThan(1e-6);
    expect(Math.abs(shot.endpointPerp)).toBeLessThan(1e-6);
    expect(shot.distanceA).toBeGreaterThan(0);
    expect(shot.indexOfDifficulty).toBeCloseTo(
      Math.log2(shot.distanceA / shot.targetW + 1),
      10,
    );
  });

  test("stopping short is recorded as a miss with negative endpoint error", () => {
    const engine = makeEngine();
    engine.start(0);
    const spawn = forward(engine.yawDeg, engine.pitchDeg);
    const target = engine.targetDir!;
    const axis = taskAxis(spawn, target);
    const A = angleBetween(spawn, target);

    // Land 3 degrees short — well outside any target width in this scenario.
    const t = moveTo(engine, alongAxis(spawn, axis, A - 3), 10, 0);
    const shot = engine.fire(t + 8)!;

    expect(shot.hit).toBe(false);
    expect(shot.endpointAlong).toBeCloseTo(-3, 4);
  });

  test("misses still end the shot and are still recorded", () => {
    const engine = makeEngine();
    engine.start(0);
    const t = moveTo(engine, forward(engine.yawDeg + 40, 0), 5, 0);
    engine.fire(t + 8);
    expect(engine.shots).toHaveLength(1);
    expect(engine.shots[0].hit).toBe(false);
  });

  test("a flick that overshoots then corrects logs two submovements and a reversal", () => {
    const engine = makeEngine();
    engine.start(0);
    const spawn = forward(engine.yawDeg, engine.pitchDeg);
    const target = engine.targetDir!;
    const axis = taskAxis(spawn, target);
    const A = angleBetween(spawn, target);

    let t = moveTo(engine, alongAxis(spawn, axis, A * 1.25), 8, 0);
    t = dwell(engine, t);
    t = moveTo(engine, target, 4, t);
    const shot = engine.fire(t + 8)!;

    expect(shot.hit).toBe(true);
    expect(shot.submovementCount).toBe(2);
    expect(shot.directionReversals).toBeGreaterThanOrEqual(1);
    expect(shot.overshootRatio).toBeCloseTo(1.25, 2);
    expect(shot.primarySubmovementDeg).toBeCloseTo(A * 1.25, 2);
    // Path is longer than the straight-line distance because of the correction.
    expect(shot.pathLengthDeg).toBeGreaterThan(A);
  });

  test("input arriving between the last frame and the click is not lost", () => {
    const engine = makeEngine();
    engine.start(0);
    const target = engine.targetDir!;
    const { yawDeg, pitchDeg } = yawPitchFromForward(target);

    // Queue the entire flick as raw counts, then fire without ever calling tick().
    engine.applyInput(-wrap(yawDeg - engine.yawDeg) / DPC, -(pitchDeg - engine.pitchDeg) / DPC);
    const shot = engine.fire(20)!;

    expect(shot.hit).toBe(true);
  });

  test("the session ends after exactly shotCount shots", () => {
    const engine = makeEngine();
    engine.start(0);
    let t = 0;
    for (let i = 0; i < SCENARIOS["static-flick"].shotCount; i++) {
      t = moveTo(engine, engine.targetDir!, 6, t);
      engine.fire((t += 8));
    }
    expect(engine.state).toBe("finished");
    expect(engine.shots).toHaveLength(SCENARIOS["static-flick"].shotCount);
    expect(engine.fire(t + 100)).toBeNull();
  });

  test("the first shots of a block are flagged as re-adaptation transients", () => {
    const engine = makeEngine();
    engine.start(0);
    let t = 0;
    for (let i = 0; i < 10; i++) {
      t = moveTo(engine, engine.targetDir!, 6, t);
      engine.fire((t += 8));
    }
    expect(engine.shots.filter((s) => s.isPostSwitchTransient)).toHaveLength(6);
    expect(engine.shots[6].isPostSwitchTransient).toBe(false);
  });
});

describe("play area", () => {
  /**
   * Without a bound, spawning at a fixed distance in a random direction is a random
   * walk: a run of same-side spawns marches the player around in circles with nothing
   * pulling them back. This is the test that would have caught that.
   */
  test("a perfect player never leaves the play area over a full session", () => {
    const scenario = SCENARIOS["static-flick"];
    const engine = makeEngine(3);
    engine.start(0);

    let t = 0;
    let maxYaw = 0;
    let maxPitch = 0;

    while (engine.state === "running") {
      t = moveTo(engine, engine.targetDir!, 6, t);
      maxYaw = Math.max(maxYaw, Math.abs(engine.yawDeg));
      maxPitch = Math.max(maxPitch, Math.abs(engine.pitchDeg));
      engine.fire((t += 8));
    }

    expect(maxYaw).toBeLessThanOrEqual(scenario.areaYawDeg + 0.001);
    expect(maxPitch).toBeLessThanOrEqual(scenario.areaPitchDeg + 0.001);
  });

  test("targets still land at exactly the condition distance at the boundary", () => {
    const engine = makeEngine(5);
    engine.start(0);

    // Drive hard to one edge, then confirm distances are untouched by the steering.
    let t = 0;
    for (let i = 0; i < 30; i++) {
      t = moveTo(engine, engine.targetDir!, 6, t);
      engine.fire((t += 8));
    }

    for (const shot of engine.shots) {
      const nominal = parseConditionKey(shot.conditionKey).distance;
      // Realised distance is the nominal horizontal leg plus the vertical jitter.
      expect(shot.distanceA).toBeGreaterThanOrEqual(nominal - 1e-9);
      expect(shot.distanceA).toBeLessThanOrEqual(
        Math.hypot(nominal, SCENARIOS["static-flick"].verticalSpread) + 1e-9,
      );
    }
  });
});

/**
 * A simulated player with a known, deliberately injected calibration bias.
 * If the pipeline cannot recover a bias we put in on purpose, it certainly cannot
 * be trusted to find one that is really there.
 *
 * This is the same simulator the `/preview` design harness runs on, so the report
 * layout is always being iterated against output these assertions cover.
 */
function simulateSession(opts: { gain: number; noiseDeg: number; seed?: number }) {
  return simulate({
    scenario: SCENARIOS["static-flick"],
    degPerCount: DPC,
    cm360: CM360,
    gain: opts.gain,
    noiseDeg: opts.noiseDeg,
    seed: opts.seed ?? 7,
  });
}

describe("calibration gain recovery", () => {
  test("recovers a 12% injected overshoot", () => {
    const engine = simulateSession({ gain: 1.12, noiseDeg: 0.3 });
    const g = calibrationGain(engine.shots)!;

    expect(g).not.toBeNull();
    expect(g.gain).toBeCloseTo(1.12, 2);
    expect(g.ci95[0]).toBeLessThan(1.12);
    expect(g.ci95[1]).toBeGreaterThan(1.12);
    expect(g.inconclusive).toBe(false); // 1.0 is outside the CI
    expect(g.r2).toBeGreaterThan(0.95);
  });

  test("recovers an 8% injected undershoot", () => {
    const g = calibrationGain(simulateSession({ gain: 0.92, noiseDeg: 0.3 }).shots)!;
    expect(g.gain).toBeCloseTo(0.92, 2);
    expect(g.inconclusive).toBe(false);
  });

  test("reports inconclusive when the player has no systematic bias", () => {
    const g = calibrationGain(simulateSession({ gain: 1.0, noiseDeg: 0.5 }).shots)!;
    expect(g.gain).toBeCloseTo(1.0, 1);
    expect(g.inconclusive).toBe(true);
  });

  test("an overshooting player is told to slow down (higher cm/360)", () => {
    const g = calibrationGain(simulateSession({ gain: 1.12, noiseDeg: 0.3 }).shots)!;
    expect(CM360 * g.gain).toBeGreaterThan(CM360);
  });
});

describe("throughput", () => {
  test("lands in the range human mouse studies report (3.7-4.9 bits/s)", () => {
    const engine = simulateSession({ gain: 1.05, noiseDeg: 0.4 });
    const tp = computeThroughput(engine.shots.filter((s) => !s.isPostSwitchTransient));

    expect(tp.underpowered).toBe(false);
    // Derived, not hardcoded: the scenario owns how many conditions there are, and a
    // literal here silently became wrong the moment the drill dropped to one width.
    expect(tp.conditions.length).toBe(conditionsFor(SCENARIOS["static-flick"]).length);
    expect(Number.isFinite(tp.throughput)).toBe(true);
    expect(tp.throughput).toBeGreaterThan(1);
  });

  test("every condition gets enough repetitions to estimate effective width", () => {
    const engine = simulateSession({ gain: 1.0, noiseDeg: 0.4 });
    const tp = computeThroughput(engine.shots.filter((s) => !s.isPostSwitchTransient));
    for (const c of tp.conditions) expect(c.n).toBeGreaterThanOrEqual(5);
  });

  test("summarise produces a complete report", () => {
    const s = summarise(simulateSession({ gain: 1.08, noiseDeg: 0.35 }).shots);
    expect(s.shots).toBe(SCENARIOS["static-flick"].shotCount - 6);
    expect(s.accuracy).toBeGreaterThan(0.5);
    expect(s.gain!.gain).toBeCloseTo(1.08, 2);
    expect(s.meanSubmovements).toBeGreaterThan(1);
    expect(s.medianEfficiency).toBeLessThanOrEqual(1);
  });
});
