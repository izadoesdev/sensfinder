"use client";

import { Select } from "@base-ui-components/react/select";
import { Eyebrow } from "./primitives";

/**
 * Base UI Select rather than a native `<select>`: the popup can be styled to match the
 * rest of the surface treatment, and typeahead, roving focus and the listbox ARIA
 * contract come from the primitive.
 */
export function SelectInput<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="block">
      <Eyebrow>{label}</Eyebrow>
      <Select.Root
        items={options}
        value={value}
        onValueChange={(v) => v !== null && onChange(v as T)}
      >
        <Select.Trigger className="mt-1.5 flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text transition-colors hover:border-border-strong data-[popup-open]:border-accent-8">
          <Select.Value />
          <Select.Icon className="text-text-3 transition-transform duration-150 data-[popup-open]:rotate-180">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M3 4.5 6 7.5 9 4.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Positioner
            sideOffset={4}
            alignItemWithTrigger={false}
            className="z-50 outline-none"
          >
            <Select.Popup className="min-w-[var(--anchor-width)] rounded-lg border border-border bg-raised p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] data-[ending-style]:animate-pop-out data-[starting-style]:animate-pop-in">
              <Select.List>
                {options.map((o) => (
                  <Select.Item
                    key={o.value}
                    value={o.value}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm text-text-2 outline-none transition-colors data-[highlighted]:bg-hover data-[highlighted]:text-text data-[selected]:text-text"
                  >
                    <Select.ItemText>{o.label}</Select.ItemText>
                    <Select.ItemIndicator className="text-accent-9">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M2.5 6.5 5 9l4.5-6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
