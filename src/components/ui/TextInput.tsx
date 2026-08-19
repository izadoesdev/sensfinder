"use client";

import { Eyebrow } from "./primitives";

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <Eyebrow>{label}</Eyebrow>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="mt-1.5 w-full cursor-text rounded-lg border border-border bg-raised px-3 py-2 font-mono text-[13px] text-text outline-none transition-colors placeholder:text-gray-7 focus:border-accent-8"
      />
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-text-3">{hint}</p>}
    </label>
  );
}
