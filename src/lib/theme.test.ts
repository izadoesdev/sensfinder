import { expect, test, describe } from "bun:test";
import { UI } from "./theme";

/**
 * CSS cannot import TypeScript, so the design tokens exist in two files. This is the
 * thing that stops them drifting: it reads the real stylesheet and compares.
 *
 * Without it, a grey nudged in one place and not the other produces a UI that is subtly
 * inconsistent in a way nobody can point at — the worst kind of bug to find by eye.
 */

const css = await Bun.file(new URL("../app/globals.css", import.meta.url)).text();

function cssToken(name: string): string | null {
  const match = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

describe("design tokens match the stylesheet", () => {
  test("every grey step agrees", () => {
    UI.gray.forEach((hex, i) => {
      expect(cssToken(`gray-${i}`)).toBe(hex);
    });
  });

  test("every accent step agrees", () => {
    for (const [step, hex] of Object.entries(UI.accent)) {
      expect(cssToken(`accent-${step}`)).toBe(hex);
    }
  });

  test("status colours agree", () => {
    for (const [name, hex] of Object.entries(UI.status)) {
      expect(cssToken(name)).toBe(hex);
    }
  });

  test("chart series colours agree", () => {
    for (const [slot, hex] of Object.entries(UI.series)) {
      expect(cssToken(`series-${slot}`)).toBe(hex);
    }
  });

  test("the stylesheet defines every token the app references semantically", () => {
    for (const alias of ["page", "panel", "raised", "hover", "border", "text", "text-2", "text-3"]) {
      expect(cssToken(alias)).not.toBeNull();
    }
  });
});
