import { mean, stdDev } from "./stats";
import type { Shot } from "./types";


export interface ThroughputResult {
  /** bits/s. Human mouse throughput in the literature sits around 3.7-4.9 bits/s. */
  throughput: number;
  /** Per-condition breakdown the aggregate was built from. */
  conditions: {
    A: number;
    W: number;
    n: number;
    /** Effective width: 4.133 x SD of endpoint error along the task axis. */
    We: number;
    /** Effective index of difficulty, log2(A/We + 1). */
    IDe: number;
    meanMT: number;
    throughput: number;
  }[];
  /** True if too few shots per condition to trust the number. */
  underpowered: boolean;
}

const MIN_SHOTS_PER_CONDITION = 5;

/**
 * ISO 9241-9 style throughput.
 *
 * Throughput is the objective because it is a *unified* speed-accuracy measure:
 * rushing inflates endpoint spread (and therefore We), being slow and perfect
 * inflates movement time. Neither strategy games the score, which is exactly what
 * we need when comparing two sensitivities.
 *
 * Effective width is computed per (A, W) condition rather than pooled, because
 * pooling conditions of different difficulty inflates the spread for reasons that
 * have nothing to do with the player.
 */
export function computeThroughput(shots: Shot[]): ThroughputResult {
  const groups = new Map<string, Shot[]>();
  for (const s of shots) {
    const g = groups.get(s.conditionKey);
    if (g) g.push(s);
    else groups.set(s.conditionKey, [s]);
  }

  const conditions: ThroughputResult["conditions"] = [];
  let underpowered = false;

  for (const g of groups.values()) {
    if (g.length < MIN_SHOTS_PER_CONDITION) {
      underpowered = true;
      continue;
    }
    const sd = stdDev(g.map((s) => s.endpointAlong));
    if (!Number.isFinite(sd) || sd <= 0) continue;

    const We = 4.133 * sd;
    const A = mean(g.map((s) => s.distanceA));
    const IDe = Math.log2(A / We + 1);
    const meanMT = mean(g.map((s) => (s.clickTs - s.spawnTs) / 1000));
    if (meanMT <= 0) continue;

    conditions.push({
      A,
      W: g[0].targetW,
      n: g.length,
      We,
      IDe,
      meanMT,
      throughput: IDe / meanMT,
    });
  }

  return {
    throughput: conditions.length ? mean(conditions.map((c) => c.throughput)) : NaN,
    conditions,
    underpowered: underpowered || conditions.length === 0,
  };
}

