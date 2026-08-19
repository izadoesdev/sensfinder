"use client";

import type { RawInputStatus } from "@/hooks/usePointerLock";

/**
 * The HUD shows progress and nothing else about how the player is aiming.
 *
 * That is a measurement decision, not a design one. A live "you overshot by 4%"
 * readout would let the player correct mid-session — and the systematic bias they
 * corrected away is precisely the quantity the session exists to estimate. Accuracy
 * and shot count are safe because they do not reveal the *direction* of the error.
 */
export function Hud({
  scenarioName,
  cm360,
  fired,
  hits,
  total,
  lastShotSeq,
  lastShotHit,
  rawInput,
  inputScaleVerified,
  crosshairColor,
}: {
  scenarioName: string;
  cm360: number;
  fired: number;
  hits: number;
  total: number;
  lastShotSeq: number;
  lastShotHit: boolean;
  rawInput: RawInputStatus;
  inputScaleVerified: boolean;
  crosshairColor: string;
}) {
  const accuracy = fired ? hits / fired : 0;
  const progress = Math.min(1, fired / total);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-3">
            {scenarioName}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span className="tabular text-3xl leading-none text-text">{fired}</span>
            <span className="text-lg leading-none text-text-3">/ {total}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-3">
            accuracy
          </div>
          <div className="mt-1 font-mono text-3xl leading-none tabular text-text">
            {(accuracy * 100).toFixed(0)}
            <span className="text-lg text-text-3">%</span>
          </div>
          <div className="mt-3 font-mono text-sm tabular text-text-2">
            {cm360.toFixed(1)} cm/360
          </div>
          {rawInput === "os-adjusted" && (
            <div className="mt-1 text-xs text-warn">OS-adjusted input</div>
          )}
          {!inputScaleVerified && <div className="text-xs text-warn">DPI unverified</div>}
        </div>
      </div>

      <Crosshair
        lastShotSeq={lastShotSeq}
        lastShotHit={lastShotHit}
        color={crosshairColor}
      />

      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto mb-5 h-[3px] w-[min(560px,70vw)] overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent-9 transition-[width] duration-200 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Crosshair({
  lastShotSeq,
  lastShotHit,
  color,
}: {
  lastShotSeq: number;
  lastShotHit: boolean;
  color: string;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
        {/* Outline first, then the bright core: keeps the crosshair readable against a
            target that is nearly the same luminance as the reticle. */}
        <g stroke="#000" strokeOpacity="0.8" strokeWidth="3.4" strokeLinecap="butt">
          <Ticks />
        </g>
        <g stroke={color} strokeWidth="1.6" strokeLinecap="butt">
          <Ticks />
        </g>
        <circle cx="17" cy="17" r="0.9" fill={color} />
      </svg>

      {/* Hit and miss differ by shape, not only colour: a hit closes inward with four
          diagonals, a miss opens outward as a square. Readable in any palette. */}
      {lastShotSeq > 0 && (
        <svg
          key={lastShotSeq}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-hitmark"
          width="34"
          height="34"
          viewBox="0 0 34 34"
          aria-hidden
        >
          <g stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
            {lastShotHit ? (
              <>
                <line x1="7" y1="7" x2="12" y2="12" />
                <line x1="27" y1="7" x2="22" y2="12" />
                <line x1="7" y1="27" x2="12" y2="22" />
                <line x1="27" y1="27" x2="22" y2="22" />
              </>
            ) : (
              <rect x="8" y="8" width="18" height="18" strokeOpacity="0.7" />
            )}
          </g>
        </svg>
      )}
    </div>
  );
}

function Ticks() {
  return (
    <>
      <line x1="17" y1="5" x2="17" y2="12" />
      <line x1="17" y1="22" x2="17" y2="29" />
      <line x1="5" y1="17" x2="12" y2="17" />
      <line x1="22" y1="17" x2="29" y2="17" />
    </>
  );
}
