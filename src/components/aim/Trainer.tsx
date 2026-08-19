"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AimEngine } from "@/lib/aimEngine";
import { forward } from "@/lib/math3d";
import { rangeAudio } from "@/lib/audio";
import { GAMES, type GameId } from "@/lib/games";
import type { TargetPalette } from "@/lib/palettes";
import { SCENE } from "@/lib/theme";
import type { ScenarioDef } from "@/lib/scenario";
import { cm360 as toCm360, quantiseSens, sensFromCm360 } from "@/lib/sens";
import type { Shot } from "@/lib/types";
import { usePointerLock, type RawInputStatus } from "@/hooks/usePointerLock";
import { Scene } from "./Scene";
import { Hud } from "./Hud";
import { createFeedback } from "./feedback";
import { Badge, Button, Kbd, NumberInput } from "@/components/ui";

interface Props {
  scenario: ScenarioDef;
  gameId: GameId;
  dpi: number;
  sens: number;
  degPerCount: number;
  cm360: number;
  /** Correction factor from DPI verification. 1 until the user has measured it. */
  inputScale: number;
  inputScaleVerified: boolean;
  showViewmodel: boolean;
  audioEnabled: boolean;
  palette: TargetPalette;
  onFinish: (shots: Shot[]) => void;
  onApplySens: (sens: number) => void;
  onQuit: () => void;
}

