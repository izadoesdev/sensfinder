"use client";

import { useState } from "react";
import type { RoundSummary } from "@/store/settings";
import { TOOLTIP_CLASS } from "./axis";

/**
 * Are your successive rounds converging?
 *
 * Finding a sensitivity is a loop — run, adjust, run again — and a single round cannot
 * tell you whether an adjustment worked. Plotting each round's measured bias against
 * the zero line makes the answer immediate: points walking toward zero means the
 * adjustments are landing; points bouncing either side of zero at similar magnitude
 * means you have reached the noise floor and should stop tuning.
 *
 * One series, so one hue and no legend. The zero line is the reference the whole chart
 * exists to compare against, so it is drawn as a labelled rule rather than a gridline.
 */

const M = { top: 18, right: 56, bottom: 34, left: 44 };
const W = 720;
const H = 200;

export function Convergence({ rounds }: { rounds: RoundSummary[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const pts = rounds.filter((r) => r.gain !== null);
  if (pts.length < 2) return null;

  const biases = pts.map((r) => (r.gain! - 1) * 100);
  const bound = Math.max(4, Math.ceil(Math.max(...biases.map(Math.abs)) * 1.25));

  const px = (i: number) =>
    M.left + (pts.length === 1 ? 0 : (i / (pts.length - 1)) * (W - M.left - M.right));
  const py = (v: number) =>
    M.top + ((bound - v) / (2 * bound)) * (H - M.top - M.bottom);

  const path = biases.map((b, i) => `${i ? "L" : "M"}${px(i)},${py(b)}`).join(" ");
  const last = biases[biases.length - 1];

  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-sm font-medium text-text">
        Is it settling?
      </figcaption>
      <p className="mb-3 text-xs leading-relaxed text-text-3">
        How far off you were each round. Heading toward zero means it is working.
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Bias across ${pts.length} rounds, latest ${last.toFixed(1)} percent.`}
        >
          {[bound, bound / 2, -bound / 2, -bound].map((t) => (
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
                x={M.left - 8}
                y={py(t) + 4}
                textAnchor="end"
                className="tabular"
                fill="var(--color-text-3)"
                fontSize="10"
              >
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          ))}

          {/* The reference the chart exists for, labelled on the axis as well as the
              rule so the zero point is never inferred from spacing. */}
          <line
            x1={M.left}
            x2={W - M.right}
            y1={py(0)}
            y2={py(0)}
            stroke="var(--color-text-3)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text
            x={M.left - 8}
            y={py(0) + 4}
            textAnchor="end"
            className="tabular"
            fill="var(--color-text-2)"
            fontSize="10"
          >
            0
          </text>
          <text x={W - M.right + 6} y={py(0) + 4} fill="var(--color-text-3)" fontSize="10">
            on target
          </text>

          <path d={path} fill="none" stroke="var(--color-accent-9)" strokeWidth="2" />

          {biases.map((b, i) => (
            <g key={pts[i].at} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect
                x={px(i) - 14}
                y={M.top}
                width={28}
                height={H - M.top - M.bottom}
                fill="transparent"
              />
              <circle
                cx={px(i)}
                cy={py(b)}
                r="4.5"
                fill="var(--color-accent-9)"
                stroke="var(--color-panel)"
                strokeWidth="1.5"
              />
              <text
                x={px(i)}
                y={H - M.bottom + 16}
                textAnchor="middle"
                className="tabular"
                fill="var(--color-text-3)"
                fontSize="10"
              >
                {pts[i].cm360.toFixed(0)}
              </text>
            </g>
          ))}

          <text
            x={px(biases.length - 1) + 8}
            y={py(last) + 4}
            fill="var(--color-accent-9)"
            fontSize="11"
            fontWeight="600"
            className="tabular"
          >
            {last > 0 ? "+" : ""}
            {last.toFixed(1)}%
          </text>

          <text
            x={M.left + (W - M.left - M.right) / 2}
            y={H - 4}
            textAnchor="middle"
            fill="var(--color-text-3)"
            fontSize="10"
          >
            cm/360 each round
          </text>
        </svg>

        {hover !== null && (
          <div
            className={TOOLTIP_CLASS}
            style={{ left: `${(px(hover) / W) * 100}%`, top: `${(py(biases[hover]) / H) * 100}%` }}
          >
            <div className="tabular text-text">
              {biases[hover] > 0 ? "+" : ""}
              {biases[hover].toFixed(1)}% at {pts[hover].cm360.toFixed(1)} cm/360
            </div>
            <div className="tabular text-text-3">
              {(pts[hover].accuracy * 100).toFixed(0)}% hit · {pts[hover].shots} shots
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
