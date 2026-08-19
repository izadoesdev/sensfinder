/**
 * Power analysis — PRD §12 Q1.
 *
 * Two questions, both of which decide whether a product is possible before any of it
 * gets built:
 *
 *   A. Is a 72-shot block enough to resolve a calibration bias? (the shipped MVP)
 *   B. How many shots per arm are needed to resolve a 5% throughput difference?
 *      (the V1 optimiser — if the answer is "hundreds", a 15-minute session is not a
 *      session, it is a multi-day protocol, and V1 needs a different shape)
 *
 * Method: run the real engine through the scripted player from `simulate.ts` many
 * times over, and measure how much the resulting statistic moves from block to block.
 * That block-to-block spread *is* the measurement noise, and it sets the smallest
 * difference the design can detect.
 *
 * The honest caveat, stated up front: the simulated player's motor noise is a guess,
 * because no human has shot a session yet. So this sweeps a range of noise levels and
 * reports the answer as a function of it. When real telemetry exists, measure the
 * player's actual endpoint spread, find the matching row, and read off the answer.
 *
 * Run with:  bun run scripts/power-analysis.ts
 */

import { calibrationGain } from "../src/lib/calibration";
import { computeThroughput } from "../src/lib/fitts";
import { mean, stdDev } from "../src/lib/stats";
import { SCENARIOS, type ScenarioDef } from "../src/lib/scenario";
import { cm360, degPerCount } from "../src/lib/sens";
import { simulateShots } from "../src/lib/simulate";

const DPI = 800;
const SENS = 0.4;
const CM360 = cm360("valorant", SENS, DPI);
const DPC = degPerCount("valorant", SENS);

/** Two-sided alpha 0.05, power 0.80. */
const Z_ALPHA = 1.959964;
const Z_BETA = 0.841621;

/** Motor-noise levels to sweep, in degrees of endpoint scatter. */
const NOISE_LEVELS = [0.5, 1.0, 1.5, 2.5];

/**
 * Block sizes. Multiples of 9 so every (distance x width) condition gets equal
 * repetitions, and never below 45 — effective width needs at least 5 shots per
 * condition to have a standard deviation worth trusting.
 */
const BLOCK_SIZES = [45, 72, 108, 144, 216];

const REPLICATES = 120;

function withShotCount(base: ScenarioDef, shotCount: number): ScenarioDef {
  return { ...base, shotCount };
}

/** One simulated block, returned as the two statistics we care about. */
function runBlock(shotCount: number, noiseDeg: number, seed: number) {
  const shots = simulateShots({
    scenario: withShotCount(SCENARIOS["static-flick"], shotCount),
    degPerCount: DPC,
    cm360: CM360,
    gain: 1.0, // unbiased: we are measuring noise, not recovering a signal
    noiseDeg,
    seed,
  });

  const scored = shots.filter((s) => !s.isPostSwitchTransient);
  return {
    gain: calibrationGain(scored)?.gain ?? NaN,
    throughput: computeThroughput(scored).throughput,
  };
}

/**
 * Smallest difference detectable between two arms measured on the same player.
 *
 * Paired design, so the relevant spread is block-to-block variation within one person,
 * which is what the replicates above measure.
 */
function minimumDetectable(sd: number, blocksPerArm: number): number {
  return (Z_ALPHA + Z_BETA) * sd * Math.sqrt(2 / blocksPerArm);
}

function blocksNeeded(sd: number, target: number): number {
  return Math.ceil(2 * ((Z_ALPHA + Z_BETA) * sd / target) ** 2);
}

console.log("SensFinder power analysis");
console.log(`${REPLICATES} simulated blocks per cell, alpha 0.05 two-sided, power 0.80`);
console.log(`Reference sensitivity: ${CM360.toFixed(1)} cm/360\n`);

/* ------------------------------------------- A: calibration gain (the MVP) -- */

console.log("A. CALIBRATION GAIN — can a single block resolve a bias?");
console.log("   Smallest bias detectable from one block, as a percentage.\n");
console.log("   noise |" + BLOCK_SIZES.map((n) => ` ${String(n).padStart(5)} shots`).join(""));
console.log("   ------+" + BLOCK_SIZES.map(() => "------------").join(""));

for (const noise of NOISE_LEVELS) {
  const cells = BLOCK_SIZES.map((n) => {
    const gains: number[] = [];
    for (let r = 0; r < REPLICATES; r++) {
      const g = runBlock(n, noise, 1000 + r * 17).gain;
      if (Number.isFinite(g)) gains.push(g);
    }
    // One block gives one estimate, so its own SD is the detectable-difference scale.
    const sd = stdDev(gains);
    return `${(minimumDetectable(sd, 1) * 100).toFixed(1)}%`.padStart(12);
  });
  console.log(`   ${noise.toFixed(1)}° |` + cells.join(""));
}

/* ------------------------------------------ B: throughput (the optimiser) -- */

console.log("\n\nB. THROUGHPUT — how many shots per arm to resolve a 5% difference?");
console.log("   Total shots per sensitivity arm, and the session length that implies.");
console.log("   (~1.5 s per shot including the gap, so 400 shots is about 10 minutes.)\n");
console.log("   noise |" + BLOCK_SIZES.map((n) => ` ${String(n).padStart(5)} shots`).join(""));
console.log("   ------+" + BLOCK_SIZES.map(() => "------------").join(""));

const summary: { noise: number; best: number }[] = [];

for (const noise of NOISE_LEVELS) {
  let best = Infinity;
  const cells = BLOCK_SIZES.map((n) => {
    const tps: number[] = [];
    for (let r = 0; r < REPLICATES; r++) {
      const tp = runBlock(n, noise, 5000 + r * 23).throughput;
      if (Number.isFinite(tp)) tps.push(tp);
    }
    if (tps.length < 10) return "—".padStart(12);

    const sd = stdDev(tps);
    const target = 0.05 * mean(tps); // a 5% difference in throughput
    const shots = blocksNeeded(sd, target) * n;
    best = Math.min(best, shots);
    return `${shots}`.padStart(12);
  });
  summary.push({ noise, best });
  console.log(`   ${noise.toFixed(1)}° |` + cells.join(""));
}

/* ----------------------------------------------------------------- verdict -- */

console.log("\n\nVERDICT");
for (const { noise, best } of summary) {
  const minutes = (best * 1.5) / 60;
  const arms = 6;
  const total = (minutes * arms).toFixed(0);
  console.log(
    `   at ${noise.toFixed(1)}° noise: ${best} shots/arm ≈ ${minutes.toFixed(0)} min/arm ` +
      `→ ${total} min for a 6-arm sweep`,
  );
}
console.log(
  "\n   A 6-arm optimiser session is only feasible if that total is inside about\n" +
    "   20 minutes. Beyond roughly 40, V1 is not one session — it is a protocol\n" +
    "   spread over days, and the PRD's 15-minute claim has to be withdrawn.",
);
