/** Shared chart helpers. Every chart previously carried its own copy of this. */

/** Round tick values at 1/2/2.5/5 x 10^n intervals, from 0 up to `max`. */
export function niceTicks(max: number, count: number): number[] {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Positions a tooltip over a chart, given SVG-space coordinates and the viewBox. */
export function tooltipStyle(
  x: number,
  y: number,
  viewW: number,
  viewH: number,
): React.CSSProperties {
  return { left: `${(x / viewW) * 100}%`, top: `${(y / viewH) * 100}%` };
}

export const TOOLTIP_CLASS =
  "pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md " +
  "border border-border bg-raised px-2.5 py-1.5 text-xs shadow-lg";
