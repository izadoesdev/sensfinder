"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Hydrated } from "@/components/Hydrated";
import { SessionReport } from "@/components/aim/SessionReport";
import { summarise } from "@/lib/analysis";
import { PALETTES } from "@/lib/palettes";
import {
  SCENARIOS,
  DEFAULT_SCENARIO,
  scaleScenario,
  withMixedSizes,
} from "@/lib/scenario";
import { cm360, degPerCount } from "@/lib/sens";
import type { Shot } from "@/lib/types";
import { useSettings } from "@/store/settings";

// The canvas touches WebGL and window on mount, so it must never be server-rendered.
const Trainer = dynamic(() => import("@/components/aim/Trainer").then((m) => m.Trainer), {
  ssr: false,
  loading: () => <div className="h-dvh w-full bg-page" />,
});

export default function TrainPage() {
  return (
    <Hydrated fallback={<div className="h-dvh w-full bg-page" />}>
      <TrainSession />
    </Hydrated>
  );
}

function TrainSession() {
  const router = useRouter();
  const s = useSettings();
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [runId, setRunId] = useState(0);

  const chosen = SCENARIOS[s.scenarioId] ?? SCENARIOS[DEFAULT_SCENARIO];
  const scenario = scaleScenario(
    s.mixedSizes ? withMixedSizes(chosen) : chosen,
    s.targetScale,
  );
  const dpc = degPerCount(s.gameId, s.sens);
  const cm = cm360(s.gameId, s.sens, s.dpi);

  /**
   * Record the finished block before showing the report. Successive rounds are the
   * only way to tell a real convergence from a lucky one, so history is written even
   * when the fit came back inconclusive — an inconclusive round is itself evidence.
   */
  const handleFinish = useCallback(
    (finished: Shot[]) => {
      const summary = summarise(finished);
      s.addRound({
        at: Date.now(),
        scenarioId: scenario.id,
        gameId: s.gameId,
        dpi: s.dpi,
        sens: s.sens,
        cm360: cm,
        gain: summary.gain && !summary.gain.inconclusive ? summary.gain.gain : null,
        gainCi: summary.gain ? summary.gain.ci95 : null,
        accuracy: summary.accuracy,
        throughput: summary.throughput.throughput,
        shots: summary.shots,
        reactionMs: summary.medianReactionTime,
        timePerTargetMs: summary.medianTimeToHit,
        corrections: summary.meanSubmovements,
      });
      setShots(finished);
    },
    [s, scenario.id, cm],
  );

  const startNextRound = useCallback(() => {
    setShots(null);
    setRunId((n) => n + 1);
  }, []);

  const handleBack = useCallback(() => router.push("/"), [router]);

  if (shots) {
    return (
      <SessionReport
        shots={shots}
        cm360={cm}
        gameId={s.gameId}
        dpi={s.dpi}
        currentSens={s.sens}
        history={s.history}
        onApplyAndRerun={(sens) => {
          s.setSens(sens);
          startNextRound();
        }}
        onRerun={startNextRound}
        onBack={handleBack}
      />
    );
  }

  return (
    <Trainer
      // A new scenario or a new sensitivity is a different experiment, not a mutation
      // of the running one — remount so the engine is rebuilt from scratch.
      key={`${runId}-${scenario.id}-${dpc}-${s.targetScale}-${s.mixedSizes}`}
      scenario={scenario}
      gameId={s.gameId}
      dpi={s.dpi}
      sens={s.sens}
      degPerCount={dpc}
      cm360={cm}
      inputScale={s.inputScale}
      inputScaleVerified={s.inputScaleVerified}
      showViewmodel={s.showViewmodel}
      audioEnabled={s.audioEnabled}
      palette={PALETTES[s.palette]}
      onFinish={handleFinish}
      onApplySens={s.setSens}
      onQuit={handleBack}
    />
  );
}
