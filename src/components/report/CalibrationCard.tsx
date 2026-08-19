"use client";

import { GAMES, type GameId } from "@/lib/games";
import { calibratedCm360, type CalibrationGain } from "@/lib/calibration";
import { quantiseSens, sensFromCm360 } from "@/lib/sens";
import { Badge, Card, Eyebrow } from "@/components/ui";

export function CalibrationCard({
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
