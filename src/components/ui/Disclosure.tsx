"use client";

import { Collapsible } from "@base-ui-components/react/collapsible";
import type { ReactNode } from "react";

/**
 * Collapsed by default, for settings most people should never have to think about.
 *
 * Putting accessibility and cosmetic options behind this is not hiding them — it is
 * keeping the first screen down to the four things everyone must fill in. Anything a
 * player only touches once, or never, belongs in here.
 */
export function Disclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible.Root className="rounded-xl border border-border bg-panel">
      <Collapsible.Trigger className="group flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left">
        <span>
          <span className="block text-[15px] font-medium tracking-tight text-text">
            {title}
          </span>
          {summary && (
            <span className="mt-0.5 block text-[13px] text-text-3">{summary}</span>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className="shrink-0 text-text-3 transition-transform duration-150 group-data-[panel-open]:rotate-180"
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Collapsible.Trigger>

      <Collapsible.Panel className="overflow-hidden px-6 pb-6">
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
