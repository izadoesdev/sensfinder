/**
 * Target colour schemes, including colour-vision-deficiency options.
 *
 * The load-bearing property is *luminance contrast against the range*, not hue: every
 * target colour here is far lighter than the room, so it stays visible under any form
 * of colour blindness and in greyscale. Hue is the secondary channel, and the CVD
 * schemes simply avoid the confusion axis in question — red/green for deuteranopia and
 * protanopia, blue/yellow for tritanopia.
 *
 * Hit and miss feedback never relies on colour alone either: a hit blooms with a
 * filled core, a miss leaves a hollow ring. That shape difference survives any palette.
 */
export interface TargetPalette {
  id: PaletteId;
  name: string;
  note: string;
  /** The live target. */
  target: string;
  /** Bloom on a successful hit. */
  hit: string;
  /** Marker left at the crosshair on a miss. */
  miss: string;
  crosshair: string;
}

export type PaletteId =
  | "default"
  | "deuteranopia"
  | "tritanopia"
  | "high-contrast";

export const PALETTES: Record<PaletteId, TargetPalette> = {
  default: {
    id: "default",
    name: "Default",
    note: "Best contrast for most people.",
    target: "#ff6b3d",
    hit: "#7dd3a0",
    miss: "#ffc61a",
    crosshair: "#4ade80",
  },
  deuteranopia: {
    id: "deuteranopia",
    name: "Red–green safe",
    note: "If red and green look alike.",
    target: "#4db8ff",
    hit: "#ffffff",
    miss: "#ffc61a",
    crosshair: "#ffd94d",
  },
  tritanopia: {
    id: "tritanopia",
    name: "Blue–yellow safe",
    note: "If blue and yellow look alike.",
    target: "#ff5c5c",
    hit: "#ffffff",
    miss: "#14b87a",
    crosshair: "#14b87a",
  },
  "high-contrast": {
    id: "high-contrast",
    name: "Maximum contrast",
    note: "Brightness only, no colour.",
    target: "#ffffff",
    hit: "#ffffff",
    miss: "#8b8c95",
    crosshair: "#ffffff",
  },
};

export const PALETTE_LIST = Object.values(PALETTES);
