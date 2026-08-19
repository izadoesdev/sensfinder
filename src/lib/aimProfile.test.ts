import { expect, test, describe } from "bun:test";
import { aimProfile } from "./profile";
import { conditionKey } from "./scenario";
import type { Shot } from "./types";

/**
 * The aim profile fires on patterns a simulated player never shows — asymmetry, a
 * vertical habit, hunting for the target. Building the shots directly is the only way
 * to prove each check triggers when it should and stays quiet when it should not.
 */

let counter = 0;

function shot(over: Partial<Shot> = {}): Shot {
  const distanceA = over.distanceA ?? 14;
  const targetW = over.targetW ?? 3.4;
  return {
    id: `s${counter++}`,
    sessionId: "t",
    blockId: "b",
    scenarioId: "static-flick",
    seq: 10, // past the transient window
    isPostSwitchTransient: false,
    degPerCount: 0.028,
    cm360: 40.8,
    spawnTs: 0,
    firstMoveTs: 180,
    clickTs: 600,
    hit: true,
    distanceA,
    targetW,
    indexOfDifficulty: Math.log2(distanceA / targetW + 1),
    conditionKey: conditionKey(distanceA, targetW),
    endpointAlong: 0,
    endpointPerp: 0,
    horizontalSign: 1,
    pathLengthDeg: distanceA,
    overshootRatio: 1,
    primarySubmovementDeg: distanceA,
    submovementCount: 1,
    directionReversals: 0,
    trace: [],
    ...over,
  };
}

/** A clean baseline: symmetric, centred, one movement per shot, quick to start. */
function cleanShots(n = 40): Shot[] {
  return Array.from({ length: n }, (_, i) =>
    shot({ horizontalSign: i % 2 === 0 ? 1 : -1, firstMoveTs: 150, clickTs: 600 }),
  );
}

const ids = (shots: Shot[]) => aimProfile(shots).map((f) => f.id);

describe("aim profile", () => {
  test("stays quiet on a clean session apart from praising clean stops", () => {
    expect(ids(cleanShots())).toEqual(["corrections"]);
  });

  test("needs a reasonable sample before saying anything at all", () => {
    expect(aimProfile(cleanShots(8))).toEqual([]);
  });

  test("ignores the post-switch transient shots", () => {
    const transients = Array.from({ length: 40 }, () =>
      shot({ isPostSwitchTransient: true, submovementCount: 4 }),
    );
    expect(aimProfile(transients)).toEqual([]);
  });

  test("flags hunting for the target", () => {
    const hunting = cleanShots().map((s) => ({ ...s, submovementCount: 2.4 }));
    const finding = aimProfile(hunting).find((f) => f.id === "corrections")!;
    expect(finding.tone).toBe("warn");
  });

  test("finds a left/right asymmetry that the pooled figure hides", () => {
    // Overshoots right by 1.5 deg, undershoots left by the same — mean is exactly zero.
    const asym = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0
        ? shot({ horizontalSign: 1, endpointAlong: 1.5 })
        : shot({ horizontalSign: -1, endpointAlong: -1.5 }),
    );
    const pooled = asym.reduce((a, s) => a + s.endpointAlong, 0) / asym.length;
    expect(pooled).toBeCloseTo(0, 10); // invisible to the calibration fit

    const finding = aimProfile(asym).find((f) => f.id === "asymmetry")!;
    expect(finding).toBeDefined();
    expect(finding.title).toContain("right");
  });

  test("flags a consistent vertical offset", () => {
    const low = cleanShots().map((s) => ({ ...s, endpointPerp: -1.2 }));
    const finding = aimProfile(low).find((f) => f.id === "vertical")!;
    expect(finding.title).toContain("low");
  });

  test("flags accuracy collapsing on the hard half", () => {
    const easy = Array.from({ length: 20 }, () =>
      shot({ distanceA: 8, targetW: 5.6, hit: true }),
    );
    const hard = Array.from({ length: 20 }, (_, i) =>
      shot({ distanceA: 22, targetW: 2.0, hit: i < 4 }),
    );
    expect(ids([...easy, ...hard])).toContain("falloff");
  });

  test("flags a player who is slow to start rather than slow to move", () => {
    const slowStart = cleanShots().map((s) => ({
      ...s,
      firstMoveTs: 400,
      clickTs: 600,
    }));
    expect(ids(slowStart)).toContain("reaction");
  });
});
