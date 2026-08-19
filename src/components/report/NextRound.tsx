"use client";

import { ArrowRight, Button, Card, Eyebrow } from "@/components/ui";

/**
 * The whole point of a round is deciding what to do next, so the next action lives
 * immediately under the result: one click applies the recommendation and starts the
 * next round, with no trip back through the setup page.
 */
export function NextRound({
  recommended,
  onApplyAndRerun,
  onRerun,
}: {
  recommended: { cm360: number; sens: number } | null;
  onApplyAndRerun: (sens: number) => void;
  onRerun: () => void;
}) {
  return (
    <Card className="mt-3" tone={recommended ? "accent" : "default"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>Next</Eyebrow>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-text-2">
            {recommended
              ? "Two or three rounds will tell you if it's settling."
              : "Run another round to tighten the estimate."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {recommended && (
            <Button variant="primary" onClick={() => onApplyAndRerun(recommended.sens)}>
              Switch to {recommended.sens.toFixed(3)} and run again <ArrowRight />
            </Button>
          )}
          <Button variant={recommended ? "secondary" : "primary"} onClick={onRerun}>
            Run again
          </Button>
        </div>
      </div>
    </Card>
  );
}
