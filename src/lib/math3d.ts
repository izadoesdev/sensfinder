/**
 * Minimal vector helpers. Deliberately dependency-free so the aim engine can be
 * unit-tested without a WebGL context.
 *
 * Convention matches three.js: camera sits at the origin looking down -Z,
 * +X is right, +Y is up, rotation order YXZ (yaw then pitch).
 */
export type Vec3 = readonly [number, number, number];

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function normalise(a: Vec3): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Forward unit vector for a yaw/pitch pair in degrees.
 * yaw = rotation about +Y (positive looks left), pitch = rotation about +X (positive looks up).
 */
export function forward(yawDeg: number, pitchDeg: number): Vec3 {
  const y = yawDeg * DEG;
  const p = pitchDeg * DEG;
  const cp = Math.cos(p);
  return [-Math.sin(y) * cp, Math.sin(p), -Math.cos(y) * cp];
}

/** Inverse of `forward`. */
export function yawPitchFromForward(f: Vec3): { yawDeg: number; pitchDeg: number } {
  return {
    yawDeg: Math.atan2(-f[0], -f[2]) * RAD,
    pitchDeg: Math.asin(clamp(f[1], -1, 1)) * RAD,
  };
}

/** Angle between two unit vectors, in degrees. */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.acos(clamp(dot(a, b), -1, 1)) * RAD;
}

const WORLD_UP: Vec3 = [0, 1, 0];

/**
 * Orthonormal tangent basis at a view direction: `right` and `up` span the plane
 * perpendicular to `dir`. Angular offsets are expressed in this basis, which is
 * what makes "along the task axis" vs "perpendicular to it" well defined.
 */
export function tangentBasis(dir: Vec3): { right: Vec3; up: Vec3 } {
  // Degenerate when looking straight up/down; pitch is clamped to +-89 so this is safe.
  const right = normalise(cross(dir, WORLD_UP));
  const up = normalise(cross(right, dir));
  return { right, up };
}

/**
 * Point at angular distance `angleDeg` from `dir`, in tangent direction `bearingRad`
 * (0 = right, pi/2 = up). Exact spherical construction — no small-angle approximation.
 */
export function offsetDirection(dir: Vec3, angleDeg: number, bearingRad: number): Vec3 {
  const { right, up } = tangentBasis(dir);
  const t = add(scale(right, Math.cos(bearingRad)), scale(up, Math.sin(bearingRad)));
  const a = angleDeg * DEG;
  return normalise(add(scale(dir, Math.cos(a)), scale(t, Math.sin(a))));
}

/** Rotate `origin` by `angleDeg` along a known tangent direction. */
export function alongAxis(origin: Vec3, axis: Vec3, angleDeg: number): Vec3 {
  const a = angleDeg * DEG;
  return normalise(add(scale(origin, Math.cos(a)), scale(axis, Math.sin(a))));
}

/**
 * Signed angular offset of `point` relative to `origin`, decomposed into a
 * component along `axis` (a tangent direction at `origin`) and one perpendicular to it.
 * Used both for endpoint error (origin = target) and flick displacement (origin = spawn crosshair).
 */
export function decomposeOffset(
  origin: Vec3,
  axis: Vec3,
  point: Vec3,
): { along: number; perp: number } {
  const perpAxis = normalise(cross(origin, axis));
  // atan2 against the origin component keeps this exact for large angles too.
  const alongComp = dot(point, axis);
  const perpComp = dot(point, perpAxis);
  const fwdComp = dot(point, origin);
  return {
    along: Math.atan2(alongComp, fwdComp) * RAD,
    // Negated so that +perp is "up" given axis-right-handedness (cross(origin, axis) points down).
    perp: -Math.atan2(perpComp, fwdComp) * RAD,
  };
}

/** Tangent direction at `from` pointing along the great circle toward `to`. */
export function taskAxis(from: Vec3, to: Vec3): Vec3 {
  const projected = add(to, scale(from, -dot(to, from)));
  const len = Math.hypot(projected[0], projected[1], projected[2]);
  if (len < 1e-9) {
    // Target is exactly under the crosshair; any tangent works.
    return tangentBasis(from).right;
  }
  return scale(projected, 1 / len);
}