export function Trainer({
  scenario,
  gameId,
  dpi,
  sens,
  degPerCount,
  cm360,
  inputScale,
  inputScaleVerified,
  showViewmodel,
  audioEnabled,
  palette,
  onFinish,
  onApplySens,
  onQuit,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const feedback = useRef(createFeedback());
  const [stats, setStats] = useState({ fired: 0, hits: 0, lastHit: false });

  // One engine per mount. The sensitivity under test defines the block, so the parent
  // remounts this component (via `key`) when it changes rather than mutating in place.
  const [engine] = useState(
    () =>
      new AimEngine({
        sessionId: `s-${Date.now()}`,
        blockId: `b-${cm360.toFixed(2)}`,
        scenario,
        degPerCount,
        cm360,
        seed: Math.floor(Math.random() * 1e9),
      }),
  );

  useEffect(() => {
    rangeAudio.enabled = audioEnabled;
  }, [audioEnabled]);

  const handleMove = useCallback(
    (dx: number, dy: number) => {
      engine.applyInput(dx * inputScale, dy * inputScale);
    },
    [engine, inputScale],
  );

  const handleLockChange = useCallback(
    (isLocked: boolean) => {
      const now = performance.now();
      if (isLocked && engine.state === "idle") engine.start(now);
      // Losing lock mid-shot would inflate that shot's movement time; re-issue it.
      else if (!isLocked) engine.restartActiveShot(now);
    },
    [engine],
  );

  const { locked, rawInput, request, exit } = usePointerLock(containerRef, {
    onMove: handleMove,
    onLockChange: handleLockChange,
  });

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement !== containerRef.current) return;

      // Capture the target before firing — `fire` despawns it and spawns the next one,
      // and the death effect needs to bloom from where the old one stood.
      const deadDir = engine.targetDir;
      const deadWidth = engine.currentWidth;

      const shot = engine.fire(performance.now());
      if (!shot) return;

      const fb = feedback.current;
      fb.seq++;
      fb.at = performance.now();
      fb.hit = shot.hit;
      fb.impact = forward(engine.yawDeg, engine.pitchDeg);
      fb.deadDir = deadDir;
      fb.deadWidth = deadWidth;

      rangeAudio.shot();
      if (shot.hit) rangeAudio.hit();
      else rangeAudio.miss();

      setStats((s) => ({
        fired: s.fired + 1,
        hits: s.hits + (shot.hit ? 1 : 0),
        lastHit: shot.hit,
      }));

      if (engine.state === "finished") {
        rangeAudio.finish();
        exit();
        onFinish(engine.shots);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [engine, exit, onFinish]);

  const begin = () => {
    rangeAudio.resume(); // must happen inside a user gesture
    request();
  };

  /**
   * The 3D tree is held constant across shots.
   *
   * Every shot calls `setStats` for the HUD, which re-renders this component — and
   * without memoising, that re-renders `<Scene>` and makes R3F reconcile the entire
   * scene graph several times a second. Nothing in there depends on the shot counter:
   * the whole 3D layer reads from the engine and the feedback ref. Holding the element
   * still means the HUD updates and the renderer is left alone.
   */
  const scene = useMemo(
    () => (
      <Scene
        engine={engine}
        feedback={feedback}
        horizontalFovDeg={scenario.fovDeg}
        showViewmodel={showViewmodel}
        palette={palette}
      />
    ),
    [engine, scenario.fovDeg, showViewmodel, palette],
  );

  return (
    <div
      ref={containerRef}
      // The pause overlay covers the screen whenever we are unlocked and owns its own
      // click handling, so the container does not also need to be a click target —
      // two overlapping handlers made stray clicks inside the menu resume the session.
      className={`relative h-dvh w-full select-none overflow-hidden bg-page ${
        locked ? "cursor-none" : ""
      }`}
    >
      <Canvas
        camera={{ position: [0, 0, 0], near: 0.02, far: 220 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        // Colours here are authored directly in sRGB — target contrast, range tone and
        // crosshair legibility were all chosen as literal values. Filmic tone mapping
        // would remap every one of them, so the renderer is left linear.
        flat
        // Capped below the display's native ratio. Full 2x on a 4K panel is four times
        // the fragment work for an edge that antialiasing already resolves, and frame
        // pacing feeds directly into the movement times being measured — a dropped
        // frame is a corrupted data point, not just a visual hitch.
        dpr={[1, 1.5]}
      >
        <color attach="background" args={[SCENE.fog]} />
        {scene}
      </Canvas>

      <Hud
        scenarioName={scenario.name}
        cm360={cm360}
        fired={stats.fired}
        hits={stats.hits}
        total={scenario.shotCount}
        lastShotSeq={stats.fired}
        lastShotHit={stats.lastHit}
        rawInput={rawInput}
        inputScaleVerified={inputScaleVerified}
        crosshairColor={palette.crosshair}
      />

      {!locked && (
        <PauseOverlay
          fired={stats.fired}
          remaining={scenario.shotCount - stats.fired}
          rawInput={rawInput}
          gameId={gameId}
          dpi={dpi}
          sens={sens}
          cm360={cm360}
          onResume={begin}
          onApplySens={onApplySens}
          onQuit={onQuit}
        />
      )}
    </div>
  );
}

/**
 * A conventional pause menu: a stack of full-width actions with the exit in the stack,
 * not hidden as a faint link underneath it.
 *
 * Changing sensitivity necessarily restarts the round. A block is defined by the single
 * sensitivity it was shot at, and splicing two into one result would make every
 * statistic derived from it meaningless — so the button says so rather than surprising
 * anyone.
 */
function PauseOverlay({
  fired,
  remaining,
  rawInput,
  gameId,
  dpi,
  sens,
  cm360,
  onResume,
  onApplySens,
  onQuit,
}: {
  fired: number;
  remaining: number;
  rawInput: RawInputStatus;
  gameId: GameId;
  dpi: number;
  sens: number;
  cm360: number;
  onResume: () => void;
  onApplySens: (sens: number) => void;
  onQuit: () => void;
}) {
  const [draft, setDraft] = useState(sens);
  const [editing, setEditing] = useState(false);
  const game = GAMES[gameId];
  const draftCm = toCm360(gameId, draft, dpi);
  const changed = Math.abs(draft - sens) > game.sensStep / 2;
  const started = fired > 0;

  const nudge = (deltaCm: number) => {
    setDraft(quantiseSens(gameId, sensFromCm360(gameId, draftCm + deltaCm, dpi)));
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-page/92 backdrop-blur-sm"
      onClick={onResume}
    >
      <div
        className="w-full max-w-sm animate-rise cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <Badge tone={started ? "neutral" : "accent"}>
            {started ? `${remaining} shots left` : `${remaining} shots`}
          </Badge>
          <h2 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.025em]">
            {started ? "Paused" : "Ready"}
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-text-2">
            {started
              ? "Your current target was reset so the timing stays clean."
              : "Shoot each target as soon as it appears. Misses count."}
          </p>
        </div>

        {rawInput === "os-adjusted" && (
          <p className="mt-5 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-[13px] leading-relaxed text-warn">
            This browser is applying mouse acceleration, so your results won&rsquo;t be
            accurate. Use Chrome or Edge.
          </p>
        )}

        <div className="mt-7 space-y-2">
          <Button variant="primary" size="lg" className="w-full" onClick={onResume}>
            {started ? "Resume" : "Start"}
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="w-full justify-between"
            onClick={() => setEditing((v) => !v)}
          >
            <span>Sensitivity</span>
            <span className="font-mono text-[13px] tabular text-text-2">
              {cm360.toFixed(1)} cm/360
            </span>
          </Button>

          {editing && (
            <div className="space-y-2.5 rounded-lg border border-border bg-panel p-4">
              <div className="flex items-end gap-2">
                <Button variant="secondary" onClick={() => nudge(-2)}>
                  −2
                </Button>
                <div className="flex-1">
                  <NumberInput
                    label={`${game.name} sens`}
                    value={draft}
                    onChange={setDraft}
                    min={game.sensRange[0]}
                    max={game.sensRange[1]}
                    step={game.sensStep}
                    largeStep={game.sensStep * 10}
                    format={{ maximumFractionDigits: 3 }}
                  />
                </div>
                <Button variant="secondary" onClick={() => nudge(2)}>
                  +2
                </Button>
              </div>
              <Button
                variant="primary"
                disabled={!changed}
                className="w-full"
                onClick={() => onApplySens(draft)}
              >
                {changed ? `Use ${draftCm.toFixed(1)} cm/360` : "No change"}
              </Button>
              <p className="text-xs leading-relaxed text-text-3">
                Restarts the round — a result only counts if the whole round used one
                setting.
              </p>
            </div>
          )}

          <Button variant="secondary" size="lg" className="w-full" onClick={onQuit}>
            Back to setup
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-text-3">
          <Kbd>Esc</Kbd>
          <span>pauses at any time</span>
        </div>
      </div>
    </div>
  );
}
