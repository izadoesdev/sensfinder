import type { Vec3 } from "@/lib/math3d";

/**
 * Shot feedback is passed to the 3D layer through a single mutable ref rather than
 * React state.
 *
 * Effects fire hundreds of milliseconds apart but must be picked up on the very next
 * frame; routing them through setState would re-render the tree mid-session and add
 * frame-time jitter to the exact measurement the session exists to take. Consumers
 * poll `seq` in `useFrame` and react when it changes.
 */
export interface ShotFeedback {
  /** Increments once per shot. Consumers compare against their own last-seen value. */
  seq: number;
  at: number;
  hit: boolean;
  /** Where the crosshair actually was when the click landed. */
  impact: Vec3;
  /** The target that was just shot at, so it can be animated out after it despawns. */
  deadDir: Vec3 | null;
  deadWidth: number;
}

export function createFeedback(): ShotFeedback {
  return {
    seq: 0,
    at: 0,
    hit: false,
    impact: [0, 0, -1],
    deadDir: null,
    deadWidth: 0,
  };
}
