"use client";

import { useState } from "react";
import { GAMES, type GameId } from "@/lib/games";
import { cm360 as toCm360, quantiseSens, sensFromCm360 } from "@/lib/sens";
import type { RawInputStatus } from "@/hooks/usePointerLock";
import { Badge, Button, Kbd, NumberInput } from "@/components/ui";

/**
 * A conventional pause menu: a stack of full-width actions with the exit in the stack,
 * not hidden as a faint link underneath it.
 *
 * Changing sensitivity necessarily restarts the round. A block is defined by the single
 * sensitivity it was shot at, and splicing two into one result would make every
 * statistic derived from it meaningless — so the button says so rather than surprising
 * anyone.
 */
export function PauseOverlay({
  fired,
  remaining,
  rawInput,
  gameId,
  dpi,
  sens,
  cm360,
  onResume,
  onApplySens,
  onQuit,
}: {
  fired: number;
  remaining: number;
  rawInput: RawInputStatus;
  gameId: GameId;
  dpi: number;
  sens: number;
  cm360: number;
  onResume: () => void;
  onApplySens: (sens: number) => void;
  onQuit: () => void;
}) {
  const [draft, setDraft] = useState(sens);
  const [editing, setEditing] = useState(false);
  const game = GAMES[gameId];
  const draftCm = toCm360(gameId, draft, dpi);
  const changed = Math.abs(draft - sens) > game.sensStep / 2;
  const started = fired > 0;

  const nudge = (deltaCm: number) => {
    setDraft(quantiseSens(gameId, sensFromCm360(gameId, draftCm + deltaCm, dpi)));
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-page/92 backdrop-blur-sm"
      onClick={onResume}
    >
      <div
        className="w-full max-w-sm animate-rise cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <Badge tone={started ? "neutral" : "accent"}>
            {started ? `${remaining} shots left` : `${remaining} shots`}
          </Badge>
          <h2 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.025em]">
            {started ? "Paused" : "Ready"}
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-text-2">
            {started
              ? "Your current target was reset so the timing stays clean."
              : "Shoot each target as soon as it appears. Misses count."}
          </p>
        </div>

        {rawInput === "os-adjusted" && (
          <p className="mt-5 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-[13px] leading-relaxed text-warn">
            This browser is applying mouse acceleration, so your results won&rsquo;t be
            accurate. Use Chrome or Edge.
          </p>
        )}

        <div className="mt-7 space-y-2">
          <Button variant="primary" size="lg" className="w-full" onClick={onResume}>
            {started ? "Resume" : "Start"}
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="w-full justify-between"
            onClick={() => setEditing((v) => !v)}
          >
            <span>Sensitivity</span>
            <span className="font-mono text-[13px] tabular text-text-2">
              {cm360.toFixed(1)} cm/360
            </span>
          </Button>

          {editing && (
            <div className="space-y-2.5 rounded-lg border border-border bg-panel p-4">
              <div className="flex items-end gap-2">
                <Button variant="secondary" onClick={() => nudge(-2)}>
                  −2
                </Button>
                <div className="flex-1">
                  <NumberInput
                    label={`${game.name} sens`}
                    value={draft}
                    onChange={setDraft}
                    min={game.sensRange[0]}
                    max={game.sensRange[1]}
                    step={game.sensStep}
                    largeStep={game.sensStep * 10}
                    format={{ maximumFractionDigits: 3 }}
                  />
                </div>
                <Button variant="secondary" onClick={() => nudge(2)}>
                  +2
                </Button>
              </div>
              <Button
                variant="primary"
                disabled={!changed}
                className="w-full"
                onClick={() => onApplySens(draft)}
              >
                {changed ? `Use ${draftCm.toFixed(1)} cm/360` : "No change"}
              </Button>
              <p className="text-xs leading-relaxed text-text-3">
                Restarts the round — a result only counts if the whole round used one
                setting.
              </p>
            </div>
          )}

          <Button variant="secondary" size="lg" className="w-full" onClick={onQuit}>
            Back to setup
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-text-3">
          <Kbd>Esc</Kbd>
          <span>pauses at any time</span>
        </div>
      </div>
    </div>
  );
}
