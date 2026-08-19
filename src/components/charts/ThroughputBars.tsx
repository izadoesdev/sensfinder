"use client";

import type { ThroughputResult } from "@/lib/analysis";
import { niceTicks } from "./axis";
import { Figure, HoverZone, Plot, Tooltip, useHover } from "./Plot";

/**
 * Score by shot difficulty — one series, so one hue and no legend.
 *
 * This is the chart that will eventually carry the per-regime recommendation: the
 * published research found the best sensitivity shifts with index of difficulty, so a
 * slope across these bars is signal, not noise.
 *
 * Only the highest bar is direct-labelled. A number over every bar turns a comparison
 * into a table, and there is a real table one click away for that.
 */

const HEIGHT = 300;
const GAP = 2;

type Condition = ThroughputResult["conditions"][number];

export function ThroughputBars({ data }: { data: ThroughputResult }) {
  const hover = useHover<Condition>();

  const bars = [...data.conditions].sort((a, b) => a.IDe - b.IDe);
  if (bars.length < 2) return null;

  const max = Math.max(...bars.map((b) => b.throughput)) * 1.15;
  const best = bars.reduce((a, b) => (b.throughput > a.throughput ? b : a));

  return (
    <Figure
      title="Score by shot difficulty"
      caption="Easiest shots on the left, hardest on the right."
    >
      <Plot
        height={HEIGHT}
        ariaLabel={`Throughput across ${bars.length} difficulty conditions, peak ${best.throughput.toFixed(2)} bits per second.`}
        x={{ domain: [0, bars.length], label: "harder to the right" }}
        y={{ domain: [0, max], ticks: niceTicks(max, 4), label: "bit/s" }}
        margin={{ right: 12, bottom: 52 }}
      >
        {({ px, py, area }) => {
          const slot = (area.right - area.left) / bars.length;
          const barW = Math.max(6, slot - GAP * 2);

          return bars.map((b, i) => {
            const x = px(i) + GAP;
            const y = py(b.throughput);
            const dimmed = hover.hovered !== null && hover.hovered.index !== i;

            return (
              <g key={`${b.A}-${b.W}`}>
                {/* Rounded top, square base — the bar reads as anchored, not floating. */}
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1, area.bottom - y)}
                  rx="4"
                  fill="var(--color-accent-9)"
                  fillOpacity={dimmed ? 0.45 : 1}
                />
                <rect
                  x={x}
                  y={area.bottom - Math.min(5, area.bottom - y)}
                  width={barW}
                  height={Math.min(5, area.bottom - y)}
                  fill="var(--color-accent-9)"
                  fillOpacity={dimmed ? 0.45 : 1}
                />
                {b === best && (
                  <text
                    x={x + barW / 2}
                    y={y - 7}
                    textAnchor="middle"
                    className="tabular"
                    fill="var(--color-text)"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {b.throughput.toFixed(2)}
                  </text>
                )}
                <text
                  x={x + barW / 2}
                  y={area.bottom + 17}
                  textAnchor="middle"
                  className="tabular"
                  fill="var(--color-text-3)"
                  fontSize="10"
                >
                  {b.IDe.toFixed(1)}
                </text>
                <HoverZone
                  x={px(i)}
                  y={area.top}
                  width={slot}
                  height={area.bottom - area.top}
                  onEnter={() => hover.show(i, x + barW / 2, y, b)}
                  onLeave={hover.hide}
                />
              </g>
            );
          });
        }}
      </Plot>

      {hover.hovered && (
        <Tooltip x={hover.hovered.x} y={hover.hovered.y} height={HEIGHT}>
          <div className="tabular text-text">
            {hover.hovered.datum.throughput.toFixed(2)} bit/s
          </div>
          <div className="tabular text-text-3">
            {hover.hovered.datum.A.toFixed(1)}° away · {hover.hovered.datum.W.toFixed(2)}° wide
          </div>
          <div className="tabular text-text-3">
            {(hover.hovered.datum.meanMT * 1000).toFixed(0)} ms · n={hover.hovered.datum.n}
          </div>
        </Tooltip>
      )}
    </Figure>
  );
}
