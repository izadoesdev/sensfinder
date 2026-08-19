# SensFinder

An aim trainer that **measures** your ideal mouse sensitivity instead of guessing it.

See [PRD.md](./PRD.md) for the product thesis, research grounding and roadmap.

```bash
bun install
bun run dev     # http://localhost:3000
bun test        # 45 tests, no browser needed
```

## What is built (MVP: "Recalibrate")

A single-block flick trainer that estimates **calibration gain** — the sensitivity your
muscle memory is already tuned to — from the way you systematically over- or under-shoot.

1. `/` — setup: game, DPI, sensitivity, pad width, grip. Shows live cm/360, eDPI, deg/mm,
   pre-flight sanity checks, and an empirical DPI verification tool.
2. `/train` — the trainer. Pointer-locked 3D flick scenario, ~72 shots, ~3 minutes.
3. Session report — calibration gain with a 95% CI, recommended in-game sensitivity,
   ISO 9241-9 throughput, and a per-difficulty breakdown.

## Architecture

```
src/lib/          pure TypeScript, zero React and zero three.js — all of it unit-tested
  games.ts          yaw constants, gated behind a `verified` flag
  sens.ts           cm/360 <-> deg/count <-> in-game sens, cross-game conversion, sanity checks
  math3d.ts         spherical geometry: target placement, task-axis decomposition
  fov.ts            horizontal <-> vertical FOV, angular size in pixels
  scenario.ts       task geometry (from the NVIDIA study), balanced shuffled shot order
  aimEngine.ts      camera state, hit testing, per-shot telemetry
  analysis.ts       submovement detection, Fitts throughput, calibration-gain regression
  types.ts          Shot / TraceSample — the data model

src/components/aim/
  Trainer.tsx       canvas, HUD, pointer lock, session lifecycle
  Scene.tsx         R3F scene: camera rig, room, target
  SessionReport.tsx results
  DpiCheck.tsx      empirical input calibration

src/hooks/usePointerLock.ts    raw-input acquisition and fallback detection
src/store/settings.ts          persisted user settings
```

**The engine is deliberately free of React and three.js.** Everything that has to be
*correct* — the sensitivity math, the geometry, the statistics — is plain TypeScript that
runs under `bun test` in 70 ms. React only reads from it.

## Measurement decisions that matter

- **Device-independent internally.** All math is in degrees-per-mouse-count; a game's
  sensitivity number is a display concern. The optimiser will be game-agnostic for free.
- **Raw input, or say so.** `requestPointerLock({ unadjustedMovement: true })` is
  Chrome/Edge only. Elsewhere OS mouse acceleration stays in the pipeline, which
  invalidates measurements rather than merely adding noise — so the UI says so loudly.
- **DPI is measured, not trusted.** Browsers cannot read DPI, and `movementX` is affected
  by device pixel ratio and page zoom. Both show up as one constant multiplier, so the
  user drags a ruler-measured distance and we solve for it.
- **Input is flushed before hit testing.** A click can land between frames; evaluating
  against a stale camera would discard real movement and bias endpoint error.
- **Misses count.** Every click ends the shot. Effective width is defined over the spread
  of *all* endpoints — discarding misses would make the accuracy half of throughput
  meaningless.
- **Transients are excluded, not deleted.** The first 6 shots of a block are flagged as
  visuomotor re-adaptation and kept out of the fits.
- **Interrupted shots are re-issued.** Losing pointer lock mid-shot would record a
  multi-second "flick".
- **FOV is converted properly.** Games quote horizontal FOV, three.js wants vertical.
  Getting it wrong silently changes task difficulty across monitors.
- **Targets are unlit.** Shaded targets change contrast with position, which changes
  detection time — a confound sitting right on top of the effect being measured.

## What the tests actually prove

Beyond unit coverage, the suite runs a **simulated player with a known injected bias**
through the real engine at realistic frame timings, then checks the analysis recovers it:

- Moving exactly `cm/360` centimetres of mouse produces exactly 360°.
- A 12% injected overshoot is recovered as gain 1.12 with 1.0 outside the CI.
- An 8% injected undershoot is recovered as 0.92.
- A player with no bias is correctly reported as **inconclusive** rather than given a
  spurious recommendation.

That last one is the point. A pipeline that always produces a confident number is worse
than useless.

## Next

Per the PRD roadmap: the Monte Carlo power analysis (§12 Q1) comes before the V1
optimiser — it decides whether a 15-minute multi-block session can resolve a 5%
throughput difference at realistic human variance, or whether V1 needs a different shape.
