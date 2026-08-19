"use client";

import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ShotFeedback } from "./feedback";

/**
 * The first-person weapon.
 *
 * IMPORTANT: recoil, sway and bob are *purely cosmetic*. They move this group only,
 * never the engine's yaw/pitch. A viewmodel that kicked the camera would inject
 * rotation the player did not ask for, and every endpoint-error measurement after it
 * would be recording the game's recoil rather than the player's aim.
 *
 * The model is "Assault Rifle" by Quaternius, CC0 1.0 — see
 * `public/models/ATTRIBUTION.md`.
 */

const MODEL_URL = "/models/rifle.glb";

/*
 * The source asset is authored 5.2 units long, pointing down +X, and near-black
 * (base colour 0.02 at metalness 0.4). Three corrections, all baked in here so the
 * rest of the scene can stay ignorant of the asset's quirks:
 *
 *  - rotate +90° about Y so the barrel points down -Z, the direction the camera looks
 *  - scale to a viewmodel-sized ~0.85 units
 *  - relight the materials: a physically-metallic surface takes its colour from
 *    reflections, and with no environment map in this scene there is nothing to
 *    reflect, so the original values render as a black silhouette
 */
const MODEL_SCALE = 0.135;
const MODEL_YAW = Math.PI / 2;

const GUNMETAL: Record<string, string> = {
  Main: "#525b6a",
  MainDark: "#2b313b",
  MainLight: "#6f7887",
};

function Rifle() {
  const { scene } = useGLTF(MODEL_URL);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      mesh.material = new THREE.MeshStandardMaterial({
        color: GUNMETAL[src.name] ?? "#525b6a",
        metalness: 0.15,
        roughness: 0.55,
      });
    });
    return clone;
  }, [scene]);

  return (
    <primitive
      object={model}
      scale={MODEL_SCALE}
      rotation={[0, MODEL_YAW, 0]}
      position={[0, 0, -0.34]}
    />
  );
}

/*
 * A missing or broken model renders nothing rather than taking the session down with
 * it. The weapon is decoration; the measurement is not.
 */
class ModelBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Viewmodel({ feedback }: { feedback: React.RefObject<ShotFeedback> }) {
  const camera = useThree((s) => s.camera);

  const pivot = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Group>(null);
  const flashLight = useRef<THREE.PointLight>(null);

  const seen = useRef(0);
  const recoil = useRef(0);
  const flashUntil = useRef(0);
  const sway = useRef({ x: 0, y: 0 });
  const lastRot = useRef({ yaw: 0, pitch: 0 });
  const clock = useRef(0);

  useFrame((_, dt) => {
    const p = pivot.current;
    const r = rig.current;
    if (!p || !r) return;

    const step = Math.min(dt, 1 / 30); // a stalled frame must not launch the gun
    clock.current += step;

    // The gun rides the camera exactly; everything below is offset in its local space.
    p.quaternion.copy(camera.quaternion);

    // Sway: lag the viewmodel behind fast camera movement, then settle. Purely feel.
    const yaw = camera.rotation.y;
    const pitch = camera.rotation.x;
    const dYaw = yaw - lastRot.current.yaw;
    const dPitch = pitch - lastRot.current.pitch;
    lastRot.current = { yaw, pitch };

    const settle = 1 - Math.exp(-step * 9);
    sway.current.x += (THREE.MathUtils.clamp(dYaw * 2.2, -0.05, 0.05) - sway.current.x) * settle;
    sway.current.y +=
      (THREE.MathUtils.clamp(dPitch * 2.2, -0.05, 0.05) - sway.current.y) * settle;

    // Recoil impulse, triggered by a new shot and decaying exponentially.
    if (feedback.current.seq !== seen.current) {
      seen.current = feedback.current.seq;
      recoil.current = 1;
      flashUntil.current = performance.now() + 38;
      if (flash.current) flash.current.rotation.z = Math.random() * Math.PI;
    }
    recoil.current *= Math.exp(-step * 16);

    const kick = recoil.current;
    const idle = Math.sin(clock.current * 1.6) * 0.0013;

    r.position.set(
      0.235 + sway.current.x,
      -0.30 + sway.current.y + idle - kick * 0.008,
      -0.42 + kick * 0.045,
    );
    r.rotation.set(
      -0.03 + kick * 0.24 + sway.current.y * 0.8,
      -0.1 - sway.current.x * 1.4,
      0.03 + kick * 0.035,
    );

    const lit = performance.now() < flashUntil.current;
    if (flash.current) {
      flash.current.visible = lit;
      if (lit) flash.current.scale.setScalar(0.7 + Math.random() * 0.5);
    }
    if (flashLight.current) flashLight.current.intensity = lit ? 5 : 0;
  });

  return (
    <group ref={pivot}>
      <group ref={rig}>
        <ModelBoundary fallback={null}>
          <Suspense fallback={null}>
            <Rifle />
          </Suspense>
        </ModelBoundary>

        <group ref={flash} position={[0, 0.02, -0.78]} visible={false}>
          <mesh>
            <planeGeometry args={[0.12, 0.12]} />
            <meshBasicMaterial
              color="#ffd9a0"
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh scale={0.45}>
            <planeGeometry args={[0.12, 0.12]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>

        <pointLight
          ref={flashLight}
          position={[0, 0.03, -0.78]}
          color="#ffcf8a"
          intensity={0}
          distance={4}
          decay={2}
        />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
