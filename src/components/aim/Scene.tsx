"use client";

/*
 * eslint-disable react-hooks/immutability
 *
 * The rule forbids mutating values returned from hooks. R3F's model is the opposite:
 * `useThree` hands you the live three.js camera and you mutate it, and per-frame
 * mutation is how you avoid re-rendering React at 240 Hz. Copying instead of mutating
 * would not be safer here, it would be broken.
 */
/* eslint-disable react-hooks/immutability */

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { AimEngine } from "@/lib/aimEngine";
import { DEG } from "@/lib/math3d";
import { verticalFovFromHorizontal } from "@/lib/fov";
import type { TargetPalette } from "@/lib/palettes";
import { Environment } from "./Environment";
import { Targets } from "./Targets";
import { Viewmodel } from "./Viewmodel";
import type { ShotFeedback } from "./feedback";

/**
 * Games quote *horizontal* field of view; three.js wants *vertical*. Converting with
 * the live aspect ratio keeps a degree of arc worth the same number of pixels on any
 * monitor — without it the task silently changes difficulty between displays and
 * sessions stop being comparable.
 */
function FovController({ horizontalFovDeg }: { horizontalFovDeg: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  useEffect(() => {
    camera.fov = verticalFovFromHorizontal(horizontalFovDeg, size.width / size.height);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, horizontalFovDeg]);

  return null;
}

/**
 * Drives the camera from the engine's orientation.
 *
 * The engine is the single source of truth for where the player is looking; React
 * never stores it. This runs at priority -1 so the orientation is committed before
 * anything else reads the camera in the same frame — the viewmodel copies the camera
 * quaternion, and a stale copy would make the gun visibly lag the crosshair.
 */
/**
 * Development-only handle on the live three.js scene and renderer.
 *
 * Rendering bugs and performance costs are measurable facts — draw calls, triangle
 * counts, what is actually in the graph — and guessing at them from screenshots wastes
 * far more time than exposing them does. Stripped from production builds.
 */
function DevHandle() {
  const state = useThree();
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __r3f_debug?: unknown }).__r3f_debug = state;
  }, [state]);
  return null;
}

function Rig({ engine }: { engine: AimEngine }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  useFrame(() => {
    engine.tick(performance.now());
    camera.rotation.set(engine.pitchDeg * DEG, engine.yawDeg * DEG, 0);
  }, -1);

  return null;
}

export function Scene({
  engine,
  feedback,
  horizontalFovDeg,
  showViewmodel,
  palette,
}: {
  engine: AimEngine;
  feedback: React.RefObject<ShotFeedback>;
  horizontalFovDeg: number;
  showViewmodel: boolean;
  palette: TargetPalette;
}) {
  return (
    <>
      <DevHandle />
      <FovController horizontalFovDeg={horizontalFovDeg} />
      <Rig engine={engine} />
      <Environment
        areaYawDeg={engine.scenario.areaYawDeg}
        areaPitchDeg={engine.scenario.areaPitchDeg}
      />
      <Targets engine={engine} feedback={feedback} palette={palette} />
      {showViewmodel && <Viewmodel feedback={feedback} />}
    </>
  );
}
