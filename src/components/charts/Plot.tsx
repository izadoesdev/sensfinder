"use client";

import { useState, type ReactNode } from "react";

/**
 * The scaffolding every chart here needs: margins, scales, gridlines, tick labels,
 * axis titles, a baseline, and a hover tooltip.
 *
 * All three charts had their own copy of this, which is the shape of problem that
 * quietly drifts — one gets a tick format fixed, another keeps the bug, and a fourth
 * chart written later invents a third convention. Marks are the only thing a chart
 * should have to describe.
 */

export interface AxisSpec {
  domain: [number, number];
  /** Values to draw gridlines and labels at. Omit for none. */
  ticks?: number[];
  label?: string;
  format?: (v: number) => string;
}

export interface PlotScales {
  /** Data value to SVG x. */
  px: (v: number) => number;
  /** Data value to SVG y. */
  py: (v: number) => number;
  /** Plot area in SVG units, inside the margins. */
  area: { left: number; right: number; top: number; bottom: number };
}

const MARGIN = { top: 18, right: 60, bottom: 40, left: 50 };
const WIDTH = 720;

export function Figure({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-sm font-medium text-text">{title}</figcaption>
      {caption && (
        <p className="mb-3 text-xs leading-relaxed text-text-3">{caption}</p>
      )}
      <div className="relative">{children}</div>
    </figure>
  );
}

export function Plot({
  height,
  x,
  y,
  ariaLabel,
  margin: marginOverride,
  children,
}: {
  height: number;
  x: AxisSpec;
  y: AxisSpec;
  ariaLabel: string;
  margin?: Partial<typeof MARGIN>;
  children: (scales: PlotScales) => ReactNode;
}) {
  const m = { ...MARGIN, ...marginOverride };
  const area = { left: m.left, right: WIDTH - m.right, top: m.top, bottom: height - m.bottom };

  const span = (d: [number, number]) => d[1] - d[0] || 1;
  const px = (v: number) =>
    area.left + ((v - x.domain[0]) / span(x.domain)) * (area.right - area.left);
  const py = (v: number) =>
    area.bottom - ((v - y.domain[0]) / span(y.domain)) * (area.bottom - area.top);

  const fmt = (spec: AxisSpec, v: number) => (spec.format ?? String)(v);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
      {y.ticks?.map((t) => (
        <g key={`y${t}`}>
          <line
            x1={area.left}
            x2={area.right}
            y1={py(t)}
            y2={py(t)}
            stroke="var(--color-gray-4)"
            strokeWidth="1"
          />
          <text
            x={area.left - 9}
            y={py(t) + 4}
            textAnchor="end"
            className="tabular"
            fill="var(--color-text-3)"
            fontSize="10"
          >
            {fmt(y, t)}
          </text>
        </g>
      ))}

      {x.ticks?.map((t) => (
        <text
          key={`x${t}`}
          x={px(t)}
          y={area.bottom + 17}
          textAnchor="middle"
          className="tabular"
          fill="var(--color-text-3)"
          fontSize="10"
        >
          {fmt(x, t)}
        </text>
      ))}

      <line
        x1={area.left}
        x2={area.right}
        y1={area.bottom}
        y2={area.bottom}
        stroke="var(--color-border)"
        strokeWidth="1"
      />

      {children({ px, py, area })}

      {x.label && (
        <text
          x={(area.left + area.right) / 2}
          y={height - 5}
          textAnchor="middle"
          fill="var(--color-text-3)"
          fontSize="10"
        >
          {x.label}
        </text>
      )}
      {y.label && (
        <text
          x={-(area.top + area.bottom) / 2}
          y={12}
          transform="rotate(-90)"
          textAnchor="middle"
          fill="var(--color-text-3)"
          fontSize="10"
        >
          {y.label}
        </text>
      )}
    </svg>
  );
}

/**
 * A reference rule the chart exists to compare against — a perfect-calibration
 * diagonal, a zero-bias line. Dashed and labelled at both the axis and the end, so its
 * position is never inferred from spacing.
 */
export function Reference({
  from,
  to,
  label,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  label: string;
}) {
  return (
    <>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="var(--color-text-3)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />
      <text x={to.x + 6} y={to.y + 4} fill="var(--color-text-3)" fontSize="10">
        {label}
      </text>
    </>
  );
}

/** Hover state for a chart, keyed by mark index. */
export function useHover<T>() {
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number; datum: T } | null>(
    null,
  );
  return {
    hovered,
    show: (index: number, x: number, y: number, datum: T) =>
      setHovered({ index, x, y, datum }),
    hide: () => setHovered(null),
  };
}

/**
 * Positioned in percentages of the viewBox rather than pixels, so it tracks the mark
 * as the SVG scales with its container.
 */
export function Tooltip({
  x,
  y,
  height,
  children,
}: {
  x: number;
  y: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-raised px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: `${(x / WIDTH) * 100}%`, top: `${(y / height) * 100}%` }}
    >
      {children}
    </div>
  );
}

/** An invisible, generously sized hover target over a mark. */
export function HoverZone({
  x,
  y,
  width,
  height,
  onEnter,
  onLeave,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="transparent"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    />
  );
}
