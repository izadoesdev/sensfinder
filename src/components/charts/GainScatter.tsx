"use client";

import { useState } from "react";
import type { Shot } from "@/lib/types";
import { TOOLTIP_CLASS, niceTicks } from "./axis";

/**
 * The evidence behind the calibration number.
 *
 * One series (this player's flicks), so no legend box — the title names it. The
 * hit/miss distinction is carried by *shape* (filled vs hollow), not a second hue,
 * so it survives colour-vision deficiency and greyscale printing without needing a
 * second validated slot.
 *
 * The dashed 1:1 line is the whole point of the chart: the vertical gap between it
 * and the fitted line is the bias, made visible rather than asserted.
 */

const M = { top: 18, right: 74, bottom: 40, left: 52 };
const W = 720;
const H = 320;

export function GainScatter({
  shots,
  gain,
  className = "",
}: {
  shots: Shot[];
  gain: number;
  className?: string;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; shot: Shot } | null>(null);

  const pts = shots.filter(
    (s) => !s.isPostSwitchTransient && s.distanceA > 0 && Number.isFinite(s.primarySubmovementDeg),
  );
  if (pts.length < 3) return null;

  const maxX = Math.max(...pts.map((s) => s.distanceA)) * 1.08;
  const maxY = Math.max(maxX, ...pts.map((s) => s.primarySubmovementDeg)) * 1.04;

  const px = (v: number) => M.left + (v / maxX) * (W - M.left - M.right);
  const py = (v: number) => H - M.bottom - (v / maxY) * (H - M.top - M.bottom);

  const xTicks = niceTicks(maxX, 5);
  const yTicks = niceTicks(maxY, 5);

  const fitEndY = Math.min(gain * maxX, maxY);
  const fitEndX = fitEndY / gain;
  const refEnd = Math.min(maxX, maxY);

  return (
    <figure className={`m-0 ${className}`}>
      <figcaption className="mb-1 text-sm font-medium text-text">
        Your first move
      </figcaption>
      <p className="mb-3 text-xs leading-relaxed text-text-3">
        Each dot is one flick — how far you needed to move, against how far you actually
        moved before correcting. Hollow dots are misses.
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scatter of ${pts.length} flicks. Fitted gain ${gain.toFixed(3)}.`}
        >
          {yTicks.map((t) => (
            <g key={`y${t}`}>
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

          {xTicks.map((t) => (
            <text
              key={`x${t}`}
              x={px(t)}
              y={H - M.bottom + 18}
              textAnchor="middle"
              className="tabular"
              fill="var(--color-text-3)"
              fontSize="11"
            >
              {t}
            </text>
          ))}

          <line
            x1={M.left}
            x2={W - M.right}
            y1={H - M.bottom}
            y2={H - M.bottom}
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          {/* Perfect calibration reference */}
          <line
            x1={px(0)}
            y1={py(0)}
            x2={px(refEnd)}
            y2={py(refEnd)}
            stroke="var(--color-text-3)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text
            x={px(refEnd) + 6}
            y={py(refEnd) + 4}
            fill="var(--color-text-3)"
            fontSize="11"
          >
            perfect
          </text>

          {/* Fitted gain */}
          <line
            x1={px(0)}
            y1={py(0)}
            x2={px(fitEndX)}
            y2={py(fitEndY)}
            stroke="var(--color-accent-9)"
            strokeWidth="2"
          />
          <text
            x={px(fitEndX) + 6}
            y={py(fitEndY) + 4}
            fill="var(--color-accent-9)"
            fontSize="11"
            fontWeight="600"
          >
            you · {gain.toFixed(2)}x
          </text>

          {pts.map((s) => {
            const cx = px(s.distanceA);
            const cy = py(s.primarySubmovementDeg);
            return (
              <circle
                key={s.id}
                cx={cx}
                cy={cy}
                r="4.5"
                fill={s.hit ? "var(--color-accent-9)" : "none"}
                fillOpacity={s.hit ? 0.85 : 1}
                stroke={s.hit ? "var(--color-panel)" : "var(--color-accent-9)"}
                strokeWidth={s.hit ? 1.5 : 1.6}
                onMouseEnter={() => setHover({ x: cx, y: cy, shot: s })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "crosshair" }}
              />
            );
          })}

          <text
            x={(M.left + W - M.right) / 2}
            y={H - 6}
            textAnchor="middle"
            fill="var(--color-text-3)"
            fontSize="11"
          >
            distance to target (degrees)
          </text>
          <text
            x={-(M.top + H - M.bottom) / 2}
            y={14}
            transform="rotate(-90)"
            textAnchor="middle"
            fill="var(--color-text-3)"
            fontSize="11"
          >
            how far you moved (degrees)
          </text>
        </svg>

        {hover && (
          <div
            className={TOOLTIP_CLASS}
            style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}
          >
            <div className="tabular text-text">
              {hover.shot.primarySubmovementDeg.toFixed(1)}° of{" "}
              {hover.shot.distanceA.toFixed(1)}°
            </div>
            <div className="tabular text-text-3">
              {(
                (hover.shot.primarySubmovementDeg / hover.shot.distanceA - 1) *
                100
              ).toFixed(0)}
              % · {hover.shot.hit ? "hit" : "miss"} · {hover.shot.targetW.toFixed(2)}°
              target
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
