import { DEG, RAD } from "./math3d";

/**
 * Games quote *horizontal* field of view; three.js `PerspectiveCamera.fov` is
 * *vertical*. Getting this wrong does not just look off — it changes how many pixels
 * an angular degree covers, which changes how visible a near-miss is, which changes
 * measured accuracy. The task would silently get easier or harder on a different
 * aspect ratio, and sessions would stop being comparable.
 */
export function verticalFovFromHorizontal(horizontalFovDeg: number, aspect: number): number {
  return 2 * Math.atan(Math.tan((horizontalFovDeg / 2) * DEG) / aspect) * RAD;
}

export function horizontalFovFromVertical(verticalFovDeg: number, aspect: number): number {
  return 2 * Math.atan(Math.tan((verticalFovDeg / 2) * DEG) * aspect) * RAD;
}

/**
 * On-screen diameter, in pixels, of a target subtending `angularWidthDeg` at the
 * centre of the screen. Used to warn when a condition is too small to be rendered
 * fairly — a target thinner than a couple of pixels is an eyesight test, not an aim test.
 */
export function angularSizeToPixels(
  angularWidthDeg: number,
  horizontalFovDeg: number,
  viewportWidthPx: number,
): number {
  const halfFov = Math.tan((horizontalFovDeg / 2) * DEG);
  const halfTarget = Math.tan((angularWidthDeg / 2) * DEG);
  return (halfTarget / halfFov) * viewportWidthPx;
}
