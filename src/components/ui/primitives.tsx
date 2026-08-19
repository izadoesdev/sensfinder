"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Static presentation pieces. Anything with behaviour (select, stepper, switch,
 * tooltip) is built on a Base UI primitive instead, so keyboard handling, focus
 * management and ARIA come from a maintained implementation rather than from me.
 */

export function Card({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent" | "quiet";
}) {
  const tones = {
    default: "border-border bg-panel",
    accent: "border-accent-6 bg-accent-2",
    quiet: "border-gray-4 bg-panel",
  };
  return (
    <section className={cn("rounded-xl border p-6", tones[tone], className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-[15px] font-medium tracking-tight text-text">{title}</h2>
        {hint && (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-3">{hint}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block select-none text-[11px] font-medium uppercase tracking-[0.14em] text-text-3",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "good" | "warn" | "crit";
}) {
  const tones = {
    neutral: "border-border bg-raised text-text-2",
    accent: "border-accent-6 bg-accent-3 text-accent-11",
    good: "border-good/40 bg-good/10 text-good",
    warn: "border-warn/40 bg-warn/10 text-warn",
    crit: "border-crit/40 bg-crit/10 text-crit",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "default" | "accent" | "good" | "warn";
}) {
  const tones = {
    default: "text-text",
    accent: "text-accent-9",
    good: "text-good",
    warn: "text-warn",
  };
  return (
    <div className="rounded-lg border border-gray-4 bg-panel p-4">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          "mt-2 font-mono text-[24px] leading-none tabular tracking-tight",
          tones[tone],
        )}
      >
        {value}
        {unit && <span className="ml-1 text-sm text-text-3">{unit}</span>}
      </div>
      {hint && <p className="mt-2 text-xs leading-snug text-text-3">{hint}</p>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-raised px-1.5 py-0.5 font-mono text-[11px] text-text-2">
      {children}
    </kbd>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}
