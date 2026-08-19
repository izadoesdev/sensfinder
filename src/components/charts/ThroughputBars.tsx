"use client";

import { useState } from "react";
import type { ThroughputResult } from "@/lib/analysis";
import { TOOLTIP_CLASS, niceTicks } from "./axis";

/**
 * Score by shot difficulty — one series, so one hue and no legend.
 *
 * This is the chart that will eventually carry the per-regime recommendation: the
 * published research found the best sensitivity shifts with index of difficulty, so
 * a slope across these bars is the signal, not noise.
 *
 * Bars carry a 4px rounded data-end at the top and sit on the baseline. The single
 * highest bar is direct-labelled; the rest are on hover, because a number over every
 * bar turns a comparison into a table.
 */

const M = { top: 20, right: 12, bottom: 52, left: 46 };
const W = 720;
const H = 300;
const GAP = 2;

export function ThroughputBars({
  data,
  className = "",
}: {
  data: ThroughputResult;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const bars = [...data.conditions].sort((a, b) => a.IDe - b.IDe);
  if (bars.length < 2) return null;

  const max = Math.max(...bars.map((b) => b.throughput)) * 1.15;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const slot = plotW / bars.length;
  const barW = Math.max(6, slot - GAP * 2);

  const py = (v: number) => M.top + plotH - (v / max) * plotH;
  const ticks = niceTicks(max, 4);
  const best = bars.reduce((a, b) => (b.throughput > a.throughput ? b : a));

  return (
    <figure className={`m-0 ${className}`}>
      <figcaption className="mb-1 text-sm font-medium text-text">
        Score by shot difficulty
      </figcaption>
      <p className="mb-3 text-xs leading-relaxed text-text-3">
        Easiest shots on the left, hardest on the right.
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Throughput across ${bars.length} difficulty conditions, peak ${best.throughput.toFixed(2)} bits per second.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={py(t)}
                y2={py(t)}
                stroke="var(--color-gray-4)"
                strokeWidth="1"
              />
              <text
                x={M.left - 10}
                y={py(t) + 4}
                textAnchor="end"
                className="tabular"
                fill="var(--color-text-3)"
                fontSize="11"
              >
                {t}
              </text>
            </g>
          ))}

          {bars.map((b, i) => {
            const x = M.left + i * slot + GAP;
            const y = py(b.throughput);
            const h = M.top + plotH - y;
            const isBest = b === best;
            return (
              <g
                key={`${b.A}-${b.W}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {/* Hit target spans the whole slot, not just the bar. */}
                <rect
                  x={M.left + i * slot}
                  y={M.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1, h)}
                  rx="4"
                  fill="var(--color-accent-9)"
                  fillOpacity={hover === null || hover === i ? 1 : 0.45}
                />
                {/* Square off the baseline end so the bar reads as anchored, not floating. */}
                <rect
                  x={x}
                  y={M.top + plotH - Math.min(5, h)}
                  width={barW}
                  height={Math.min(5, h)}
                  fill="var(--color-accent-9)"
                  fillOpacity={hover === null || hover === i ? 1 : 0.45}
                />
                {isBest && (
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
                  y={H - M.bottom + 16}
                  textAnchor="middle"
                  className="tabular"
                  fill="var(--color-text-3)"
                  fontSize="10"
                >
                  {b.IDe.toFixed(1)}
                </text>
              </g>
            );
          })}

          <line
            x1={M.left}
            x2={W - M.right}
            y1={M.top + plotH}
            y2={M.top + plotH}
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          <text
            x={M.left + plotW / 2}
            y={H - 12}
            textAnchor="middle"
            fill="var(--color-text-3)"
            fontSize="11"
          >
            harder to the right
          </text>
          <text
            x={-(M.top + plotH / 2)}
            y={13}
            transform="rotate(-90)"
            textAnchor="middle"
            fill="var(--color-text-3)"
            fontSize="11"
          >
            bit/s
          </text>
        </svg>

        {hover !== null && (
          <div
            className={TOOLTIP_CLASS}
            style={{
              left: `${((M.left + hover * slot + slot / 2) / W) * 100}%`,
              top: `${(py(bars[hover].throughput) / H) * 100}%`,
            }}
          >
            <div className="tabular text-text">
              {bars[hover].throughput.toFixed(2)} bit/s
            </div>
            <div className="tabular text-text-3">
              {bars[hover].A.toFixed(1)}° away · {bars[hover].W.toFixed(2)}° wide
            </div>
            <div className="tabular text-text-3">
              {(bars[hover].meanMT * 1000).toFixed(0)} ms · n={bars[hover].n}
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
