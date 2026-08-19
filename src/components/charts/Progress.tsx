"use client";

import type { RoundSummary } from "@/store/settings";
import { ticksIn } from "./axis";
import { Figure, HoverZone, Plot, Tooltip, useHover } from "./Plot";

/**
 * One metric across every round you have shot.
 *
 * Deliberately one series at a time. Accuracy, reaction and correction count live on
 * completely different scales, and putting two of them on one plot would need a second
 * y-axis — which lets you draw any relationship you like by choosing the scales, and is
 * the single most misleading thing a chart can do. Switching metric is one click.
 */

const HEIGHT = 220;

export interface Metric {
  id: string;
  label: string;
  unit: string;
  get: (r: RoundSummary) => number;
  format: (v: number) => string;
  /** True when a lower number is the better outcome. */
  lowerIsBetter?: boolean;
}

export const METRICS: Metric[] = [
  {
    id: "accuracy",
    label: "Accuracy",
    unit: "%",
    get: (r) => r.accuracy * 100,
    format: (v) => v.toFixed(1),
  },
  {
    id: "throughput",
    label: "Score",
    unit: "bit/s",
    get: (r) => r.throughput,
    format: (v) => v.toFixed(2),
  },
  {
    id: "reaction",
    label: "Reaction",
    unit: "ms",
    get: (r) => r.reactionMs,
    format: (v) => v.toFixed(0),
    lowerIsBetter: true,
  },
  {
    id: "time",
    label: "Time per target",
    unit: "ms",
    get: (r) => r.timePerTargetMs,
    format: (v) => v.toFixed(0),
    lowerIsBetter: true,
  },
  {
    id: "corrections",
    label: "Corrections",
    unit: "per shot",
    get: (r) => r.corrections,
    format: (v) => v.toFixed(2),
    lowerIsBetter: true,
  },
  {
    id: "cm360",
    label: "Sensitivity",
    unit: "cm/360",
    get: (r) => r.cm360,
    format: (v) => v.toFixed(1),
  },
];

export function Progress({ rounds, metric }: { rounds: RoundSummary[]; metric: Metric }) {
  const hover = useHover<RoundSummary>();

  const pts = rounds.filter((r) => Number.isFinite(metric.get(r)));
  if (pts.length < 2) return null;

  const values = pts.map(metric.get);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.25;
  const domain: [number, number] = [Math.max(0, lo - pad), hi + pad];

  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  const improved = metric.lowerIsBetter ? change < 0 : change > 0;

  return (
    <Figure
      title={`${metric.label} over ${pts.length} rounds`}
      caption={
        Math.abs(change) < 1e-9
          ? "No change yet."
          : `${improved ? "Better" : "Worse"} by ${metric.format(Math.abs(change))} ${metric.unit} since your first round.`
      }
    >
      <Plot
        height={HEIGHT}
        ariaLabel={`${metric.label} across ${pts.length} rounds, latest ${metric.format(last)} ${metric.unit}.`}
        x={{ domain: [0, pts.length - 1], label: "round" }}
        y={{
          domain,
          ticks: ticksIn(domain, 4),
          format: metric.format,
        }}
        margin={{ right: 64, bottom: 32 }}
      >
        {({ px, py, area }) => (
          <>
            <path
              d={values.map((v, i) => `${i ? "L" : "M"}${px(i)},${py(v)}`).join(" ")}
              fill="none"
              stroke="var(--color-accent-9)"
              strokeWidth="2"
            />
            {values.map((v, i) => (
              <g key={pts[i].at}>
                <circle
                  cx={px(i)}
                  cy={py(v)}
                  r="4"
                  fill="var(--color-accent-9)"
                  stroke="var(--color-panel)"
                  strokeWidth="1.5"
                />
                <HoverZone
                  x={px(i) - 14}
                  y={area.top}
                  width={28}
                  height={area.bottom - area.top}
                  onEnter={() => hover.show(i, px(i), py(v), pts[i])}
                  onLeave={hover.hide}
                />
              </g>
            ))}
            <text
              x={px(values.length - 1) + 8}
              y={py(last) + 4}
              fill="var(--color-accent-9)"
              fontSize="11"
              fontWeight="600"
              className="tabular"
            >
              {metric.format(last)}
            </text>
          </>
        )}
      </Plot>

      {hover.hovered && (
        <Tooltip x={hover.hovered.x} y={hover.hovered.y} height={HEIGHT}>
          <div className="tabular text-text">
            {metric.format(metric.get(hover.hovered.datum))} {metric.unit}
          </div>
          <div className="tabular text-text-3">
            {hover.hovered.datum.cm360.toFixed(1)} cm/360 · {hover.hovered.datum.shots} shots
          </div>
        </Tooltip>
      )}
    </Figure>
  );
}
