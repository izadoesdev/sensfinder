"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameId } from "@/lib/games";
import type { PaletteId } from "@/lib/palettes";
import { DEFAULT_SCENARIO, type ScenarioId } from "@/lib/scenario";

export type Grip = "arm" | "hybrid" | "wrist";

/**
 * One completed block, kept so the player can see whether successive rounds are
 * converging. Finding a sensitivity is iterative — run, adjust, run again — and
 * without a record of the previous rounds there is no way to tell convergence from
 * noise.
 */
export interface RoundSummary {
  at: number;
  scenarioId: ScenarioId;
  gameId: GameId;
  dpi: number;
  sens: number;
  cm360: number;
  /** Null when the fit was inconclusive or there were too few clean shots. */
  gain: number | null;
  gainCi: [number, number] | null;
  accuracy: number;
  throughput: number;
  shots: number;
  /** Median ms from target appearing to the first movement. */
  reactionMs: number;
  /** Median ms from target appearing to the click. */
  timePerTargetMs: number;
  /** Mean movements per shot. 1.0 means every flick lands first try. */
  corrections: number;
}

interface SettingsState {
  gameId: GameId;
  dpi: number;
  sens: number;
  padWidthCm: number;
  grip: Grip;
  scenarioId: ScenarioId;

  /**
   * Counts-per-event correction factor.
   *
   * `movementX` under pointer lock is *supposed* to be raw device counts, but it is
   * affected by device pixel ratio, page zoom and OS scaling in ways that vary by
   * browser and platform. Rather than trust it, we measure it: the user drags a known
   * physical distance and we solve for the factor. Until they do, every derived number
   * is provisional — hence `inputScaleVerified`.
   */
  inputScale: number;
  inputScaleVerified: boolean;

  /** Cosmetic only — the viewmodel never moves the camera. */
  showViewmodel: boolean;
  audioEnabled: boolean;

  palette: PaletteId;
  /**
   * Multiplier on every target's angular diameter. Recorded into telemetry, so a
   * scaled session stays internally consistent — but it does change the task, which
   * is why cross-session comparisons are only valid at the same scale.
   */
  targetScale: number;

  history: RoundSummary[];

  setGame: (gameId: GameId) => void;
  setDpi: (dpi: number) => void;
  setSens: (sens: number) => void;
  setPadWidth: (cm: number) => void;
  setGrip: (grip: Grip) => void;
  setScenario: (id: ScenarioId) => void;
  setInputScale: (scale: number, verified: boolean) => void;
  setShowViewmodel: (v: boolean) => void;
  setAudioEnabled: (v: boolean) => void;
  setPalette: (p: PaletteId) => void;
  setTargetScale: (v: number) => void;
  addRound: (r: RoundSummary) => void;
  clearHistory: () => void;
}

const MAX_HISTORY = 40;

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      gameId: "valorant",
      dpi: 800,
      sens: 0.4,
      padWidthCm: 45,
      grip: "hybrid",
      scenarioId: DEFAULT_SCENARIO,
      inputScale: 1,
      inputScaleVerified: false,
      showViewmodel: true,
      audioEnabled: true,
      palette: "default",
      targetScale: 1,
      history: [],

      setGame: (gameId) => set({ gameId }),
      setDpi: (dpi) => set({ dpi, inputScaleVerified: false }),
      setSens: (sens) => set({ sens }),
      setPadWidth: (padWidthCm) => set({ padWidthCm }),
      setGrip: (grip) => set({ grip }),
      setScenario: (scenarioId) => set({ scenarioId }),
      setInputScale: (inputScale, inputScaleVerified) =>
        set({ inputScale, inputScaleVerified }),
      setShowViewmodel: (showViewmodel) => set({ showViewmodel }),
      setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
      setPalette: (palette) => set({ palette }),
      setTargetScale: (targetScale) => set({ targetScale }),
      addRound: (r) =>
        set((s) => ({ history: [...s.history, r].slice(-MAX_HISTORY) })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "sensfinder-settings",
      // Persisted values would differ from the server-rendered defaults and trip a
      // hydration mismatch. Rehydrate explicitly after mount (see <Hydrated>).
      skipHydration: true,
    },
  ),
);
