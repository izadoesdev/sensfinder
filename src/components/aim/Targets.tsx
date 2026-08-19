"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AimEngine } from "@/lib/aimEngine";
import { DEG } from "@/lib/math3d";
import type { TargetPalette } from "@/lib/palettes";
import type { ShotFeedback } from "./feedback";

/**
 * Distance from the eye to every target.
 *
 * Only the angle a target subtends matters to the task, so this is purely a staging
 * choice — and it is exported so the play-area frame can be drawn at the same depth.
 * Drawn out on the far wall instead, the frame reads as a distant window rather than
 * as the area you are actually shooting into.
 */
export const TARGET_RADIUS = 20;
const HIT_MS = 190;
const MISS_MS = 620;

/** World radius of a disc that subtends `angularWidthDeg` at TARGET_RADIUS. */
function worldRadius(angularWidthDeg: number): number {
  return TARGET_RADIUS * Math.tan((angularWidthDeg / 2) * DEG);
}


/**
 * The live target: a disc turned to face the eye, not a sphere.
 *
 * A sphere renders 768 triangles for a silhouette a 32-triangle disc gives exactly —
 * the outline is a circle of the same angular size either way — and a sphere's edge is
 * shaded by its own curvature, going soft at small sizes where legibility matters most.
 *
 * It appears instantly. An opacity ramp on spawn reads as a pulse right after the
 * previous target dies, and "is it there yet" is not a question a reaction-time
 * measurement should have to answer.
 */
function LiveTarget({ engine, palette }: { engine: AimEngine; palette: TargetPalette }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(palette.target), [palette.target]);

  useFrame(() => {
    const m = mesh.current;
    if (!m || !material.current || !ring.current) return;

    const dir = engine.targetDir;
    if (!dir) {
      m.visible = false;
      return;
    }

    m.visible = true;
    m.position.set(dir[0] * TARGET_RADIUS, dir[1] * TARGET_RADIUS, dir[2] * TARGET_RADIUS);
    m.lookAt(0, 0, 0);

    const r = worldRadius(engine.currentWidth);
    m.scale.setScalar(r);
    ring.current.scale.setScalar(r);
    material.current.color.copy(color);
  });

  return (
    <mesh ref={mesh} visible={false} renderOrder={2}>
      <circleGeometry args={[1, 32]} />
      {/* depthTest off so the viewmodel can never hide a target: a shot you could not
          see is a broken trial, not a hard one. */}
      <meshBasicMaterial ref={material} toneMapped={false} depthTest={false} />
      {/* A dark rim drawn *inside* the silhouette — sharpens the edge against any
          background without making the target read as bigger than its hit area. */}
      <mesh ref={ring} renderOrder={2}>
        <ringGeometry args={[0.88, 1, 32]} />
        <meshBasicMaterial
          color="#12151a"
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </mesh>
  );
}

/**
 * Hit and miss feedback.
 *
 * Driven off the shared feedback ref rather than React state, so it starts on the very
 * next frame without re-rendering anything.
 *
 * A hit throws a ring outward from where the target stood; a miss leaves a small mark
 * exactly where the crosshair was. Different shapes, different motion — the distinction
 * survives every colour-vision deficiency without relying on hue.
 *
 * Neither uses additive blending. An additive bloom over the spot you were just looking
 * at reads as a flash on every single hit, which is exhausting over seventy shots and
 * masks the next target's appearance. The miss mark also lingers longer than the hit
 * ring, because it is information: its scatter across a session *is* the endpoint
 * distribution the analysis works from.
 */
function ShotEffects({
  feedback,
  palette,
}: {
  feedback: React.RefObject<ShotFeedback>;
  palette: TargetPalette;
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const mark = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const markMat = useRef<THREE.MeshBasicMaterial>(null);

  const hitColor = useMemo(() => new THREE.Color(palette.hit), [palette.hit]);
  const missColor = useMemo(() => new THREE.Color(palette.miss), [palette.miss]);

  const seen = useRef(0);
  const startedAt = useRef(-1);
  const wasHit = useRef(false);
  const baseScale = useRef(1);

  useFrame(() => {
    const g = group.current;
    if (!g || !ringMat.current || !markMat.current || !ring.current || !mark.current) return;

    const fb = feedback.current;

    if (fb.seq !== seen.current) {
      seen.current = fb.seq;
      startedAt.current = performance.now();
      wasHit.current = fb.hit;

      const dir = fb.hit && fb.deadDir ? fb.deadDir : fb.impact;
      g.position.set(dir[0] * TARGET_RADIUS, dir[1] * TARGET_RADIUS, dir[2] * TARGET_RADIUS);
      g.lookAt(0, 0, 0);

      baseScale.current = worldRadius(fb.hit ? fb.deadWidth : 0.55);
      ringMat.current.color.copy(fb.hit ? hitColor : missColor);
      markMat.current.color.copy(missColor);
      ring.current.visible = fb.hit;
      mark.current.visible = !fb.hit;
      mark.current.scale.setScalar(baseScale.current);
    }

    if (startedAt.current < 0) {
      g.visible = false;
      return;
    }

    const elapsed = performance.now() - startedAt.current;
    const life = wasHit.current ? HIT_MS : MISS_MS;
    if (elapsed >= life) {
      g.visible = false;
      return;
    }

    g.visible = true;
    const t = elapsed / life;

    if (wasHit.current) {
      const ease = 1 - Math.pow(1 - t, 3);
      ring.current.scale.setScalar(baseScale.current * (1 + ease * 1.4));
      ringMat.current.opacity = Math.pow(1 - t, 1.4) * 0.9;
    } else {
      markMat.current.opacity = Math.pow(1 - t, 2) * 0.8;
    }
  });

  return (
    <group ref={group} visible={false} renderOrder={3}>
      <mesh ref={ring}>
        <ringGeometry args={[0.86, 1, 32]} />
        <meshBasicMaterial
          ref={ringMat}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={mark}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial
          ref={markMat}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function Targets({
  engine,
  feedback,
  palette,
}: {
  engine: AimEngine;
  feedback: React.RefObject<ShotFeedback>;
  palette: TargetPalette;
}) {
  return (
    <>
      <LiveTarget engine={engine} palette={palette} />
      <ShotEffects feedback={feedback} palette={palette} />
    </>
  );
}
