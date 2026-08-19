/** Round tick values at 1/2/2.5/5 x 10^n intervals, from 0 up to `max`. */
export function niceTicks(max: number, count: number): number[] {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/**
 * Ticks spanning an arbitrary domain.
 *
 * `niceTicks` walks up from zero, which is right for a bar chart anchored at the
 * baseline and useless for a trend whose values sit in a narrow band far from it —
 * accuracy between 68% and 82% got exactly one gridline.
 */
export function ticksIn([lo, hi]: [number, number], count: number): number[] {
  const raw = (hi - lo) / count;
  if (!Number.isFinite(raw) || raw <= 0) return [lo];
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;

  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    out.push(Math.round(v * 1000) / 1000);
  }
  return out;
}

/** Symmetric ticks either side of zero, for charts centred on a reference value. */
export function symmetricTicks(bound: number, steps = 2): number[] {
  const out: number[] = [];
  for (let i = -steps; i <= steps; i++) out.push((bound / steps) * i);
  return out;
}
