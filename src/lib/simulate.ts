import { AimEngine } from "./aimEngine";
import {
  alongAxis,
  angleBetween,
  forward,
  taskAxis,
  yawPitchFromForward,
  type Vec3,
} from "./math3d";
import { mulberry32, type ScenarioDef } from "./scenario";
import type { Shot } from "./types";

/**
 * A scripted player with a known, deliberately injected calibration bias.
 *
 * This drives the *real* engine at realistic frame timings rather than fabricating
 * `Shot` objects, so anything built on its output — the analysis, the charts, the
 * report layout — is exercising the same code path a human session would.
 *
 * The test suite uses it to prove the pipeline recovers a bias it was given; the
 * preview route uses it to render a full report without shooting 72 targets by hand.
 */
export interface SimOptions {
  scenario: ScenarioDef;
  degPerCount: number;
  cm360: number;
  /** 1.12 = the player consistently flicks 12% too far. */
  gain: number;
  /** Motor noise, in degrees, on both the ballistic and corrective phases. */
  noiseDeg: number;
  seed?: number;
  frameMs?: number;
}

const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export function simulateSession(opts: SimOptions): AimEngine {
  const { scenario, degPerCount, cm360, gain, noiseDeg } = opts;
  const frameMs = opts.frameMs ?? 8;

  const engine = new AimEngine({
    sessionId: `sim-${opts.seed ?? 7}`,
    blockId: `sim-${cm360.toFixed(2)}`,
    scenario,
    degPerCount,
    cm360,
    seed: opts.seed ?? 7,
  });

  const rand = mulberry32((opts.seed ?? 7) * 31 + 99);
  let t = 0;

  const moveTo = (dir: Vec3, steps: number) => {
    const { yawDeg, pitchDeg } = yawPitchFromForward(dir);
    const dYaw = wrap(yawDeg - engine.yawDeg) / steps;
    const dPitch = (pitchDeg - engine.pitchDeg) / steps;
    for (let i = 0; i < steps; i++) {
      // yaw -= dx * degPerCount, so dx = -dYaw / degPerCount
      engine.applyInput(-dYaw / degPerCount, -dPitch / degPerCount);
      t += frameMs;
      engine.tick(t);
    }
  };

  const dwell = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      t += frameMs;
      engine.tick(t);
    }
  };

  engine.start(t);

  while (engine.state === "running") {
    const spawn = forward(engine.yawDeg, engine.pitchDeg);
    const target = engine.targetDir!;
    const axis = taskAxis(spawn, target);
    const A = angleBetween(spawn, target);

    // Ballistic phase: land at gain x A, plus motor noise.
    moveTo(alongAxis(spawn, axis, A * gain + (rand() * 2 - 1) * noiseDeg), 8);
    // Hold still so the submovement detector can see the ballistic phase end.
    dwell(6);
    // Corrective phase: close most, but not all, of the remaining gap.
    moveTo(alongAxis(spawn, axis, A + (rand() * 2 - 1) * noiseDeg * 0.4), 4);

    engine.fire((t += frameMs));
    t += 200; // inter-shot pause
  }

  return engine;
}

export function simulateShots(opts: SimOptions): Shot[] {
  return simulateSession(opts).shots;
}
