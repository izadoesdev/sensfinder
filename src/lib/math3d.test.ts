import { expect, test, describe } from "bun:test";
import {
  angleBetween,
  decomposeOffset,
  forward,
  offsetDirection,
  scale,
  taskAxis,
  yawPitchFromForward,
} from "./math3d";

describe("orientation", () => {
  test("zero yaw/pitch looks down -Z", () => {
    const f = forward(0, 0);
    expect(f[0]).toBeCloseTo(0, 10);
    expect(f[1]).toBeCloseTo(0, 10);
    expect(f[2]).toBeCloseTo(-1, 10);
  });

  test("positive yaw looks left (-X), matching three.js Y rotation", () => {
    expect(forward(90, 0)[0]).toBeCloseTo(-1, 10);
  });

  test("positive pitch looks up (+Y)", () => {
    expect(forward(0, 90)[1]).toBeCloseTo(1, 10);
  });

  test("forward and yawPitchFromForward are inverses", () => {
    for (const [y, p] of [
      [0, 0],
      [37, -12],
      [-140, 45],
      [179, 88],
    ]) {
      const r = yawPitchFromForward(forward(y, p));
      expect(r.yawDeg).toBeCloseTo(y, 8);
      expect(r.pitchDeg).toBeCloseTo(p, 8);
    }
  });
});

describe("spherical target placement", () => {
  test("offsetDirection lands at exactly the requested angular distance", () => {
    const base = forward(23, -8);
    for (const angle of [0.5, 7, 25, 90]) {
      for (const bearing of [0, 1, 2.5, -2]) {
        expect(angleBetween(base, offsetDirection(base, angle, bearing))).toBeCloseTo(angle, 8);
      }
    }
  });

  test("bearing 0 is horizontal-right, pi/2 is up", () => {
    const base = forward(0, 0);
    expect(offsetDirection(base, 10, 0)[0]).toBeGreaterThan(0); // +X = right
    expect(offsetDirection(base, 10, Math.PI / 2)[1]).toBeGreaterThan(0); // +Y = up
  });
});

describe("offset decomposition", () => {
  const spawn = forward(0, 0);
  const target = offsetDirection(spawn, 20, 0); // 20 deg to the right
  const axisAtSpawn = taskAxis(spawn, target);
  const axisAtTarget = scale(taskAxis(target, spawn), -1);

  test("displacement along the task axis reads out as the angle travelled", () => {
    const halfway = offsetDirection(spawn, 10, 0);
    const d = decomposeOffset(spawn, axisAtSpawn, halfway);
    expect(d.along).toBeCloseTo(10, 8);
    expect(d.perp).toBeCloseTo(0, 8);
  });

  test("landing past the target reads as positive endpoint error (overshoot)", () => {
    const past = offsetDirection(spawn, 23, 0);
    expect(decomposeOffset(target, axisAtTarget, past).along).toBeCloseTo(3, 6);
  });

  test("landing short reads as negative endpoint error (undershoot)", () => {
    const short = offsetDirection(spawn, 17, 0);
    expect(decomposeOffset(target, axisAtTarget, short).along).toBeCloseTo(-3, 6);
  });

  test("dead-centre reads as zero error", () => {
    const d = decomposeOffset(target, axisAtTarget, target);
    expect(d.along).toBeCloseTo(0, 10);
    expect(d.perp).toBeCloseTo(0, 10);
  });

  test("perpendicular error is signed and independent of along-axis error", () => {
    // Sit exactly on the target's great-circle distance but 2 deg above it.
    const above = offsetDirection(target, 2, Math.PI / 2);
    const d = decomposeOffset(target, axisAtTarget, above);
    expect(d.perp).toBeCloseTo(2, 6);
    expect(Math.abs(d.along)).toBeLessThan(0.01);
  });
});
