"use client";

import { Radio } from "@base-ui-components/react/radio";
import { RadioGroup } from "@base-ui-components/react/radio-group";
import type { ReactNode } from "react";

/**
 * A card-style radio group on Base UI's RadioGroup.
 *
 * These are mutually-exclusive choices, so they are radios rather than a row of
 * buttons — which means arrow-key navigation, a single tab stop, and the right role
 * for a screen reader, none of which a `<button>` grid gives you for free.
 */
export function ChoiceGroup<T extends string>({
  value,
  onChange,
  options,
  columns = 3,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; hint?: ReactNode; meta?: ReactNode }[];
  columns?: number;
  ariaLabel: string;
}) {
  return (
    <RadioGroup
      aria-label={ariaLabel}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
    >
      {options.map((o) => (
        <Radio.Root
          key={o.id}
          value={o.id}
          className="group cursor-pointer rounded-lg border border-border bg-raised p-3.5 text-left outline-none transition-colors duration-100 hover:border-border-strong data-[checked]:border-accent-8 data-[checked]:bg-accent-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-text">{o.label}</div>
              {o.hint && (
                <div className="mt-1 text-xs leading-snug text-text-3">{o.hint}</div>
              )}
            </div>
            <span className="mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border border-gray-6 bg-page transition-colors group-data-[checked]:border-accent-9">
              <Radio.Indicator className="h-[7px] w-[7px] rounded-full bg-accent-9" />
            </span>
          </div>
          {o.meta && (
            <div className="mt-3 font-mono text-[11px] tabular text-text-3">{o.meta}</div>
          )}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
