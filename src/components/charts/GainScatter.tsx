"use client";

import type { Shot } from "@/lib/types";
import { niceTicks } from "./axis";
import { Figure, HoverZone, Plot, Reference, Tooltip, useHover } from "./Plot";

/**
 * The evidence behind the calibration number.
 *
 * One series, so no legend — the title names it. Hit and miss are told apart by *shape*
 * (filled versus hollow), not a second hue, so it survives colour-vision deficiency and
 * greyscale without spending a second validated colour slot.
 *
 * The dashed 1:1 line is the whole point: the gap between it and the fitted line is the
 * bias, shown rather than asserted.
 */

const HEIGHT = 320;

export function GainScatter({ shots, gain }: { shots: Shot[]; gain: number }) {
  const hover = useHover<Shot>();

  const pts = shots.filter(
    (s) =>
      !s.isPostSwitchTransient && s.distanceA > 0 && Number.isFinite(s.primarySubmovementDeg),
  );
  if (pts.length < 3) return null;

  const maxX = Math.max(...pts.map((s) => s.distanceA)) * 1.08;
  const maxY = Math.max(maxX, ...pts.map((s) => s.primarySubmovementDeg)) * 1.04;
  const refEnd = Math.min(maxX, maxY);
  const fitEndY = Math.min(gain * maxX, maxY);

  return (
    <Figure
      title="Your first move"
      caption="Each dot is one flick — how far you needed to move, against how far you actually moved before correcting. Hollow dots are misses."
    >
      <Plot
        height={HEIGHT}
        ariaLabel={`Scatter of ${pts.length} flicks. Fitted gain ${gain.toFixed(3)}.`}
        x={{ domain: [0, maxX], ticks: niceTicks(maxX, 5), label: "distance to target (degrees)" }}
        y={{ domain: [0, maxY], ticks: niceTicks(maxY, 5), label: "how far you moved (degrees)" }}
      >
        {({ px, py }) => (
          <>
            <Reference
              from={{ x: px(0), y: py(0) }}
              to={{ x: px(refEnd), y: py(refEnd) }}
              label="perfect"
            />

            <line
              x1={px(0)}
              y1={py(0)}
              x2={px(fitEndY / gain)}
              y2={py(fitEndY)}
              stroke="var(--color-accent-9)"
              strokeWidth="2"
            />
            <text
              x={px(fitEndY / gain) + 6}
              y={py(fitEndY) + 4}
              fill="var(--color-accent-9)"
              fontSize="11"
              fontWeight="600"
            >
              you · {gain.toFixed(2)}x
            </text>

            {pts.map((s, i) => {
              const cx = px(s.distanceA);
              const cy = py(s.primarySubmovementDeg);
              return (
                <g key={s.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="4.5"
                    fill={s.hit ? "var(--color-accent-9)" : "none"}
                    fillOpacity={s.hit ? 0.85 : 1}
                    stroke={s.hit ? "var(--color-panel)" : "var(--color-accent-9)"}
                    strokeWidth="1.5"
                  />
                  <HoverZone
                    x={cx - 9}
                    y={cy - 9}
                    width={18}
                    height={18}
                    onEnter={() => hover.show(i, cx, cy, s)}
                    onLeave={hover.hide}
                  />
                </g>
              );
            })}
          </>
        )}
      </Plot>

      {hover.hovered && (
        <Tooltip x={hover.hovered.x} y={hover.hovered.y} height={HEIGHT}>
          <div className="tabular text-text">
            {hover.hovered.datum.primarySubmovementDeg.toFixed(1)}° of{" "}
            {hover.hovered.datum.distanceA.toFixed(1)}°
          </div>
          <div className="tabular text-text-3">
            {(
              (hover.hovered.datum.primarySubmovementDeg / hover.hovered.datum.distanceA - 1) *
              100
            ).toFixed(0)}
            % · {hover.hovered.datum.hit ? "hit" : "miss"}
          </div>
        </Tooltip>
      )}
    </Figure>
  );
}
