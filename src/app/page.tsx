"use client";

import { Hydrated } from "@/components/Hydrated";
import { SetupForm } from "@/components/setup/SetupForm";
import { TooltipProvider } from "@/components/ui";

export default function SetupPage() {
  return (
    <TooltipProvider>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header className="animate-rise">
          <div className="flex select-none items-center gap-2.5">
            <Mark />
            <span className="text-[13px] font-medium tracking-tight">SensFinder</span>
          </div>

          <h1 className="mt-12 max-w-xl text-balance text-[44px] font-semibold leading-[1.08] tracking-[-0.025em]">
            Find your real sensitivity.
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-text-2">
            Three minutes of flicks. We measure how far your hand actually moves, then
            tell you the sensitivity it&rsquo;s already expecting.
          </p>
        </header>

        {/* Only the settings-dependent half waits on localStorage; the copy around it
            renders server-side so the page is never a blank document. */}
        <Hydrated
          fallback={
            <div className="mt-12 h-[680px] rounded-xl border border-border bg-panel" />
          }
        >
          <SetupForm />
        </Hydrated>

        <footer className="mt-20 border-t border-border pt-6 text-xs leading-relaxed text-text-3">
          Built on Boudaoud &amp; Spjut, &ldquo;Mouse Sensitivity Effects in First-Person
          Targeting Tasks&rdquo; (IEEE Transactions on Games, 2023) — the only published
          study of how sensitivity affects aim. Scores use ISO 9241-9 throughput.
        </footer>
      </main>
    </TooltipProvider>
  );
}


function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <circle
        cx="10"
        cy="10"
        r="8.5"
        stroke="var(--color-gray-6)"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="10" cy="10" r="3.25" fill="var(--color-accent-9)" />
      <line x1="10" y1="0.5" x2="10" y2="4" stroke="var(--color-accent-9)" strokeWidth="1.5" />
      <line x1="10" y1="16" x2="10" y2="19.5" stroke="var(--color-accent-9)" strokeWidth="1.5" />
    </svg>
  );
}
