import { mean, median } from "./stats";
import type { Shot } from "./types";


export interface AimFinding {
  id: string;
  title: string;
  detail: string;
  value: string;
  tone: "good" | "info" | "warn";
}

/**
 * What the same shots say about *how* you aim, beyond sensitivity.
 *
 * Every one of these comes out of telemetry already being recorded for the calibration
 * fit, so it costs nothing extra to collect and nothing extra for the player to do. The
 * point is that "your sensitivity is 8% off" is one finding among several: a player who
 * needs three corrections per shot has a stopping problem that no sensitivity will fix,
 * and telling them to change their sens instead would be actively unhelpful.
 *
 * Thresholds are expressed relative to target size wherever possible, so they stay
 * meaningful when the player scales targets up or down. They are heuristics for
 * drawing attention, not clinical cutoffs, and the copy is phrased as observation
 * rather than diagnosis.
 */
/**
 * Every threshold in one block.
 *
 * These are heuristics for drawing attention, not clinical cutoffs, and they are the
 * part of this file most likely to change once real sessions exist. Scattered through
 * the logic as bare numbers they were impossible to review as a set — and impossible to
 * tell apart from the arithmetic they sat next to.
 *
 * The ones expressed as a fraction of target width stay meaningful when a player scales
 * targets up or down.
 */
const T = {
  /** Below this many scored shots, say nothing at all. */
  minShots: 20,
  /** Mean movements per shot: above is hunting, below is a clean stop. */
  hunting: 1.8,
  cleanStop: 1.25,
  /** Shots needed per direction before comparing left against right. */
  minPerDirection: 8,
  /** Left/right gap, as a fraction of target width. */
  asymmetry: 0.25,
  /** Vertical offset, as a fraction of target width. */
  vertical: 0.2,
  /** Shots per difficulty half before comparing them. */
  minPerHalf: 10,
  /** Accuracy drop from the easy half to the hard half, in proportion. */
  falloff: 0.25,
  /** Share of total shot time spent before the movement starts. */
  slowStart: 0.55,
} as const;

export function aimProfile(shots: Shot[]): AimFinding[] {
  const scored = shots.filter((s) => !s.isPostSwitchTransient);
  if (scored.length < T.minShots) return [];

  const width = median(scored.map((s) => s.targetW));
  const findings: AimFinding[] = [];

  // 1. Correction load — how often the first movement is not the last.
  const corrections = mean(scored.map((s) => s.submovementCount));
  if (corrections >= T.hunting) {
    findings.push({
      id: "corrections",
      title: "You correct a lot",
      value: corrections.toFixed(2),
      detail:
        "Most shots take two or more separate movements. That is a stopping problem rather than an aiming one — the flick is arriving, then drifting past and coming back.",
      tone: "warn",
    });
  } else if (corrections <= T.cleanStop) {
    findings.push({
      id: "corrections",
      title: "Clean stops",
      value: corrections.toFixed(2),
      detail: "Nearly every shot lands in one movement, with no hunting at the end.",
      tone: "good",
    });
  }

  // 2. Left/right asymmetry — invisible in the pooled figure, common in practice.
  const right = scored.filter((s) => s.horizontalSign > 0).map((s) => s.endpointAlong);
  const left = scored.filter((s) => s.horizontalSign < 0).map((s) => s.endpointAlong);
  if (right.length >= T.minPerDirection && left.length >= T.minPerDirection) {
    const gap = mean(right) - mean(left);
    if (Math.abs(gap) > width * T.asymmetry) {
      const heavy = gap > 0 ? "right" : "left";
      findings.push({
        id: "asymmetry",
        title: `You go further ${heavy}`,
        value: `${gap > 0 ? "+" : ""}${gap.toFixed(2)}°`,
        detail: `Flicks to the ${heavy} land further than flicks the other way by about ${Math.abs(gap).toFixed(2)}°. Pooled across both directions this cancels out and looks like no bias at all, which is why it usually goes unnoticed.`,
        tone: "warn",
      });
    }
  }

  // 3. Vertical placement — crosshair height, not sensitivity.
  const vertical = mean(scored.map((s) => s.endpointPerp));
  if (Math.abs(vertical) > width * T.vertical) {
    findings.push({
      id: "vertical",
      title: `Your shots sit ${vertical > 0 ? "high" : "low"}`,
      value: `${vertical > 0 ? "+" : ""}${vertical.toFixed(2)}°`,
      detail:
        "A consistent vertical offset is a crosshair-placement habit, not a sensitivity problem — changing your sens will move it sideways, not up.",
      tone: "warn",
    });
  }

  // 4. Does it hold up when the shot gets hard?
  const byDifficulty = [...scored].sort((a, b) => a.indexOfDifficulty - b.indexOfDifficulty);
  const half = Math.floor(byDifficulty.length / 2);
  if (half >= T.minPerHalf) {
    const easy = byDifficulty.slice(0, half);
    const hard = byDifficulty.slice(-half);
    const drop =
      easy.filter((s) => s.hit).length / easy.length -
      hard.filter((s) => s.hit).length / hard.length;
    if (drop > T.falloff) {
      findings.push({
        id: "falloff",
        title: "Hard shots fall off sharply",
        value: `−${(drop * 100).toFixed(0)} pts`,
        detail:
          "Accuracy holds on close, large targets and drops steeply on small distant ones. That gap is where a lower sensitivity usually helps most.",
        tone: "info",
      });
    }
  }

  // 5. Starting versus moving — two very different problems with the same symptom.
  const reactions = scored
    .filter((s) => s.firstMoveTs !== null)
    .map((s) => s.firstMoveTs! - s.spawnTs);
  const total = median(scored.map((s) => s.clickTs - s.spawnTs));
  if (reactions.length >= T.minPerHalf && total > 0) {
    const share = median(reactions) / total;
    if (share > T.slowStart) {
      findings.push({
        id: "reaction",
        title: "Most of your time is spent starting",
        value: `${(share * 100).toFixed(0)}%`,
        detail:
          "The movement itself is quick; the delay is before it begins. That is reaction and target acquisition, which practice moves far more than settings do.",
        tone: "info",
      });
    }
  }

  return findings;
}

