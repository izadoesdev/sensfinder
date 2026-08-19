"use client";

import { useMemo, useState } from "react";
import { summarise } from "@/lib/analysis";
import { calibratedCm360 } from "@/lib/calibration";
import { aimProfile } from "@/lib/profile";
import { CalibrationCard } from "@/components/report/CalibrationCard";
import { ConditionTable } from "@/components/report/ConditionTable";
import { NextRound } from "@/components/report/NextRound";
import { GAMES, type GameId } from "@/lib/games";
import { quantiseSens, sensFromCm360 } from "@/lib/sens";
import type { Shot } from "@/lib/types";
import type { RoundSummary } from "@/store/settings";
import { GainScatter } from "@/components/charts/GainScatter";
import { ThroughputBars } from "@/components/charts/ThroughputBars";
import { Convergence } from "@/components/charts/Convergence";
import { Button, ButtonLink, Card, CardHeader, Eyebrow, Stat } from "@/components/ui";

interface Props {
  shots: Shot[];
  cm360: number;
  gameId: GameId;
  dpi: number;
  currentSens: number;
  history: RoundSummary[];
  onApplyAndRerun: (sens: number) => void;
  onRerun: () => void;
  onBack: () => void;
}

export function SessionReport({
  shots,
  cm360,
  gameId,
  dpi,
  currentSens,
  history,
  onApplyAndRerun,
  onRerun,
  onBack,
}: Props) {
  const s = useMemo(() => summarise(shots), [shots]);
  const profile = useMemo(() => aimProfile(shots), [shots]);
  const [showTable, setShowTable] = useState(false);
  const game = GAMES[gameId];
  const excluded = shots.length - s.shots;

  const recommended =
    s.gain && !s.gain.inconclusive
      ? {
          cm360: calibratedCm360(cm360, s.gain.gain),
          sens: quantiseSens(
            gameId,
            sensFromCm360(gameId, calibratedCm360(cm360, s.gain.gain), dpi),
          ),
        }
      : null;

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ gameId, dpi, currentSens, cm360, shots }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sensfinder-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-14 animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Round {history.length}</Eyebrow>
          <h1 className="mt-2 text-[36px] font-semibold tracking-[-0.025em]">
            {s.shots} shots scored
          </h1>
        </div>
        <div className="text-right text-[13px] tabular text-text-3">
          <div className="text-text-2">{cm360.toFixed(1)} cm/360</div>
          <div>
            {game.name} {currentSens} · {dpi} DPI
          </div>
          {excluded > 0 && <div>First {excluded} warm-up shots ignored</div>}
        </div>
      </header>

      <CalibrationCard
        gain={s.gain}
        cm360={cm360}
        gameId={gameId}
        dpi={dpi}
        currentSens={currentSens}
      />

      {/* The loop, right under the result — not buried at the bottom of the page. */}
      <NextRound
        recommended={recommended}
        onApplyAndRerun={onApplyAndRerun}
        onRerun={onRerun}
      />

      {history.length >= 2 && (
        <Card className="mt-3">
          <Convergence rounds={history} />
        </Card>
      )}

      {s.gain && (
        <Card className="mt-3">
          <GainScatter shots={shots} gain={s.gain.gain} />
        </Card>
      )}

      {profile.length > 0 && (
        <div className="mt-10">
          <CardHeader
            title="What else your shots show"
            hint="Sensitivity is one finding. These come from the same shots and point at things no setting will fix."
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {profile.map((f) => (
              <div
                key={f.id}
                className={`rounded-lg border p-4 ${
                  f.tone === "warn"
                    ? "border-warn/35 bg-warn/[0.06]"
                    : f.tone === "good"
                      ? "border-good/35 bg-good/[0.06]"
                      : "border-gray-4 bg-panel"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium text-text">{f.title}</span>
                  <span
                    className={`shrink-0 font-mono text-[15px] tabular ${
                      f.tone === "warn"
                        ? "text-warn"
                        : f.tone === "good"
                          ? "text-good"
                          : "text-text-2"
                    }`}
                  >
                    {f.value}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-text-3">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <CardHeader title="How you shot" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Accuracy" value={(s.accuracy * 100).toFixed(1)} unit="%" />
          <Stat label="Time per target" value={s.medianTimeToHit.toFixed(0)} unit="ms" />
          <Stat label="Reaction" value={s.medianReactionTime.toFixed(0)} unit="ms" />
          <Stat
            label="Score"
            value={
              Number.isFinite(s.throughput.throughput)
                ? s.throughput.throughput.toFixed(2)
                : "—"
            }
            unit="bit/s"
            hint="Speed and accuracy combined. Most players sit near 4."
          />
          <Stat
            label="Corrections"
            value={s.meanSubmovements.toFixed(2)}
            hint="1.00 means every flick lands first try."
          />
          <Stat
            label="Efficiency"
            value={(s.medianEfficiency * 100).toFixed(0)}
            unit="%"
            hint="How direct your path to the target was."
          />
        </div>
      </div>

      {s.throughput.conditions.length >= 2 && (
        <div className="mt-10">
          <CardHeader
            title="Easy shots vs hard shots"
            hint="Your best sensitivity shifts with the shot: slower for small far targets, faster for big close ones."
            action={
              <Button variant="quiet" onClick={() => setShowTable((v) => !v)}>
                {showTable ? "Chart" : "Table"}
              </Button>
            }
          />
          <Card>
            {showTable ? (
              <ConditionTable data={s.throughput.conditions} />
            ) : (
              <ThroughputBars data={s.throughput} />
            )}
          </Card>
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={onBack}>Settings</Button>
        <ButtonLink href="/history" variant="secondary">
          All rounds
        </ButtonLink>
        <Button variant="quiet" onClick={exportJson}>
          Export data
        </Button>
      </div>
    </main>
  );
}
