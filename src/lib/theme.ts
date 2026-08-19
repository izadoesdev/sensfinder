/**
 * The single source of truth for colour.
 *
 * Two audiences, one file:
 *
 *  - `UI` mirrors the `@theme` block in `globals.css`. CSS cannot import TypeScript, so
 *    the values exist in both places — and `theme.test.ts` parses the stylesheet and
 *    fails if they ever disagree. Drift becomes a red test rather than a slow, silent
 *    divergence nobody notices until two greys look almost the same.
 *
 *  - `SCENE` is the 3D range. It lives only here because nothing in CSS renders it.
 *    These were previously three dozen hex literals spread across four components,
 *    which is how a scene ends up with five nearly-identical greys.
 *
 * The scene deliberately runs slightly cooler and bluer than the UI ramp. A range that
 * exactly matched the surrounding chrome would make the 3D view read as another panel
 * rather than as a place.
 */

export const UI = {
  gray: [
    "#08090a",
    "#0d0e10",
    "#121316",
    "#17181c",
    "#1d1e23",
    "#26272d",
    "#32333a",
    "#4a4b53",
    "#6e6f78",
    "#8b8c95",
    "#a8a9b2",
    "#d4d5da",
    "#fafafa",
  ],
  accent: {
    2: "#04121d",
    3: "#062639",
    4: "#07304a",
    5: "#093f61",
    6: "#0b527d",
    8: "#0077cc",
    9: "#0099ff",
    10: "#26a8ff",
    11: "#6cc4ff",
  },
  status: {
    good: "#0ca30c",
    warn: "#fab219",
    crit: "#d03b3b",
  },
  /** Chart series 2 and 3, validated for colour-vision deficiency alongside accent-9. */
  series: {
    2: "#d95926",
    3: "#199e70",
  },
} as const;

export const SCENE = {
  wall: {
    base: "#242932",
    seam: "#3a424f",
    inner: "#2e3540",
    stud: "#48515f",
  },
  floor: "#1f242d",
  ceiling: "#1a1f26",
  column: "#333a46",
  /** The lit band high on the wall. Bright by design — it is the room's only light. */
  lightBand: "#6d88ad",
  /** The play-area frame. Present but never competing with a target. */
  boundary: "#5b7a9e",
  fog: "#1f242c",
  /** Rim drawn inside a target's silhouette to sharpen its edge. */
  targetRim: "#12151a",
  weapon: {
    metal: "#525b6a",
    dark: "#2b313b",
    light: "#6f7887",
    /** Optic lens, matched to the UI accent so the weapon belongs to the product. */
    optic: "#0099ff",
  },
  muzzle: {
    core: "#ffffff",
    flame: "#ffd9a0",
    light: "#ffcf8a",
  },
} as const;

/** Fill light colours for the weapon. The world is unlit; these reach only the gun. */
export const SCENE_LIGHTS = {
  key: 2.6,
  ambient: 2.2,
  rim: 0.9,
  rimColor: "#7f9fd0",
} as const;
