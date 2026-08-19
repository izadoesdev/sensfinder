"use client";

/*
 * eslint-disable react-hooks/immutability
 *
 * `useThree` returns the live three.js scene and mutating it is the documented R3F
 * API — setting `scene.fog` is how fog is configured.
 */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DEG } from "@/lib/math3d";
import { SCENE, SCENE_LIGHTS } from "@/lib/theme";
import { TARGET_RADIUS } from "./Targets";

/**
 * The range.
 *
 * Measured cost of the whole thing: 6 draw calls, ~2,000 triangles, 2 textures. It was
 * briefly gutted on the assumption that it was responsible for frame drops; it never
 * was, and the detail is what makes turning legible. Environment richness is close to
 * free here — the only meaningful GPU cost in this scene is fill rate, which is
 * governed by resolution, not by how much is in the room.
 *
 * Everything is unlit. Environment brightness must not vary with view direction, or
 * target contrast would vary with it too.
 */

// Pulled in from a 48-unit stadium. Targets sit 20 units out, so a wall four times
// further made the whole range read as distant and the play area as a small window in
// it. Closer wall, same angular task — nothing the measurement sees has changed.
const RADIUS = 27;
const HEIGHT = 34;
const EYE_TO_FLOOR = 7;
const COLUMNS = 18;

function makeTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat: [number, number],
  anisotropy = 4,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawWall(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = SCENE.wall.base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  ctx.strokeStyle = SCENE.wall.seam;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  ctx.strokeStyle = SCENE.wall.inner;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  ctx.fillStyle = SCENE.wall.stud;
  for (const [x, y] of [
    [14, 14],
    [size - 14, 14],
    [14, size - 14],
    [size - 14, size - 14],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Vertical ribs. Evenly spaced so no direction is privileged; one draw call for all. */
function Columns() {
  const mesh = useMemo(() => {
    const height = HEIGHT - 9;
    const geo = new THREE.BoxGeometry(1.2, height, 1.2);
    const mat = new THREE.MeshBasicMaterial({ color: SCENE.column, fog: true });
    const inst = new THREE.InstancedMesh(geo, mat, COLUMNS);
    const m = new THREE.Matrix4();
    const y = -EYE_TO_FLOOR + height / 2;

    for (let i = 0; i < COLUMNS; i++) {
      // Offset by half a step so no column ever sits dead centre — a vertical bar
      // directly behind the crosshair competes with the target for attention.
      const a = ((i + 0.5) / COLUMNS) * Math.PI * 2;
      m.makeRotationY(-a);
      m.setPosition(Math.sin(a) * (RADIUS - 0.8), y, Math.cos(a) * (RADIUS - 0.8));
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }, []);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  return <primitive object={mesh} />;
}

/**
 * The edge of the play area, drawn on the wall.
 *
 * Targets never spawn outside it, so this is a promise rather than decoration: it shows
 * exactly how far the drill will ever ask you to turn.
 */
function Boundary({ yawDeg, pitchDeg }: { yawDeg: number; pitchDeg: number }) {
  const geometry = useMemo(() => {
    // Drawn at target depth, not on the wall: the frame marks the area you are
    // shooting into, and out on the wall it read as a window somewhere behind it.
    const r = TARGET_RADIUS + 0.3;
    const at = (yaw: number, pitch: number) => {
      const y = yaw * DEG;
      const p = pitch * DEG;
      const cp = Math.cos(p);
      return new THREE.Vector3(-Math.sin(y) * cp, Math.sin(p), -Math.cos(y) * cp).multiplyScalar(r);
    };

    // Top edge left-to-right, then bottom edge right-to-left. Drawn as a loop, the two
    // remaining sides close themselves, so the frame is one continuous line.
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) pts.push(at(-yawDeg + (2 * yawDeg * i) / steps, pitchDeg));
    for (let i = 0; i <= steps; i++) pts.push(at(yawDeg - (2 * yawDeg * i) / steps, -pitchDeg));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [yawDeg, pitchDeg]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineLoop>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={SCENE.boundary} transparent opacity={0.5} fog />
    </lineLoop>
  );
}

export function Environment({
  areaYawDeg,
  areaPitchDeg,
}: {
  areaYawDeg: number;
  areaPitchDeg: number;
}) {
  const scene = useThree((s) => s.scene);

  const wall = useMemo(() => makeTexture(drawWall, [14, 5]), []);

  useEffect(() => {
    // Fades to the wall's own tone, not to black, so distance reads as depth rather
    // than as the room ending.
    const prev = scene.fog;
    scene.fog = new THREE.Fog(SCENE.fog, 24, 70);
    return () => {
      scene.fog = prev;
    };
  }, [scene]);

  useEffect(() => () => wall.dispose(), [wall]);

  return (
    <group>
      <mesh>
        <cylinderGeometry args={[RADIUS, RADIUS, HEIGHT, 48, 1, true]} />
        <meshBasicMaterial map={wall} side={THREE.BackSide} fog />
      </mesh>

      <Columns />

      {/*
        Solid colour, no texture.

        A tiled texture on a ground plane is seen at a grazing angle, where the mip level
        needed varies steeply across the screen. That produced hard-edged vertical bands
        of different brightness — one sat dead ahead and read as a slab standing in the
        room. Confirmed by removing the map at runtime: the banding vanished completely
        and the surface rendered flat. Darker lines, finer tiling, higher anisotropy and
        swapping the fan for a quad all failed to fix it; not tiling does, and the wall
        carries the motion cues on its own.
      */}
      <mesh position={[0, -EYE_TO_FLOOR, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[(RADIUS + 6) * 2, (RADIUS + 6) * 2]} />
        <meshBasicMaterial color={SCENE.floor} fog />
      </mesh>

      <mesh position={[0, HEIGHT - EYE_TO_FLOOR - 10, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[(RADIUS + 6) * 2, (RADIUS + 6) * 2]} />
        <meshBasicMaterial color={SCENE.ceiling} fog />
      </mesh>

      {/* A lit band high on the wall — well above target height, so it adds depth
          without putting a high-contrast edge where targets appear. */}
      <mesh position={[0, 9.5, 0]}>
        <cylinderGeometry args={[RADIUS - 0.8, RADIUS - 0.8, 0.55, 48, 1, true]} />
        <meshBasicMaterial color={SCENE.lightBand} side={THREE.BackSide} toneMapped={false} />
      </mesh>

      <Boundary yawDeg={areaYawDeg} pitchDeg={areaPitchDeg} />

      {/* Lights exist only for the weapon — every world material here is unlit. */}
      <ambientLight intensity={SCENE_LIGHTS.ambient} />
      <directionalLight position={[-1.2, 2, 1.4]} intensity={SCENE_LIGHTS.key} />
      <directionalLight position={[2, -0.6, -1]} intensity={SCENE_LIGHTS.rim} color={SCENE_LIGHTS.rimColor} />
    </group>
  );
}
