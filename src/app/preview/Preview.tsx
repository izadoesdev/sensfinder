"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionReport } from "@/components/aim/SessionReport";
import { summarise } from "@/lib/analysis";
import { cm360, degPerCount } from "@/lib/sens";
import { SCENARIOS } from "@/lib/scenario";
import { simulateShots } from "@/lib/simulate";
import type { RoundSummary } from "@/store/settings";
import { Button, Card, CardHeader, Eyebrow } from "@/components/ui";

/**
 * A design harness for the session report.
 *
 * Iterating on the report otherwise means shooting a full 72-shot block for every
 * layout tweak. This renders it from the same simulator the test suite uses, so what
 * you see here is produced by the real engine and the real analysis — only the hand
 * moving the mouse is scripted.
 */

const DPI = 800;
const SENS = 0.4;
const GAME = "valorant" as const;

/*
 * Noise is deliberately generous. A tight simulated player lands every shot within a
 * fraction of a degree, which collapses effective width and sends throughput to absurd
 * values — useful for proving the maths, useless for judging whether the report reads
 * correctly at realistic numbers.
 */
const PRESETS = [
  { id: "overshoot", label: "Overshoots 12%", gain: 1.12, noise: 1.1 },
  { id: "undershoot", label: "Undershoots 8%", gain: 0.92, noise: 1.1 },
  { id: "clean", label: "No detectable bias", gain: 1.0, noise: 1.4 },
] as const;

export function Preview() {
  const router = useRouter();
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("overshoot");
  const [rounds, setRounds] = useState(3);

  const cm = cm360(GAME, SENS, DPI);
  const dpc = degPerCount(GAME, SENS);
  const active = PRESETS.find((p) => p.id === preset)!;

  const shots = useMemo(
    () =>
      simulateShots({
        scenario: SCENARIOS["static-flick"],
        degPerCount: dpc,
        cm360: cm,
        gain: active.gain,
        noiseDeg: active.noise,
        seed: 7,
      }),
    [dpc, cm, active],
  );

  // A plausible run of earlier rounds, converging toward no bias.
  const history: RoundSummary[] = useMemo(() => {
    const out: RoundSummary[] = [];
    for (let i = 0; i < rounds; i++) {
      const decay = Math.pow(0.55, i);
      const gain = 1 + (active.gain - 1) * decay;
      out.push({
        at: i,
        scenarioId: "static-flick",
        gameId: GAME,
        dpi: DPI,
        sens: SENS,
        cm360: cm * (1 + (i * (active.gain - 1)) / 2),
        gain,
        gainCi: [gain - 0.02, gain + 0.02],
        accuracy: 0.74 + i * 0.02,
        throughput: 3.9 + i * 0.05,
        shots: 66,
      });
    }
    return out;
  }, [rounds, active, cm]);

  const summary = summarise(shots);

  return (
    <div>
      <div className="border-b border-border bg-panel">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-6 py-4">
          <div>
            <Eyebrow>preview harness</Eyebrow>
            <p className="mt-1 text-[13px] text-text-2">
              Simulated player, real engine and real analysis.
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                variant={p.id === preset ? "primary" : "secondary"}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
            <Button onClick={() => setRounds((r) => (r >= 5 ? 1 : r + 1))}>
              {rounds} prior rounds
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 pt-6">
        <Card tone="quiet">
          <CardHeader
            title="Recovered from the simulation"
            hint="The injected bias and what the analysis got back out of it — if these drift apart, the pipeline is broken."
          />
          <div className="grid gap-4 font-mono text-[13px] tabular text-text-2 sm:grid-cols-3">
            <div>injected gain · {active.gain.toFixed(3)}</div>
            <div>
              recovered gain ·{" "}
              {summary.gain ? summary.gain.gain.toFixed(3) : "insufficient data"}
            </div>
            <div>
              verdict ·{" "}
              {summary.gain?.inconclusive ? "inconclusive" : "bias detected"}
            </div>
          </div>
        </Card>
      </div>

      <SessionReport
        shots={shots}
        cm360={cm}
        gameId={GAME}
        dpi={DPI}
        currentSens={SENS}
        history={history}
        onApplyAndRerun={() => router.push("/train")}
        onRerun={() => router.push("/train")}
        onBack={() => router.push("/")}
      />
    </div>
  );
}
