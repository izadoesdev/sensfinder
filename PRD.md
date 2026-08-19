# PRD — SensFinder (working title)

**An aim trainer that measures your ideal mouse sensitivity instead of guessing it.**

Version 0.1 · 2026-08-19 · Owner: Issa

---

## 1. Problem

Sensitivity advice in FPS games is folklore. Recommendations differ by **10x or more**, and the standard advice ("use what feels comfortable", "copy TenZ") gives players no way to know if their current setting is holding them back. Players churn through settings for months, resetting their muscle memory each time, with no measurement loop.

There is real science here that almost no consumer product uses. The only peer-reviewed user study of mouse sensitivity in first-person targeting tasks (Boudaoud & Spjut, NVIDIA, IEEE ToG 2023) found:

- A **statistically significant optimal range exists** — it is not purely preference.
- Across 13 experienced FPS players, everyone's optimum fell inside **0.45–1.8 °/mm (20–80 cm/360)** — a 4x band.
- The optimum comes from a **speed–precision tradeoff**: too high → more corrective submovements; too low → capped rotation speed.
- The optimum **shifts with task difficulty**: lower sens helps small/far targets (high Index of Difficulty), higher sens helps large/near targets.

So the answer is personal, measurable, and task-dependent — exactly the shape of problem an instrumented trainer can solve and a static calculator cannot.

