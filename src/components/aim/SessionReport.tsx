"use client";

import { useMemo, useState } from "react";
import {
  aimProfile,
  calibratedCm360,
  summarise,
  type CalibrationGain,
} from "@/lib/analysis";
import { GAMES, type GameId } from "@/lib/games";
import { quantiseSens, sensFromCm360 } from "@/lib/sens";
import type { Shot } from "@/lib/types";
import type { RoundSummary } from "@/store/settings";
import { GainScatter } from "@/components/charts/GainScatter";
import { ThroughputBars } from "@/components/charts/ThroughputBars";
import { Convergence } from "@/components/charts/Convergence";
import {
  ArrowRight,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Eyebrow,
  Stat,
} from "@/components/ui";

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

      <Calibration
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

/**
 * The whole point of a round is deciding what to do next, so the next action lives
 * immediately under the result: one click applies the recommendation and starts the
 * next round, with no trip back through the setup page.
 */
function NextRound({
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

function Calibration({
  gain,
  cm360,
  gameId,
  dpi,
  currentSens,
}: {
  gain: CalibrationGain | null;
  cm360: number;
  gameId: GameId;
  dpi: number;
  currentSens: number;
}) {
  if (!gain) {
    return (
      <Card className="mt-8" tone="quiet">
        <h2 className="text-lg font-medium">Not enough shots</h2>
        <p className="mt-2 text-[13px] text-text-2">
          Finish a full round and we&rsquo;ll have enough to work with.
        </p>
      </Card>
    );
  }

  if (gain.inconclusive) {
    return (
      <Card className="mt-8" tone="quiet">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            No systematic bias detected
          </h2>
          <Badge>inconclusive</Badge>
        </div>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-text-2">
          You aren&rsquo;t consistently over- or under-shooting, so{" "}
          {cm360.toFixed(1)} cm/360 already matches your muscle memory. Changing it now
          would cost you what you&rsquo;ve built.
        </p>
      </Card>
    );
  }

  const over = gain.gain > 1;
  const target = calibratedCm360(cm360, gain.gain);
  const lo = calibratedCm360(cm360, gain.ci95[0]);
  const hi = calibratedCm360(cm360, gain.ci95[1]);
  const targetSens = quantiseSens(gameId, sensFromCm360(gameId, target, dpi));

  return (
    <Card className="mt-8" tone="accent">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>calibration result</Eyebrow>
          <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.02em]">
            You {over ? "overshoot" : "undershoot"} by{" "}
            <span className="tabular text-accent-9">
              {(Math.abs(gain.gain - 1) * 100).toFixed(1)}%
            </span>
          </h2>
        </div>
        <Badge tone="good">n = {gain.n}</Badge>
      </div>

      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-text-2">
        Your hand keeps moving as if your sensitivity were{" "}
        <span className="font-medium text-text">{target.toFixed(1)} cm/360</span>, not
        the {cm360.toFixed(1)} you&rsquo;re on. Match it and aiming should feel right
        straight away.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Figure
          label={`New ${GAMES[gameId].name} sens`}
          value={targetSens.toFixed(3)}
          sub={`was ${currentSens}`}
          accent
        />
        <Figure
          label="New cm/360"
          value={target.toFixed(1)}
          sub={`was ${cm360.toFixed(1)}`}
        />
        <Figure
          label="Likely range"
          value={`${Math.min(lo, hi).toFixed(1)}–${Math.max(lo, hi).toFixed(1)}`}
          sub="cm/360"
        />
      </div>

      <p className="mt-6 border-t border-accent-5 pt-4 text-xs leading-relaxed text-text-3">
        This is the sensitivity that will feel right immediately. Whether it&rsquo;s also
        the one you score highest on is a separate question — run a few rounds and watch
        the trend.
      </p>
    </Card>
  );
}

function Figure({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-page/60 p-4">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={`mt-2 font-mono text-[26px] leading-none tabular ${
          accent ? "text-accent-9" : "text-text"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-xs tabular text-text-3">{sub}</div>
    </div>
  );
}

function ConditionTable({
  data,
}: {
  data: { A: number; W: number; n: number; IDe: number; meanMT: number; throughput: number }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Throughput per distance and target-width condition
        </caption>
        <thead className="text-text-3">
          <tr>
            {["Distance", "Width", "n", "IDe", "Mean MT", "Throughput"].map((h) => (
              <th key={h} className="pb-2 pr-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular">
          {[...data]
            .sort((a, b) => a.IDe - b.IDe)
            .map((c) => (
              <tr key={`${c.A}-${c.W}`} className="border-t border-gray-4">
                <td className="py-2 pr-4">{c.A.toFixed(1)}°</td>
                <td className="py-2 pr-4">{c.W.toFixed(2)}°</td>
                <td className="py-2 pr-4">{c.n}</td>
                <td className="py-2 pr-4">{c.IDe.toFixed(2)}</td>
                <td className="py-2 pr-4">{(c.meanMT * 1000).toFixed(0)} ms</td>
                <td className="py-2 pr-4 text-text">{c.throughput.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
