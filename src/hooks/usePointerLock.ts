"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RawInputStatus = "unknown" | "raw" | "os-adjusted";

interface PointerLockApi {
  locked: boolean;
  /**
   * Whether the browser gave us unaccelerated deltas.
   *
   * This is not cosmetic. With OS mouse acceleration in the pipeline, the same hand
   * movement produces different rotation depending on how fast it was made, which
   * makes every measurement we take invalid rather than merely noisy. Chrome and Edge
   * support `unadjustedMovement`; Firefox and Safari silently fall back.
   */
  rawInput: RawInputStatus;
  request: () => void;
  exit: () => void;
}

interface Options {
  /** Called with raw mouse deltas for every event, summed by the caller. */
  onMove: (dx: number, dy: number) => void;
  onLockChange?: (locked: boolean) => void;
}

export function usePointerLock(
  targetRef: React.RefObject<HTMLElement | null>,
  { onMove, onLockChange }: Options,
): PointerLockApi {
  const [locked, setLocked] = useState(false);
  const [rawInput, setRawInput] = useState<RawInputStatus>("unknown");

  // Keep callbacks in refs so the listeners never need re-binding mid-session.
  // Synced in an effect rather than during render: the listeners only ever read
  // `.current` from an event handler, which is always after effects have run.
  const onMoveRef = useRef(onMove);
  const onLockChangeRef = useRef(onLockChange);

  useEffect(() => {
    onMoveRef.current = onMove;
    onLockChangeRef.current = onLockChange;
  }, [onMove, onLockChange]);

  const request = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;

    // `unadjustedMovement` rejects with NotSupportedError where it isn't implemented,
    // so a plain lock is the fallback — but we record which one we got.
    const result = el.requestPointerLock({ unadjustedMovement: true }) as
      | Promise<void>
      | undefined;

    if (result && typeof result.then === "function") {
      result
        .then(() => setRawInput("raw"))
        .catch(() => {
          setRawInput("os-adjusted");
          el.requestPointerLock();
        });
    } else {
      // Legacy synchronous signature: no way to tell, assume the worst.
      setRawInput("os-adjusted");
    }
  }, [targetRef]);

  const exit = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);

  useEffect(() => {
    const el = targetRef.current;

    const handleLockChange = () => {
      const isLocked = document.pointerLockElement === el;
      setLocked(isLocked);
      onLockChangeRef.current?.(isLocked);
    };

    const handleMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      // Every event must be summed. At 1000 Hz polling several arrive per frame,
      // and taking only the most recent one would silently discard mouse counts.
      onMoveRef.current(e.movementX, e.movementY);
    };

    document.addEventListener("pointerlockchange", handleLockChange);
    document.addEventListener("mousemove", handleMove);
    return () => {
      document.removeEventListener("pointerlockchange", handleLockChange);
      document.removeEventListener("mousemove", handleMove);
    };
  }, [targetRef]);

  return { locked, rawInput, request, exit };
}