**Competitive gap.** eDPI/cm-360 calculators do arithmetic only (they convert, they don't recommend). 3D Aim Trainer's "Sensitivity Finder" runs 2–5 minutes and outputs a number with no disclosed methodology, no confidence, no per-task breakdown. KovaaK's/Aim Lab produce rich telemetry but leave the analysis to the player. Nobody ships a **transparent, statistically honest, measurement-driven sensitivity optimizer**.

---

## 2. Product thesis

> Run a short, properly-designed experiment on the player. Estimate the sensitivity that maximizes their measured aiming throughput, report it **with a confidence interval and a plateau**, and explain the reasoning in plain language.

Three things this product must never do:
1. Output a single decimal with false precision when the data doesn't support it.
2. Confuse *"the sens your muscle memory is currently calibrated to"* with *"the sens where you perform best."* These are different quantities and both are useful. We measure and report both.
3. Hide the method. The credibility of the whole product is the methodology.

---

## 3. Users

| Segment | Need | Why they pay |
|---|---|---|
| **Primary — Ranked FPS player (Silver→Immortal, Valorant first)** | "Is my sens actually wrong, or am I just bad?" | Ends months of setting-churn; gives a defensible answer |
| Secondary — Player switching games (CS2 → Valorant) | Carry over muscle memory correctly | Conversion + re-validation in one place |
| Secondary — New hardware buyer (new mouse/pad/DPI) | Re-derive sens for new gear | Fast recalibration |
| Tertiary — Aim-training regulars (Voltaic/KovaaK's crowd) | Data they can argue about on Discord | Exportable telemetry, benchmark percentiles |

**Non-users at launch:** console/controller players, mobile, VR.

---

## 4. Core concepts & math

All internal math is done in **device-independent units**, then converted to a game's number only for display. This is the single most important architectural decision — it keeps the optimizer game-agnostic.

### 4.1 Units

Let `yaw` = degrees of rotation per mouse count at in-game sens 1.0.

| Game | Yaw | Note |
|---|---|---|
| Valorant | 0.07 | launch target |
| CS2 / CS:GO / Apex | 0.022 | Source-family |
| Overwatch 2 | 0.0066 | |
| Fortnite, R6, Deadlock, etc. | non-linear / percentage-based | **needs per-game verification before shipping — do not trust converter blogs** |

```
degPerCount   = yaw × sens
countsPer360  = 360 / degPerCount
cm/360        = 2.54 × countsPer360 / DPI  =  (360 × 2.54) / (DPI × sens × yaw)
deg/mm        = (DPI × sens × yaw) / 25.4
```

Sanity check: 800 DPI, Valorant 0.5 → `914.4 / (800 × 0.5 × 0.07)` = **32.7 cm/360**.

Cross-game conversion (preserves cm/360):
```
targetSens = (srcDPI × srcSens × srcYaw) / (tgtDPI × tgtYaw)
```

**The optimizer's search variable is `x = ln(cm/360)`.** Log space because sensitivity is perceptually multiplicative (a 10% change feels the same at 20cm and 60cm), and because the published optimum is a multiplicative 4x band.

### 4.2 Objective function

Per shot, log Fitts-style quantities:

- `A` = angular distance from crosshair to target center at spawn (degrees)
- `W` = target angular diameter (degrees)
- `ID = log2(A/W + 1)` (Shannon form, bits)
- `MT` = movement time from target spawn to click (ms)
- **Throughput** `TP = ID_e / MT` in bits/s, using **effective width** `W_e = 4.133 × σ` (σ = SD of click endpoint error projected on the task axis, computed per block, not per shot)

`TP` is the objective because it is a **unified speed–accuracy measure** — it can't be gamed by rushing (accuracy collapses, `W_e` inflates) or by being slow and perfect (`MT` inflates). Human mouse throughput in the literature sits around **3.7–4.9 bits/s**, which gives us a sanity band for our numbers.

Secondary objectives tracked but not optimized at MVP: hit rate, time-to-first-correction, corrective submovement count.

### 4.3 The three signals we extract

| Signal | What it measures | How | What it's for |
|---|---|---|---|
| **A. Calibration gain (`g`)** | The sens your muscle memory is *currently* tuned to | Regress first-submovement angular displacement against required angle `A`. Slope `g > 1` = systematic overshoot, `g < 1` = undershoot | "Your hand is calibrated to 34 cm/360, you're playing at 31." **Instant comfort fix**, not a performance claim |
| **B. Performance optimum (`x*`)** | Where measured throughput peaks | Bayesian optimization over `x = ln(cm/360)` | The headline recommendation |
| **C. Plateau width** | How much it actually matters | Posterior credible region where TP is statistically indistinguishable from peak | Honesty. Often the answer is "anywhere in 30–42cm is fine, stop tinkering" |

Signal A is cheap, fast (60 flicks), and instantly satisfying. Signal B is expensive (~15 min) and is the real product. **Ship A first, B second.**

### 4.4 The optimizer (Signal B)

**Design: interleaved randomized block experiment + 1-D Gaussian Process.**

- Pick 5–7 candidate sensitivities, log-spaced across the prior range (§4.5), e.g. `[0.72, 0.82, 0.93, 1.06, 1.20, 1.36]` × current sens.
- Run in **short interleaved blocks** (~25–35 shots each), order randomized/counterbalanced, several passes: `C A B | B C A | A B C …`
  - *Why:* the enemy of this experiment is **drift** — warmup, learning, and fatigue all move performance over a session far more than sens does. Blocked-not-interleaved designs would attribute drift to whichever sens ran last.
- **Discard the first 5–8 shots after every sens switch** (visuomotor re-adaptation transient). Log them separately — the transient size is itself a useful metric.
- Fit a **GP** (RBF kernel, length-scale ≈ 0.25 in log-space) over `x → TP`, with per-block observation noise = within-block SEM. Add a **session-time covariate** so the model can subtract linear drift.
- Acquisition: **UCB** early (explore), **posterior-mean argmax** late (exploit).
- Stop when either (a) the 90% credible interval on `x*` is narrower than ±10%, or (b) trial budget hit.

Why GP/Bayesian rather than a naive "try each, pick highest mean": Bayesian adaptive designs in psychophysics reach comparable reliability in **10–20 trials vs 3–8x more** for staircase methods, and they give you the credible interval for free — which is the honesty feature.

**Fallback if a session is inconclusive:** report the plateau, not a point. "We couldn't separate 32–40 cm/360 with this much data. Run another session or stay where you are." This is a feature, not a failure state.

### 4.5 Priors (what we know before any shot is fired)

The GP prior is centered using deterministic constraints — this is why the search only needs ~6 arms:

1. **Literature band:** hard-clamp to 20–80 cm/360 unless the user overrides.
2. **Physical reach constraint:** `cm/180 ≤ usable mousepad width`. If pad = 45cm and cm/360 = 60, a 180° turn needs 30cm — fine; but flag anything requiring a repositioning swipe for a 180.
3. **Grip:** arm-aimers tolerate lower sens (higher cm/360); wrist/fingertip aimers need higher. Wrist-sweep rule: a comfortable wrist flexion should cover ~180–270°.
4. **Game archetype:** crosshair-placement-heavy tactical shooters (Valorant, CS2) → ~40–50 cm/360 typical; hero/movement shooters → ~35 cm.
5. **Population reference:** Valorant pro median ≈ 267 eDPI ≈ 45 cm/360; competitive range ≈ 23–58 cm/360 at 200–450 eDPI. Shown as context, **never** as a recommendation.

### 4.6 Task-difficulty conditioning (V2, and the real moat)

The NVIDIA result that lower sens wins at high ID and higher sens wins at low ID means a **single global optimum is a compromise**. V2 reports a per-regime breakdown:

> *"Your peak is 38 cm/360 overall. But on long-range small targets you're best at 44, and on close large targets at 31. You play Jett and take 60% close duels → weight toward 34."*

No competitor does this. It is a direct, defensible consequence of the published research and it requires only bucketing existing telemetry by ID.

---

## 5. Scenarios (the 3D part)

Each scenario must produce clean Fitts-decomposable telemetry. Keep the count small and the instrumentation deep.

| Scenario | Purpose | Design |
|---|---|---|
| **Static Flick** (MVP) | Signals A + B, mid-ID | Single sphere spawns at randomized A ∈ [7°, 25°], W ∈ {0.57°…4.59°}. Click to kill, next spawns. Full ID sweep 0.8–5.5 bits |
| **Micro Correction** (MVP) | High-ID regime | Small targets, short distances, tight W |
| **Wide Flick** (V1) | Low-ID / speed regime | Large targets, 40–90° distances — exposes low-sens speed cap |
| **Strafe Track** (V1) | Smooth-pursuit regime; sens optimum differs from clicking | Target moves laterally, hold-to-damage, score = time-on-target |
| **Reactive Multi-target** (V2) | Ecological validity | Sequential targets, target switching |

**Scene constants (must be locked and displayed):** rendered FOV, target color/contrast, crosshair, background. Changing FOV changes angular distances and silently invalidates historical data — treat FOV as part of the experiment's identity and version it.

---

## 6. Telemetry schema

The data model *is* the product. Log at the input-event level, not the shot level — you can always aggregate down, never up.

```ts
// One row per shot
type Shot = {
  id: string
  sessionId: string
  blockId: string          // which sens arm
  scenarioId: string
  seq: number              // shot index within block (for drift/warmup modeling)
  isPostSwitchTransient: boolean

  degPerCount: number      // the ground-truth sens for this block
  cm360: number

  spawnTs: number          // performance.now(), high-res
  firstMoveTs: number      // → reaction time
  clickTs: number          // → MT = clickTs - spawnTs
  hit: boolean

  targetAzimuth: number    // deg, at spawn
  targetElevation: number
  targetAngularWidth: number  // W
  distanceA: number           // A
  indexOfDifficulty: number   // log2(A/W + 1)

  endpointErrorX: number   // deg, signed, along task axis → W_e and gain g
  endpointErrorY: number

  pathLengthDeg: number    // → efficiency = A / pathLength
  submovementCount: number // velocity-profile zero-crossings
  overshootRatio: number   // peak displacement / A
  directionReversals: number
}

// Raw input trace, sampled per animation frame (or per coalesced event)
type InputSample = { t: number; dx: number; dy: number }  // raw counts
```

Store the raw `InputSample` trace per shot (compressed) for the first N sessions — you will want to re-derive submovement metrics after you change the algorithm, and you cannot go back and re-collect.

---

## 7. Input handling (the part that will bite you)

- **Pointer Lock API** with `requestPointerLock({ unadjustedMovement: true })`. This bypasses OS mouse acceleration and gives raw deltas. **Chrome/Edge only**; Firefox and Safari silently fall back to OS-adjusted movement — that is a **data-validity problem, not a cosmetic one**. Detect it and either warn hard or refuse to run a calibration session.
- Accumulate `movementX/Y` from **all** events in a frame (and `getCoalescedEvents()` where available) before applying rotation — at 1000 Hz polling you get many events per frame. Never sample "the latest" event.
- Convert deltas to yaw/pitch as raw counts × `degPerCount`. **Do not** apply any smoothing, ease, or per-frame clamping.
- Clamp pitch to ±89°; wrap yaw.
- **DPI is not readable from the browser.** User enters it. Ship a verification tool: "place your mouse at the left edge of your pad, drag exactly 20 cm right" → compare counted deltas to claimed DPI, flag mismatch >5%. This catches the very common case of a wrong DPI setting silently corrupting every recommendation.
- OS pointer speed slider must be at default (6/11 on Windows) and Enhance Pointer Precision **off** — detectable only indirectly; put it in a pre-flight checklist.
- Refresh-rate and frame-pacing affect measured MT. Log `refreshRate`, average frame time, and dropped frames per block; **exclude blocks with bad frame pacing** rather than silently polluting the fit.

---

## 8. Tech stack

You said you're learning Next.js and want to pick up something 3D. This stack is chosen to be learnable in that order, and to not need a rewrite when the product gets real.

### Recommended

| Layer | Choice | Why |
|---|---|---|
| Runtime / package manager | **Bun** | Already your setup |
| Framework | **Next.js 15+ (App Router) + TypeScript** | What you want to learn. Marketing pages, dashboards, and auth are all server-rendered; the trainer itself is one client-only route |
| 3D | **React Three Fiber + drei** (`@react-three/fiber`, `@react-three/drei`) | Lets you write the scene in React (familiar) while still being real Three.js underneath. `PointerLockControls` from drei gives you a working baseline in ~20 lines — but **you will replace it** with your own controller so you control the exact delta→angle math |
| Game loop | `useFrame` + **refs, never `useState`** | Calling `setState` 60–240×/sec will tank frame rate. All per-frame mutation goes directly on Three.js objects via refs |
| App state | **Zustand** | Store outside React's render cycle; the game loop reads it without re-rendering |
| UI | **Tailwind + shadcn/ui** | Fast, and the dashboard is most of the surface area |
| Charts | **Recharts** or **visx** | GP posterior curves, throughput-vs-sens plots, ID breakdowns |
| DB | **Postgres (Neon or Supabase) + Drizzle ORM** | Typed, migration-friendly, Bun-native |
| Telemetry storage | Postgres now; **ClickHouse** when shot volume gets real | Shot rows are append-only time-series. Start simple, know the escape hatch |
| Auth | **Better Auth** | Modern, TS-first, works cleanly with Drizzle |
| Optimizer | **Plain TypeScript, running client-side** | See below |
| Hosting | **Vercel** | Next.js default path |

### The optimizer needs no AI infrastructure

Be clear-eyed about this: **a 1-D Gaussian Process over ~6 candidate points is about 60 lines of TypeScript** (build kernel matrix, Cholesky solve, posterior mean/variance on a grid). No Python service, no model hosting, no GPU. Run it in the browser during the session so recommendations update live.

Where an **LLM genuinely earns its place** — and where you should use one — is the **coaching narrative**, not the optimization:

> "Your overshoot dropped 40% between 34 and 38 cm/360, but your wide flicks got 8% slower. You're an arm aimer on a 45cm pad, so the tradeoff favors the lower end. Try 36 for a week."

Structured telemetry summary in → explanation out. That's a Claude API call (`claude-sonnet-5` is the right cost/quality point for this) on top of numbers the GP already produced. **Never let the LLM produce the number.**

### Explicitly deferred / rejected

- **Unity / Godot / desktop (Tauri, Electron):** better raw input and frame pacing, but kills the zero-install funnel that makes a browser trainer spread. Revisit only if browser frame-pacing variance proves to swamp the sens effect — which is an empirical question you can answer with the frame-timing telemetry from §7.
- **WebGPU:** Three.js has an experimental renderer but R3F support is still incomplete as of early 2026. WebGL2 is more than enough for a few spheres on a flat background. Don't.
- **Multiplayer / social at MVP:** no.
- **Anti-cheat / score integrity:** V2. Assume good faith on personal recommendations; it only matters once leaderboards exist.

### Learning path (build in this order)

1. Next.js route + a Three.js scene with a static sphere in R3F.
2. Pointer lock + your own delta→camera rotation. Verify `cm/360` against a known-good calculator by counting a physical 360.
3. Spawn/hit/despawn loop + shot logging to `localStorage`.
4. Fitts metrics + charts. Now you have a real aim trainer.
5. Signal A (gain regression) — ship this. It's a complete, useful product.
6. Postgres + auth + history.
7. Signal B (blocked experiment + GP).

---

## 9. Scope

### MVP — "Recalibrate" (target: 4–6 weeks solo)
- Setup: DPI (+ verification), game (Valorant only), current in-game sens, mousepad width, grip type
- Two scenarios: Static Flick, Micro Correction
- **60–100 flick session (~3 min)** → Signal A: calibration gain + overshoot/undershoot profile
- Output: "Your muscle memory is calibrated to X cm/360 (= sens Y in Valorant). You're playing at Z."
- Local-only storage, no account required
- Session summary: hit rate, MT, throughput, overshoot distribution, per-ID breakdown

### V1 — "Find" (the actual product)
- Accounts, session history, cross-session trend
- **The 15-minute optimizer session:** interleaved blocks, GP fit, live posterior chart
- Output: point estimate + credible interval + **plateau**
- Multi-game support (CS2, Apex, OW2, Fortnite) with verified yaw table + converter
- Strafe-track scenario (tracking optimum ≠ clicking optimum — surface both)
- LLM-generated session explanation
- Re-test prompt after a sens change ("you switched 9 days ago — confirm it stuck")

### V2
- Task-difficulty-conditioned recommendation (§4.6) with playstyle weighting
- Cross-user hierarchical prior (your grip + pad + rank → better starting prior → fewer trials needed)
- Benchmarks/percentiles vs population
- Telemetry export (CSV/JSON), public shareable session report
- Hardware advisory ("your pad is too small for your optimum")

---

## 10. Success metrics

| Metric | Target |
|---|---|
| Session completion rate (MVP 3-min flow) | > 70% |
| Session completion rate (V1 15-min flow) | > 45% |
| Fraction of optimizer sessions returning a **conclusive** result (CI ±10%) | > 60% |
| Median throughput measured | 3.5–5.0 bits/s (sanity: matches literature; outside this band = instrumentation bug) |
| **Validation:** users who adopt the recommendation and re-test in 7–14 days show higher throughput at the new sens than their old baseline | statistically significant, n ≥ 200 |
| 7-day return rate | > 25% |

That validation metric is the one that decides whether the product is real. Instrument for it from day one — it needs the pre/post design baked into the schema, not bolted on.

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **The effect is smaller than session noise** — the plateau is genuinely wide and we can't resolve a point | **High** | Reframe as the honest headline: "you're already in your optimal band" is a real, sellable answer. Never fabricate precision. Increase trial count adaptively |
| **Learning confound** — the player just gets better during the session, and the last sens wins | **High** | Interleaved randomized blocks + session-time covariate in the GP. Non-negotiable |
| **Adaptation confound** — the player is instantly worse at any unfamiliar sens, biasing toward their current one | **High** | Discard post-switch transients; multiple passes per arm; report transient magnitude separately |
| Firefox/Safari lack `unadjustedMovement` → OS acceleration corrupts data | Medium | Detect and block calibration sessions; Chrome-only for measurement, all browsers for browsing |
| Wrong user-entered DPI silently invalidates everything | Medium | Physical-distance DPI verification tool; refuse to proceed on >5% mismatch |
| Browser frame pacing inflates MT variance | Medium | Log frame timing; exclude bad blocks; require ≥144 Hz for optimizer sessions (warn below) |
| Non-linear-sens games (Fortnite, R6) break the yaw model | Low-Med | Verify per game before adding; ship only verified games |
| Users want a number and hate confidence intervals | Medium | Lead with the number, show the band as "how much this matters", make honesty the brand |

---

## 12. Open questions

1. **How many trials per arm are actually needed** to resolve a 5% throughput difference at realistic human variance? → Simulate this before building the optimizer. A quick Monte Carlo with plausible σ tells you whether the 15-minute session is even feasible, or whether it needs to be 40 minutes or spread across days. **Do this first; it can kill or reshape V1.**
2. Does the calibration gain (Signal A) converge to the throughput optimum (Signal B) over weeks, or are they persistently different quantities?
3. Is tracking sens optimum systematically higher than clicking sens optimum, and by how much? Determines whether we recommend one number or a compromise.
4. Should the recommendation be a *destination* (jump there) or a *ramp* (5% per week)? Motor adaptation literature suggests gradual, but big jumps give a clearer product moment.
5. Business model: free trainer + paid optimizer? One-time "sens audit"? Subscription for history/benchmarks?
6. Do we let users import KovaaK's/Aim Lab CSVs as extra evidence? Big moat if the parsing works.

---

## Sources

- [Mouse Sensitivity Effects in First-Person Targeting Tasks — Boudaoud & Spjut, NVIDIA (arXiv 2203.12050)](https://arxiv.org/abs/2203.12050) · [IEEE Xplore version](https://ieeexplore.ieee.org/document/10184504/) · [PDF](https://ieee-cog.org/2022/assets/papers/paper_64.pdf)
- [KovaaK's aim trainer as a reliable metrics platform for assessing shooting proficiency in esports players (Frontiers, 2024)](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1309991/full)
- [Fitts' Law — throughput, effective width, ISO 9241-9 (MacKenzie)](https://www.yorku.ca/mack/hhci2018.html)
- [QUEST: A Bayesian adaptive psychometric method (Watson & Pelli)](https://link.springer.com/article/10.3758/BF03202828)
- [Human-in-the-loop Bayesian optimization of wearable device parameters (PLOS One)](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0184054)
- [Rapid, precise, and reliable measurement using a Bayesian learning algorithm (ADO vs staircase)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7374100/)
- [Sensitivity to error during visuomotor adaptation (J. Neurophysiology)](https://journals.physiology.org/doi/full/10.1152/jn.00269.2021)
- [Disable mouse acceleration for a better FPS gaming experience — web.dev (`unadjustedMovement`)](https://web.dev/articles/disable-mouse-acceleration)
- [Element: requestPointerLock() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)
- [Pointer Lock 2.0 — W3C](https://www.w3.org/TR/pointerlock-2/)
- [PointerLockControls in React Three Fiber](https://sbcode.net/react-three-fiber/pointerlock-controls/)
- [VALORANT Best Settings — 686 pro players, Aug 2026 (ProSettings)](https://prosettings.net/guides/valorant-options/)
- [A Quick Explainer on cm/360 — Aimlabs](https://aimlabs.com/articles/aimlabs/a-quick-explainer-on-cm-360-and-the-common-cm-360-by-game/)
- [Getting started with Voltaic](https://voltaic.medium.com/getting-started-with-voltaic-20fa06c65342)
- [3D Aim Trainer — Sensitivity Finder (competitor)](https://www.3daimtrainer.com/sensitivity-finder/)
- [VALORANT Sensitivity Converter — mouse-sensitivity.com](https://www.mouse-sensitivity.com/n/valorant/)
