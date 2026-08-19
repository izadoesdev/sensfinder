/**
 * Yaw = degrees of horizontal view rotation per mouse count at in-game sensitivity 1.0.
 *
 * These constants are the foundation of every number this app produces. A wrong yaw
 * silently corrupts every recommendation, so games are gated behind `verified`:
 * only ship a game once its yaw has been confirmed against a real in-game 360 count.
 *
 * Games with non-linear or percentage-based sensitivity models (Fortnite, R6 Siege)
 * do not fit this model at all and must not be added with a single yaw constant.
 */
export type GameId = "valorant" | "cs2" | "apex" | "overwatch2";

export interface GameDef {
  id: GameId;
  name: string;
  /** Degrees per mouse count at sens 1.0. */
  yaw: number;
  /** Smallest sensitivity increment the game's settings UI accepts. */
  sensStep: number;
  sensRange: [number, number];
  defaultSens: number;
  /** False = yaw constant not yet confirmed in-game. Hidden from the UI. */
  verified: boolean;
}

export const GAMES: Record<GameId, GameDef> = {
  valorant: {
    id: "valorant",
    name: "VALORANT",
    yaw: 0.07,
    sensStep: 0.001,
    sensRange: [0.1, 3],
    defaultSens: 0.4,
    verified: true,
  },
  cs2: {
    id: "cs2",
    name: "Counter-Strike 2",
    yaw: 0.022,
    sensStep: 0.01,
    sensRange: [0.5, 6],
    defaultSens: 1.2,
    verified: true,
  },
  apex: {
    id: "apex",
    name: "Apex Legends",
    yaw: 0.022,
    sensStep: 0.01,
    sensRange: [0.5, 6],
    defaultSens: 1.5,
    verified: false,
  },
  overwatch2: {
    id: "overwatch2",
    name: "Overwatch 2",
    yaw: 0.0066,
    sensStep: 0.01,
    sensRange: [1, 20],
    defaultSens: 5,
    verified: false,
  },
};

export const VERIFIED_GAMES: GameDef[] = Object.values(GAMES).filter((g) => g.verified);
