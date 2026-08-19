"use client";

import { Switch } from "@base-ui-components/react/switch";

/** Base UI Switch — gives us the `role="switch"` contract and keyboard toggling. */
export function SwitchRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-raised px-4 py-3 transition-colors hover:border-border-strong">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-text">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-text-3">{hint}</span>}
      </span>

      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-[22px] w-10 shrink-0 cursor-pointer rounded-full border border-gray-6 bg-gray-4 outline-none transition-colors duration-150 data-[checked]:border-accent-8 data-[checked]:bg-accent-9"
      >
        <Switch.Thumb className="block h-4 w-4 translate-x-[2px] rounded-full bg-gray-10 transition-[transform,background-color] duration-150 data-[checked]:translate-x-[20px] data-[checked]:bg-white" />
      </Switch.Root>
    </label>
  );
}
