import type { TraceSample } from "./types";


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

