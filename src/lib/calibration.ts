import type { Shot } from "./types";


export interface CalibrationGain {
  /**
   * Slope of primary-submovement displacement against required distance, through
   * the origin. g = 1.05 means the player consistently flicks 5% too far.
   */
  gain: number;
  /** Standard error of the slope. */
  stdErr: number;
  /** 95% CI on the gain. */
  ci95: [number, number];
  r2: number;
  n: number;
  /** True when the CI straddles 1.0 — i.e. no detectable systematic bias. */
  inconclusive: boolean;
}

/**
 * Regression through the origin: primary = g x A.
 *
 * Through the origin rather than with an intercept because a gain is exactly what
 * we are estimating — a proportional mis-scaling between the player's internal
 * model and the sensitivity they are actually playing on. An intercept term would
 * absorb part of that gain and bias the estimate toward 1.
 */
export function calibrationGain(shots: Shot[]): CalibrationGain | null {
  const pts = shots
    .filter((s) => !s.isPostSwitchTransient && s.distanceA > 0)
    .map((s) => ({ x: s.distanceA, y: s.primarySubmovementDeg }))
    // Guard against shots where tracking failed or the player did something wild.
    .filter((p) => Number.isFinite(p.y) && p.y > 0 && p.y < p.x * 3);

  const n = pts.length;
  if (n < 10) return null;

  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  if (sxx === 0) return null;

  const gain = sxy / sxx;

  const residualSS = pts.reduce((a, p) => a + (p.y - gain * p.x) ** 2, 0);
  const totalSS = pts.reduce((a, p) => a + p.y * p.y, 0); // uncentred, matches no-intercept model
  const r2 = totalSS > 0 ? 1 - residualSS / totalSS : 0;

  const sigma2 = residualSS / (n - 1);
  const stdErr = Math.sqrt(sigma2 / sxx);
  const ci95: [number, number] = [gain - 1.96 * stdErr, gain + 1.96 * stdErr];

  return {
    gain,
    stdErr,
    ci95,
    r2,
    n,
    inconclusive: ci95[0] <= 1 && ci95[1] >= 1,
  };
}

/**
 * The sensitivity the player's muscle memory is already calibrated to.
 *
 * If they overshoot by 5% (gain 1.05), the same hand movement needs to produce 5%
 * less rotation to land on target — a lower degrees-per-count, which is a *higher*
 * cm/360. Hence cm360_calibrated = cm360_current x gain.
 *
 * Note this is explicitly NOT a performance claim. It is the setting that will feel
 * immediately correct, which is a different question from where throughput peaks.
 */
export function calibratedCm360(currentCm360: number, gain: number): number {
  return currentCm360 * gain;
}

