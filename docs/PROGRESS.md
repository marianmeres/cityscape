# Implementation Progress — @marianmeres/cityscape

Living tracker for building to [`SPEC.md`](./SPEC.md). A fresh conversation reads this file +
`SPEC.md` and is oriented.

**Status legend:** ⬜ not started · 🚧 in progress · ⏸️ blocked · ✅ done · ⏭️ deferred

## Build milestones
| # | Milestone | Status | Notes |
|---|-----------|--------|-------|
| 1 | Engine foundation (math · draw-command · renderer · scene · clock · loop · input · serialize) | ✅ | 14 files, DOM-free |
| 2 | Cityscape domain (config · palette · mood · buildings · sky · generation · scene · events) | ✅ | |
| 3 | Renderers (Canvas + ASCII) | ✅ | ASCII proves the seam (headless preview confirmed) |
| 4 | Runtime · control panel (vanilla+design-tokens) · ambient audio | ✅ | |
| 5 | Example (index.html · main.ts · theme) + bundle | ✅ | `example/dist/bundle.js` (~99KB) |
| 6 | Thorough DOM-free unit tests; `deno test` + `deno check` green | ✅ | 74 tests; check + lint + fmt clean |
| 7 | Adversarial review (DOM-purity · bugs · coverage) + fixes | ✅ | 5-dim workflow → 4 confirmed bugs, all fixed |

**Status: COMPLETE.** `deno test` 75✅ · `deno check` ✅ · `deno lint` ✅ · `deno fmt` ✅ · example bundles ✅ · runs in-browser ✅.

## Decisions log
- **2026-06-19** — Locked the seven decisions in SPEC §1 (palette system, display-list+Canvas+ASCII, muted synth audio, passive+light interaction, engine/content subpath exports, seeded determinism, thorough tests).
- **2026-06-19** — Panel builds DOM via `createElement` + vanilla reactive core (schema-driven controls don't fit a static `<template>`); honours "no markup-from-strings" (no `innerHTML`).
- **2026-06-19** — Ambient sound modelled as a pure sim event (`AmbientEventBus`); WebAudio synth is a browser adapter, keeping the core DOM-free.
- **2026-06-19** — Adversarial review (5-dimension workflow, find→verify→confirm) returned 4 confirmed bugs, all fixed: (1) sky paint order — flyers now drawn behind clouds [skyline.ts]; (2) ASCII polygon scanline off-by-one [ascii-renderer.ts]; (3) panel `toggle(collapse)` force semantics corrected to classList-style [panel.ts]; (4) renderer disposal on teardown. For (4) I diverged from the literal "dispose on every swap" suggestion — swapping is *deactivation* (the example reuses Canvas⇄ASCII), so disposing on swap would break reuse. Instead the handle disposes the renderer it created in `destroy()`; renderers passed to `setRenderer` are caller-owned. [mount.ts]
- **2026-06-19** — Browser-runtime bug found on first real run: the engine's first frame has a 0ms delta → 0 fixed-update steps → `collect()` ran before any `update()`, and entities draw from a mood cache seeded in `update()` → crash (`reading 'sky'`). Fix: scene primes itself in `resize()` via a `dt:0` `#tick()` (resolves mood, spawns skyline, seeds caches); structural rebuilds re-prime too. Regression test added (collect-before-update). [scene.ts]
- **2026-06-19** — Building proportions wrong on a 16:9 screen (tall, narrow towers): heights scaled with viewport height but widths were absolute px. Fix: horizontal world coordinates (widths, gaps, scroll, local x) are now in **viewport-height units**, converted to px in `Camera.project` via `unit = viewport height`; `speed` stays px/sec. Building widths derive from height by a per-archetype aspect ratio. Result: aspect ratios are constant at any window size (resize scales uniformly). Touched camera, kinds, district gaps, building draw, star/cloud wrap, and 2 tests. [camera.ts, kinds.ts, district.ts, building.ts]
- **2026-06-19** — Feature round: `zoom` (camera distance, folded into `Camera.unit`); skyscrapers excluded from the front layer (spawner `excludeKinds` + substitution); non-uniform building spacing (district touch/plaza gap rolls); per-window tint + brightness variation [window-grid.ts]; panel horizontal-scrollbar fix (`box-sizing: border-box`).
- **2026-06-19** — Waterfront: bottom `waterLevel` is a reflective `Water` plane; tightened the parallax layer ranges so even 2 bands read close together; building feet compute their baseline live from `waterLevel`.
- **2026-06-20** — Shore + vertical camera: a lit `Shore` embankment (streetlights + water reflections) separates city from water (building feet sit on it via `shoreHeight`). Vertical camera movement added as a single `DisplayList.offsetY` (camera aim + slow `verticalDrift` + pointer-Y), applied at the renderer seam; backdrop/water over-draw ±0.3h so the pan never gaps. [shore.ts, water.ts, backdrop.ts, camera.ts, world.ts, both renderers]
- **2026-06-20** — `showStats` was a dead toggle (no overlay) — implemented an FPS / entity-count / draw-count overlay in `runtime/mount.ts`, gated by `config.showStats`.
- **2026-06-20** — Docs: added `README.md` (with honest authorship note — 100% AI-authored, human-curated), `API.md`, and `AGENTS.md`; initial git commit.

## How to resume
1. Read this file + `SPEC.md`.
2. Pick the next ⬜ milestone; build inward-out (engine → cityscape → renderers → runtime → example → tests).
3. Keep `engine/` and `cityscape/` DOM-free; `deno check` + `deno test` must stay green.
