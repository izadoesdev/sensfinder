import { expect, test, describe } from "bun:test";
import {
  cm360,
  cm360FromDegPerCount,
  convertSens,
  degPerCount,
  degPerCountFromCm360,
  edpi,
  sensFromCm360,
  checkSens,
} from "./sens";

describe("sensitivity conversions", () => {
  test("known reference: 800 DPI, VALORANT 0.5 -> 32.66 cm/360", () => {
    expect(cm360("valorant", 0.5, 800)).toBeCloseTo(32.657, 2);
  });

  test("known reference: 800 DPI, VALORANT 0.4 -> 40.8 cm/360 (typical pro)", () => {
    expect(cm360("valorant", 0.4, 800)).toBeCloseTo(40.82, 2);
  });

  test("VALORANT pro median 267 eDPI sits near 45 cm/360", () => {
    // 267 eDPI at 800 DPI = 0.334 sens
    const c = cm360("valorant", 267 / 800, 800);
    expect(c).toBeGreaterThan(43);
    expect(c).toBeLessThan(50);
  });

  test("sensFromCm360 round-trips", () => {
    const sens = sensFromCm360("valorant", 40, 800);
    expect(cm360("valorant", sens, 800)).toBeCloseTo(40, 6);
  });

  test("degPerCount round-trips through cm360", () => {
    const dpc = degPerCount("valorant", 0.42);
    const c = cm360FromDegPerCount(dpc, 1600);
    expect(degPerCountFromCm360(c, 1600)).toBeCloseTo(dpc, 10);
  });

  test("cross-game conversion preserves cm/360", () => {
    const valSens = 0.4;
    const cs2Sens = convertSens(
      { gameId: "valorant", sens: valSens, dpi: 800 },
      { gameId: "cs2", dpi: 1600 },
    );
    expect(cm360("cs2", cs2Sens, 1600)).toBeCloseTo(cm360("valorant", valSens, 800), 8);
  });

  test("VALORANT -> CS2 at equal DPI is a 0.07/0.022 = 3.18x multiplier", () => {
    const out = convertSens(
      { gameId: "valorant", sens: 0.5, dpi: 800 },
      { gameId: "cs2", dpi: 800 },
    );
    expect(out).toBeCloseTo(0.5 * (0.07 / 0.022), 8);
  });

  test("eDPI is just the product", () => {
    expect(edpi(0.4, 800)).toBe(320);
  });
});

describe("pre-flight sanity checks", () => {
  test("flags a sensitivity outside the published optimal band", () => {
    expect(checkSens({ cm360: 12 }).level).toBe("danger");
    expect(checkSens({ cm360: 120 }).level).toBe("danger");
    expect(checkSens({ cm360: 40 }).level).toBe("ok");
  });

  test("flags a 180 that does not fit on the pad", () => {
    // 100 cm/360 needs 50 cm for a 180; a 40 cm pad cannot do it.
    const r = checkSens({ cm360: 100, padWidthCm: 40 });
    expect(r.level).toBe("danger");
    expect(r.messages.some((m) => m.includes("180"))).toBe(true);
  });

  test("warns when a 180 eats most of the pad", () => {
    // 45 cm/360 -> 22.5 cm for a 180 on a 26 cm pad = 87%.
    expect(checkSens({ cm360: 45, padWidthCm: 26 }).level).toBe("warn");
  });

  test("a comfortable setup passes clean", () => {
    expect(checkSens({ cm360: 40, padWidthCm: 45 })).toEqual({ level: "ok", messages: [] });
  });
});
