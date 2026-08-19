"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One button, four intents, two sizes. No glow, no gradient — a flat fill, a hairline
 * border and a hover step from the same ramp is enough to establish hierarchy, and it
 * stays legible next to dense numeric content instead of competing with it.
 */

const base =
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-lg " +
  "font-medium transition-colors duration-100 " +
  "disabled:pointer-events-none disabled:opacity-40";

const sizes = {
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-[15px]",
} as const;

const variants = {
  primary: "bg-accent-9 text-white hover:bg-accent-10",
  secondary: "border border-border bg-raised text-text hover:border-border-strong hover:bg-hover",
  quiet: "border border-transparent text-text-2 hover:bg-raised hover:text-text",
  danger: "border border-crit/40 bg-crit/10 text-crit hover:bg-crit/20",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: Variant;
  size?: Size;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(base, sizes[size], variants[variant], className)}>
      {children}
    </Link>
  );
}

export function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 7h10M8 3l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
