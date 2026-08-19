import { GAMES, type GameId } from "./games";

/**
 * All internal math runs in device-independent units (degrees per mouse count).
 * A game's sensitivity number is a *display* concern only — this keeps the
 * engine and the optimizer completely game-agnostic.
 *
 *   degPerCount  = yaw x sens
 *   cm/360       = (360 x 2.54) / (dpi x sens x yaw)
 *   deg/mm       = (dpi x sens x yaw) / 25.4
 */

const CM_PER_INCH = 2.54;
const MM_PER_INCH = 25.4;

export function degPerCount(gameId: GameId, sens: number): number {
  return GAMES[gameId].yaw * sens;
}

export function countsPer360(degPerCountValue: number): number {
  return 360 / degPerCountValue;
}

/** Centimetres of physical mouse travel for one full 360 degree turn. */
export function cm360FromDegPerCount(degPerCountValue: number, dpi: number): number {
  return (CM_PER_INCH * countsPer360(degPerCountValue)) / dpi;
}

export function cm360(gameId: GameId, sens: number, dpi: number): number {
  return cm360FromDegPerCount(degPerCount(gameId, sens), dpi);
}

export function degPerCountFromCm360(cm360Value: number, dpi: number): number {
  return (360 * CM_PER_INCH) / (cm360Value * dpi);
}

/** In-game sensitivity that produces the given cm/360 at the given DPI. */
export function sensFromCm360(gameId: GameId, cm360Value: number, dpi: number): number {
  return degPerCountFromCm360(cm360Value, dpi) / GAMES[gameId].yaw;
}

export function degPerMm(degPerCountValue: number, dpi: number): number {
  return (degPerCountValue * dpi) / MM_PER_INCH;
}

export function edpi(sens: number, dpi: number): number {
  return sens * dpi;
}

/** Convert a sensitivity between games while preserving cm/360 (and therefore muscle memory). */
export function convertSens(
  from: { gameId: GameId; sens: number; dpi: number },
  to: { gameId: GameId; dpi: number },
): number {
  return (
    (from.dpi * from.sens * GAMES[from.gameId].yaw) / (to.dpi * GAMES[to.gameId].yaw)
  );
}

/** Round to the smallest increment the game's settings menu actually accepts. */
export function quantiseSens(gameId: GameId, sens: number): number {
  const step = GAMES[gameId].sensStep;
  return Math.round(sens / step) * step;
}

/**
 * The only peer-reviewed study of sensitivity in first-person targeting tasks
 * (Boudaoud & Spjut, NVIDIA, IEEE ToG 2023) found every one of its experienced
 * participants optimised inside this band. We clamp priors to it and warn outside it.
 */
export const LITERATURE_CM360_RANGE: [number, number] = [20, 80];

export interface SensSanity {
  level: "ok" | "warn" | "danger";
  messages: string[];
}

/**
 * Deterministic pre-flight checks. These run before a single shot is fired and are
 * what let the optimiser search only ~6 candidate arms instead of the whole space.
 */
export function checkSens(opts: {
  cm360: number;
  /** Usable horizontal mousepad travel, in cm. */
  padWidthCm?: number;
}): SensSanity {
  const messages: string[] = [];
  let level: SensSanity["level"] = "ok";

  const [lo, hi] = LITERATURE_CM360_RANGE;
  if (opts.cm360 < lo) {
    level = "danger";
    messages.push(`Very fast. Almost everyone aims best between ${lo} and ${hi} cm/360.`);
  } else if (opts.cm360 > hi) {
    level = "danger";
    messages.push(`Very slow. Almost everyone aims best between ${lo} and ${hi} cm/360.`);
  }

  if (opts.padWidthCm && opts.padWidthCm > 0) {
    // A 180 degree turn is the practical worst case in a tactical shooter: if it
    // needs more travel than the pad has, every one of those turns costs a reposition.
    const cm180 = opts.cm360 / 2;
    if (cm180 > opts.padWidthCm) {
      level = "danger";
      messages.push(
        `A 180° turn needs ${cm180.toFixed(1)} cm and your pad is ${opts.padWidthCm} cm. You can't turn around without lifting the mouse.`,
      );
    } else if (cm180 > opts.padWidthCm * 0.8) {
      if (level === "ok") level = "warn";
      messages.push(
        `A 180° turn uses ${((cm180 / opts.padWidthCm) * 100).toFixed(0)}% of your pad. Not much room left.`,
      );
    }
  }

  return { level, messages };
}
