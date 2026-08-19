"use client";

import { NumberField } from "@base-ui-components/react/number-field";
import { Eyebrow } from "./primitives";

/**
 * A stepper built on Base UI's NumberField.
 *
 * Worth the primitive rather than a bare `<input type="number">`: it handles clamping,
 * locale formatting, hold-to-repeat on the steppers, and arrow/page-key semantics. The
 * label doubles as a scrub area — drag it sideways to change the value — which is
 * faster than typing when you are sweeping a sensitivity looking for the feel of it.
 */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  largeStep,
  suffix,
  format,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  suffix?: string;
  format?: Intl.NumberFormatOptions;
  hint?: string;
}) {
  return (
    <NumberField.Root
      value={value}
      onValueChange={(v) => {
        if (v !== null && Number.isFinite(v)) onChange(v);
      }}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep}
      format={format}
      allowWheelScrub={false} // a stray scroll must never silently change a measurement input
      className="block"
    >
      <NumberField.ScrubArea className="mb-1.5 inline-block cursor-ew-resize">
        <Eyebrow>{label}</Eyebrow>
        <NumberField.ScrubAreaCursor />
      </NumberField.ScrubArea>

      <NumberField.Group className="flex items-stretch overflow-hidden rounded-lg border border-border bg-raised transition-colors focus-within:border-accent-8">
        <Stepper direction="down" />
        <div className="relative flex-1 border-x border-border">
          <NumberField.Input className="w-full cursor-text bg-transparent px-2 py-2 text-center font-mono text-sm tabular text-text outline-none" />
          {suffix && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none text-xs text-text-3">
              {suffix}
            </span>
          )}
        </div>
        <Stepper direction="up" />
      </NumberField.Group>

      {hint && <p className="mt-1.5 text-xs text-text-3">{hint}</p>}
    </NumberField.Root>
  );
}

function Stepper({ direction }: { direction: "up" | "down" }) {
  const Comp = direction === "up" ? NumberField.Increment : NumberField.Decrement;
  return (
    <Comp className="flex w-9 shrink-0 cursor-pointer items-center justify-center text-text-3 transition-colors hover:bg-hover hover:text-text active:bg-gray-4">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d={direction === "up" ? "M6 2v8M2 6h8" : "M2 6h8"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </Comp>
  );
}
