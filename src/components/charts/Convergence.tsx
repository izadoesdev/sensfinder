"use client";

import type { RoundSummary } from "@/store/settings";
import { symmetricTicks } from "./axis";
import { Figure, HoverZone, Plot, Reference, Tooltip, useHover } from "./Plot";

/**
 * Are your successive rounds converging?
 *
 * Finding a sensitivity is a loop — run, adjust, run again — and one round cannot tell
 * you whether an adjustment worked. Plotting each round's measured bias against zero
 * makes the answer immediate: walking toward the line means the adjustments are
 * landing, bouncing either side at similar size means you have reached the noise floor
 * and should stop tuning.
 */

const HEIGHT = 200;

export function Convergence({ rounds }: { rounds: RoundSummary[] }) {
  const hover = useHover<{ bias: number; round: RoundSummary }>();

  const pts = rounds.filter((r) => r.gain !== null);
  if (pts.length < 2) return null;

  const biases = pts.map((r) => (r.gain! - 1) * 100);
  const bound = Math.max(4, Math.ceil(Math.max(...biases.map(Math.abs)) * 1.25));
  const last = biases[biases.length - 1];

  return (
    <Figure
      title="Is it settling?"
      caption="How far off you were each round. Heading toward zero means it is working."
    >
      <Plot
        height={HEIGHT}
        ariaLabel={`Bias across ${pts.length} rounds, latest ${last.toFixed(1)} percent.`}
        x={{ domain: [0, pts.length - 1], label: "cm/360 each round" }}
        y={{
          domain: [-bound, bound],
          ticks: symmetricTicks(bound),
          format: (v) => (v > 0 ? `+${v}` : String(v)),
        }}
        margin={{ right: 56, bottom: 34 }}
      >
        {({ px, py, area }) => (
          <>
            <Reference
              from={{ x: area.left, y: py(0) }}
              to={{ x: area.right, y: py(0) }}
              label="on target"
            />

            <path
              d={biases.map((b, i) => `${i ? "L" : "M"}${px(i)},${py(b)}`).join(" ")}
              fill="none"
              stroke="var(--color-accent-9)"
              strokeWidth="2"
            />

            {biases.map((b, i) => (
              <g key={pts[i].at}>
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
                  y={area.bottom + 17}
                  textAnchor="middle"
                  className="tabular"
                  fill="var(--color-text-3)"
                  fontSize="10"
                >
                  {pts[i].cm360.toFixed(0)}
                </text>
                <HoverZone
                  x={px(i) - 14}
                  y={area.top}
                  width={28}
                  height={area.bottom - area.top}
                  onEnter={() => hover.show(i, px(i), py(b), { bias: b, round: pts[i] })}
                  onLeave={hover.hide}
                />
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
          </>
        )}
      </Plot>

      {hover.hovered && (
        <Tooltip x={hover.hovered.x} y={hover.hovered.y} height={HEIGHT}>
          <div className="tabular text-text">
            {hover.hovered.datum.bias > 0 ? "+" : ""}
            {hover.hovered.datum.bias.toFixed(1)}% at{" "}
            {hover.hovered.datum.round.cm360.toFixed(1)} cm/360
          </div>
          <div className="tabular text-text-3">
            {(hover.hovered.datum.round.accuracy * 100).toFixed(0)}% hit ·{" "}
            {hover.hovered.datum.round.shots} shots
          </div>
        </Tooltip>
      )}
    </Figure>
  );
}
