/**
 * Scenario geometry is copied from the NVIDIA first-person targeting study
 * (Boudaoud & Spjut, IEEE ToG 2023) so our numbers are comparable to a published
 * baseline rather than invented: distances 7-25 deg horizontal with a small vertical
 * component, target angular diameters 0.57-9.15 deg, index of difficulty 0.8-5.5 bits.
 *
 * Distances and widths are *discrete*, not continuous. Effective width has to be
 * estimated from the spread of repeated attempts at the same condition, so every
 * condition needs enough repetitions to have a standard deviation worth trusting.
 */
/**
 * Scenario ids are an explicit union rather than plain strings.
 *
 * Adding a drill now fails to compile until every place that switches on a scenario
 * has been updated — which is the point. A stray `"statik-flick"` used to be a silent
 * lookup miss at runtime.
 */
export type ScenarioId = "static-flick" | "micro-correction";

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  description: string;
  /** Horizontal angular distances to the target, in degrees. */
  distances: number[];
  /** Target angular diameters, in degrees. */
  widths: number[];
  /** Max vertical offset, degrees. Kept small so the task stays a horizontal flick. */
  verticalSpread: number;
  /** Total shots in a session of this scenario. */
  shotCount: number;
  /** Rendered vertical FOV. Part of the experiment's identity — never change silently. */
  fovDeg: number;
  /**
   * Half-extent of the play area, in degrees from straight ahead.
   *
   * Targets spawn at a fixed distance from wherever the crosshair currently is, which
   * on its own is a random walk with no restoring force — a run of same-direction
   * spawns will march the player around in circles forever. Bounding the area gives
   * that walk a wall to bounce off, without touching the distance the shot is supposed
   * to cover.
   */
  areaYawDeg: number;
  areaPitchDeg: number;
}

/*
 * Widths sit at the upper end of the study's range rather than the lower end. At 103°
 * horizontal FOV a 1.15° target is about 13 screen pixels on a 1600px-wide viewport —
 * small enough that the task starts measuring eyesight and display quality rather than
 * aim. These sizes keep the index-of-difficulty sweep the analysis needs while staying
 * comfortably visible; `targetScale` lets a player move them further either way.
 */
export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  "static-flick": {
    id: "static-flick",
    name: "Static Flick",
    description: "Mixed distances and sizes. Start here.",
    distances: [8, 14, 22],
    widths: [2.0, 3.4, 5.6],
    verticalSpread: 2.8,
    shotCount: 72,
    fovDeg: 103,
    areaYawDeg: 34,
    areaPitchDeg: 16,
  },
  "micro-correction": {
    id: "micro-correction",
    name: "Micro Correction",
    description: "Small targets, close range. Harder.",
    distances: [2.5, 4, 6],
    widths: [1.4, 2.4],
    verticalSpread: 1.2,
    shotCount: 60,
    fovDeg: 103,
    areaYawDeg: 20,
    areaPitchDeg: 11,
  },
};

/**
 * Apply a player's target-size preference.
 *
 * The scaled widths become the scenario's real widths, so hit testing, the recorded
 * `targetW`, the index of difficulty and effective width all stay consistent with what
 * was actually on screen. Scaling changes the task, so sessions are only comparable at
 * equal scale — but it never desynchronises the telemetry from reality.
 */
export function scaleScenario(scenario: ScenarioDef, factor: number): ScenarioDef {
  if (factor === 1) return scenario;
  return {
    ...scenario,
    widths: scenario.widths.map((w) => Math.round(w * factor * 100) / 100),
  };
}

export const DEFAULT_SCENARIO: ScenarioId = "static-flick";

/**
 * A branded key so a condition label cannot be confused with any other string, and so
 * the encoding lives in one place instead of being re-split by hand at each use.
 */
export type ConditionKey = string & { readonly __conditionKey: unique symbol };

export function conditionKey(distance: number, width: number): ConditionKey {
  return `${distance}|${width}` as ConditionKey;
}

export function parseConditionKey(key: ConditionKey): { distance: number; width: number } {
  const [distance, width] = key.split("|").map(Number);
  return { distance, width };
}

export interface ShotCondition {
  /** Nominal horizontal distance, degrees. */
  distance: number;
  /** Target angular diameter, degrees. */
  width: number;
  key: ConditionKey;
}

export function conditionsFor(scenario: ScenarioDef): ShotCondition[] {
  const out: ShotCondition[] = [];
  for (const distance of scenario.distances) {
    for (const width of scenario.widths) {
      out.push({ distance, width, key: conditionKey(distance, width) });
    }
  }
  return out;
}

/** Deterministic PRNG so a session can be replayed shot for shot. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Balanced, shuffled condition order.
 *
 * Balanced because throughput needs a minimum number of shots per condition;
 * shuffled because a predictable order lets the player pre-plan the flick, which
 * measures anticipation rather than aim.
 */
export function buildShotOrder(scenario: ScenarioDef, rand: () => number): ShotCondition[] {
  const conditions = conditionsFor(scenario);
  const order: ShotCondition[] = [];
  const reps = Math.ceil(scenario.shotCount / conditions.length);

  for (let r = 0; r < reps; r++) {
    const block = [...conditions];
    for (let i = block.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [block[i], block[j]] = [block[j], block[i]];
    }
    order.push(...block);
  }
  return order.slice(0, scenario.shotCount);
}
