import { expect, test, describe } from "bun:test";
import {
  angularSizeToPixels,
  horizontalFovFromVertical,
  verticalFovFromHorizontal,
} from "./fov";
import { SCENARIOS } from "./scenario";

describe("field of view", () => {
  test("VALORANT's 103 degree horizontal FOV is ~71 degrees vertical at 16:9", () => {
    expect(verticalFovFromHorizontal(103, 16 / 9)).toBeCloseTo(70.5, 0);
  });

  test("horizontal and vertical conversions are inverses", () => {
    for (const aspect of [16 / 9, 21 / 9, 4 / 3, 1]) {
      expect(horizontalFovFromVertical(verticalFovFromHorizontal(103, aspect), aspect)).toBeCloseTo(
        103,
        8,
      );
    }
  });

  test("at 1:1 aspect the two are identical", () => {
    expect(verticalFovFromHorizontal(90, 1)).toBeCloseTo(90, 8);
  });

  test("a wider monitor shows the same horizontal FOV with a narrower vertical one", () => {
    expect(verticalFovFromHorizontal(103, 21 / 9)).toBeLessThan(
      verticalFovFromHorizontal(103, 16 / 9),
    );
  });
});

describe("target legibility", () => {
  test("the smallest configured target is still several pixels wide at 1080p", () => {
    const smallest = Math.min(...Object.values(SCENARIOS).flatMap((s) => s.widths));
    const px = angularSizeToPixels(smallest, 103, 1920);
    expect(px).toBeGreaterThan(4);
  });

  test("pixel size scales with viewport width", () => {
    expect(angularSizeToPixels(2.29, 103, 3840)).toBeCloseTo(
      2 * angularSizeToPixels(2.29, 103, 1920),
      6,
    );
  });
});
