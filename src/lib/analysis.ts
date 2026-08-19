import { calibrationGain, type CalibrationGain } from "./calibration";
import { computeThroughput, type ThroughputResult } from "./fitts";
import { mean, median } from "./stats";
import type { Shot } from "./types";

/**
 * The one thing that reads a whole session at once.
 *
 * Everything it composes lives in its own module — `stats`, `submovements`, `fitts`,
 * `calibration`, `profile` — because they are independent and were only ever together
 * by accident of having been written in one sitting. Splitting them means the engine
 * can import submovement detection without dragging in throughput, and a change to the
 * gain regression cannot quietly alter what a chart of effective width shows.
 */


export interface SessionSummary {
  shots: number;
  hits: number;
  accuracy: number;
  medianTimeToHit: number;
  medianReactionTime: number;
  throughput: ThroughputResult;
  gain: CalibrationGain | null;
  meanSubmovements: number;
  overshootRate: number;
  medianEfficiency: number;
}

export function summarise(shots: Shot[]): SessionSummary {
  const scored = shots.filter((s) => !s.isPostSwitchTransient);
  const hits = scored.filter((s) => s.hit);
  const reactions = scored
    .filter((s) => s.firstMoveTs !== null)
    .map((s) => s.firstMoveTs! - s.spawnTs);

  return {
    shots: scored.length,
    hits: hits.length,
    accuracy: scored.length ? hits.length / scored.length : 0,
    medianTimeToHit: median(scored.map((s) => s.clickTs - s.spawnTs)),
    medianReactionTime: median(reactions),
    throughput: computeThroughput(scored),
    gain: calibrationGain(scored),
    meanSubmovements: mean(scored.map((s) => s.submovementCount)),
    overshootRate: scored.length
      ? scored.filter((s) => s.overshootRatio > 1).length / scored.length
      : 0,
    medianEfficiency: median(
      scored.filter((s) => s.pathLengthDeg > 0).map((s) => s.distanceA / s.pathLengthDeg),
    ),
  };
}
