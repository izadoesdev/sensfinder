"use client";

import { Tooltip } from "@base-ui-components/react/tooltip";
import type { ReactNode } from "react";

/**
 * Explanations for the jargon this app cannot avoid — eDPI, effective width, index of
 * difficulty. Base UI's Tooltip handles the hover/focus delay pair, the safe-polygon
 * exit and dismissal, so keyboard users get the same content.
 */
export function InfoTip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        aria-label={label}
        className="ml-1.5 inline-flex h-[14px] w-[14px] translate-y-px cursor-help items-center justify-center rounded-full border border-gray-6 text-[9px] font-medium text-text-3 outline-none transition-colors hover:border-gray-8 hover:text-text"
      >
        ?
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6} className="z-50">
          <Tooltip.Popup className="max-w-[280px] rounded-lg border border-border bg-raised px-3 py-2 text-xs leading-relaxed text-text-2 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] data-[ending-style]:animate-pop-out data-[starting-style]:animate-pop-in">
            {children}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delay={200}>{children}</Tooltip.Provider>;
}
