import type { Shot, TraceSample } from "./types";

/* ------------------------------------------------------------------ stats -- */

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n-1). */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/* ------------------------------------------------------- trace analysis -- */

/**
 * Count ballistic submovements as peaks in the angular speed profile.
 *
 * A clean flick is one peak. A flick plus a correction is two. Thresholds are
 * relative to the shot's own peak speed so this is scale-free across sensitivities —
 * which matters, because the whole point is comparing across sensitivities.
 */
export function countSubmovements(trace: TraceSample[]): number {
  if (trace.length < 3) return trace.length ? 1 : 0;
  const peakSpeed = Math.max(...trace.map((s) => s.speed));
  if (peakSpeed <= 0) return 0;

  const rise = peakSpeed * 0.2; // must exceed this to count as a new movement
  const fall = peakSpeed * 0.08; // must drop below this to end the current one

  let count = 0;
  let moving = false;
  for (const s of trace) {
    if (!moving && s.speed >= rise) {
      moving = true;
      count++;
    } else if (moving && s.speed <= fall) {
      moving = false;
    }
  }
  return count;
}

/**
 * Along-axis displacement at the end of the primary (first ballistic) submovement.
 *
 * This is the number the calibration-gain regression is built on: it is the player's
 * open-loop guess at how far to move, taken *before* visual feedback closes the loop.
 */
export function primarySubmovement(trace: TraceSample[]): number {
  if (trace.length === 0) return 0;
  const peakSpeed = Math.max(...trace.map((s) => s.speed));
  if (peakSpeed <= 0) return 0;

  const rise = peakSpeed * 0.2;
  const fall = peakSpeed * 0.08;

  let started = false;
  for (const s of trace) {
    if (!started && s.speed >= rise) started = true;
    else if (started && s.speed <= fall) return s.along;
  }
  // Never decelerated below the floor — the whole shot was one movement.
  return trace[trace.length - 1].along;
}

export function countDirectionReversals(trace: TraceSample[], deadzoneDegPerSec = 15): number {
  let reversals = 0;
  let lastSign = 0;
  for (let i = 1; i < trace.length; i++) {
    const dt = (trace[i].t - trace[i - 1].t) / 1000;
    if (dt <= 0) continue;
    const v = (trace[i].along - trace[i - 1].along) / dt;
    if (Math.abs(v) < deadzoneDegPerSec) continue;
    const sign = Math.sign(v);
    if (lastSign !== 0 && sign !== lastSign) reversals++;
    lastSign = sign;
  }
  return reversals;
}

/* ----------------------------------------------------- Fitts throughput -- */

export interface ThroughputResult {
  /** bits/s. Human mouse throughput in the literature sits around 3.7-4.9 bits/s. */
  throughput: number;
  /** Per-condition breakdown the aggregate was built from. */
  conditions: {
    A: number;
    W: number;
    n: number;
    /** Effective width: 4.133 x SD of endpoint error along the task axis. */
    We: number;
    /** Effective index of difficulty, log2(A/We + 1). */
    IDe: number;
    meanMT: number;
    throughput: number;
  }[];
  /** True if too few shots per condition to trust the number. */
  underpowered: boolean;
}

const MIN_SHOTS_PER_CONDITION = 5;

/**
 * ISO 9241-9 style throughput.
 *
 * Throughput is the objective because it is a *unified* speed-accuracy measure:
 * rushing inflates endpoint spread (and therefore We), being slow and perfect
 * inflates movement time. Neither strategy games the score, which is exactly what
 * we need when comparing two sensitivities.
 *
 * Effective width is computed per (A, W) condition rather than pooled, because
 * pooling conditions of different difficulty inflates the spread for reasons that
 * have nothing to do with the player.
 */
export function computeThroughput(shots: Shot[]): ThroughputResult {
  const groups = new Map<string, Shot[]>();
  for (const s of shots) {
    const g = groups.get(s.conditionKey);
    if (g) g.push(s);
    else groups.set(s.conditionKey, [s]);
  }

  const conditions: ThroughputResult["conditions"] = [];
  let underpowered = false;

  for (const g of groups.values()) {
    if (g.length < MIN_SHOTS_PER_CONDITION) {
      underpowered = true;
      continue;
    }
    const sd = stdDev(g.map((s) => s.endpointAlong));
    if (!Number.isFinite(sd) || sd <= 0) continue;

    const We = 4.133 * sd;
    const A = mean(g.map((s) => s.distanceA));
    const IDe = Math.log2(A / We + 1);
    const meanMT = mean(g.map((s) => (s.clickTs - s.spawnTs) / 1000));
    if (meanMT <= 0) continue;

    conditions.push({
      A,
      W: g[0].targetW,
      n: g.length,
      We,
      IDe,
      meanMT,
      throughput: IDe / meanMT,
    });
  }

  return {
    throughput: conditions.length ? mean(conditions.map((c) => c.throughput)) : NaN,
    conditions,
    underpowered: underpowered || conditions.length === 0,
  };
}

/* ------------------------------------------------- Signal A: calibration -- */

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

/* ------------------------------------------------------ session summary -- */

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
