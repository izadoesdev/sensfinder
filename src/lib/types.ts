import type { ConditionKey, ScenarioId } from "./scenario";

/**
 * The data model is the product. Everything logged here is chosen because some
 * downstream statistic needs it — if you drop a field you cannot go back and
 * re-collect it from users who already trained.
 */

/** One frame of accumulated input, in the tangent plane of the shot. */
export interface TraceSample {
  /** ms since shot spawn */
  t: number;
  /** signed angular displacement from the spawn crosshair position, along the task axis (deg) */
  along: number;
  /** signed angular displacement perpendicular to the task axis (deg) */
  perp: number;
  /** angular speed this frame (deg/s) */
  speed: number;
}

export interface Shot {
  id: string;
  sessionId: string;
  /** Which sensitivity arm this shot belongs to. One block = one sens. */
  blockId: string;
  scenarioId: ScenarioId;
  /** Index within the block — lets us model warm-up and fatigue drift. */
  seq: number;
  /**
   * True for the first few shots after a sensitivity change. Visuomotor
   * re-adaptation makes these unrepresentative; they are excluded from fits
   * but kept, because the size of the transient is itself a useful metric.
   */
  isPostSwitchTransient: boolean;

  // --- the sensitivity under test ---
  degPerCount: number;
  cm360: number;

  // --- timing (all performance.now(), sub-ms) ---
  spawnTs: number;
  /** First frame with meaningful movement — reaction time = firstMoveTs - spawnTs. */
  firstMoveTs: number | null;
  clickTs: number;
  hit: boolean;

  // --- Fitts task geometry (degrees) ---
  /** Angular distance from crosshair to target centre at spawn. */
  distanceA: number;
  /** Angular diameter of the target. */
  targetW: number;
  /** log2(A/W + 1), Shannon form. */
  indexOfDifficulty: number;
  /**
   * Nominal (distance, width) condition label. Effective width must be computed
   * within a condition, and the *realised* A varies slightly shot to shot because
   * of the vertical jitter — so grouping uses this label, not the realised numbers.
   */
  conditionKey: ConditionKey;

  // --- endpoint (degrees, signed, relative to target centre) ---
  /** Along the task axis. Positive = overshoot, negative = undershoot. */
  endpointAlong: number;
  /** Perpendicular to the task axis. Positive = high, negative = low. */
  endpointPerp: number;
  /**
   * Which way the flick went: +1 for a target to the right, -1 to the left.
   *
   * Endpoint error is measured along the task axis, so an overshoot reads positive
   * whichever way you turned — which hides the most common asymmetry in aim, where a
   * player overshoots one direction and undershoots the other.
   */
  horizontalSign: 1 | -1;

  // --- movement quality ---
  /** Total angular path travelled. Efficiency = distanceA / pathLengthDeg. */
  pathLengthDeg: number;
  /** Peak displacement along the task axis, divided by A. >1 means the flick went past. */
  overshootRatio: number;
  /**
   * Along-axis displacement at the end of the first ballistic submovement, before any
   * correction. This is the open-loop output of the player's internal model, and it is
   * the entire basis of the calibration-gain estimate.
   */
  primarySubmovementDeg: number;
  /** Velocity-profile peaks: 1 = one clean ballistic flick, 3 = flick plus two corrections. */
  submovementCount: number;
  /** Sign changes of along-axis velocity. Reversals are the slowest kind of correction. */
  directionReversals: number;

  trace: TraceSample[];
}

export interface Session {
  id: string;
  startedAt: number;
  scenarioId: ScenarioId;
  gameId: string;
  dpi: number;
  /** Rendered vertical FOV. Part of the experiment's identity — changing it invalidates history. */
  fovDeg: number;
  shots: Shot[];
}
