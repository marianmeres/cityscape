# Implementation Progress — Cityscape Visual Overhaul

Living tracker for acting on [`00-overview-and-roadmap.md`](./00-overview-and-roadmap.md).
A fresh conversation should read this file first, then the relevant `NN-*.md` section.

**Status legend:** ⬜ not started · 🚧 in progress · ⏸️ blocked/awaiting decision · ✅ done · ⏭️ deferred

> Convention: one branch for the sprint, one commit per task. Each task resolves its source doc's
> "Open questions" first (record in the Decisions log), then implement → `deno task check` +
> `deno task test` + `deno fmt` → tick here. Commit only when the owner asks.

## First sprint (quick wins + biome de-risk)

Branch: `visual-overhaul`

| # | Task                                                    | Source                         | Status | Commit    |
| - | ------------------------------------------------------- | ------------------------------ | ------ | --------- |
| 1 | Directional face-shading on near buildings              | [01](./01-quick-wins.md) #1    | ✅     | `478836b` |
| 2 | Window variety (lit floors, penthouse, signage, blinds) | [01](./01-quick-wins.md) #2    | ✅     | `478836b` |
| 3 | Curved roof features (barrel/deco/water-tower)          | [01](./01-quick-wins.md) #3    | ✅     | `478836b` |
| 4 | Vignette + grain post-pass                              | [01](./01-quick-wins.md) #4    | ✅     | `478836b` |
| 5 | `BiomeField` scaffold (city kinds only)                 | [02](./02-biome-journey.md) #1 | ✅     | `0d9fb5d` |

> First sprint complete. Task 5 verified via a 6-probe adversarial workflow (see Decisions log).

## Backlog (ranked, post-sprint)

| Rank | Task                                                      | Source                             | Status                            |
| ---- | --------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| 6    | Countryside content (tree/barn/silo/field + shape branch) | [02](./02-biome-journey.md) #2     | ✅ `9e728b3`                      |
| 7    | Road anchor + `TrafficDirector` light-streaks             | [03](./03-foreground-life.md) #1–2 | ✅ `dac88c6`                      |
| 8    | Coast biome (sparse waterfront)                           | [02](./02-biome-journey.md) #3     | ⬜                                |
| 9    | Transition blending + far-layer hills/treeline            | [02](./02-biome-journey.md) #4     | ⬜                                |
| 10   | Streak reflections on water                               | [03](./03-foreground-life.md) #3   | ✅ `dac88c6` (folded into task 7) |
| 11   | Ground fog / mist                                         | [04](./04-atmosphere-polish.md) #1 | ⬜                                |
| 12   | Neon rooftop signs                                        | [04](./04-atmosphere-polish.md) #2 | ⬜                                |
| 13   | Water reflections of near-window lights                   | [04](./04-atmosphere-polish.md) #3 | ⬜                                |
| 14   | Drifting airship                                          | [04](./04-atmosphere-polish.md) #4 | ⬜                                |
| 15   | Aurora ribbon                                             | [04](./04-atmosphere-polish.md) #5 | ⏭️                                |
| 16   | Re-tune the curated default snapshot                      | [00](./00-overview-and-roadmap.md) | ⬜                                |

## Decisions log

- **2026-06-20** — Day mode **out of scope** — keep it a night piece; avoids a building-lighting model.
- **2026-06-20** — Foreground life = **stylized light-streaks**, not literal cars/people — fits the calm at skyline zoom.
- **2026-06-20** — Biome = **macro journey** (metropolis → town → countryside → coast → back), not just occasional variety.
- **2026-06-20** — Appetite = **full overhaul**, sequenced so each step ships independently.
- **2026-06-20** — Task 1 taste calls (mine, easily reversible): face-shading uses a **fixed vertical rim-light** (no moon coupling), **scoped to near layers** (`depth > 0.78`), shipped **subtly on by default** behind a `buildingShading` knob; curated snapshot re-tuned in task 16.
- **2026-06-20** — Biome zoning = **value-noise on an urbanism axis** (coast→country→town→metropolis) — reversible, naturally gradiented, no sequential state. Unblocks task 5.
- **2026-06-20** — Default `biomeVariety` = **uniform city** (journey opt-in via the slider) — protects the curated snapshot's first impression.
- **2026-06-20** — Task 2 taste call: window-variety features (lit floor, penthouse warmth, signage, blinds) are **always-on but subtle/rare, no knob** — avoids plumbing config through `reset()→seed()` and panel bloat; reconsider a knob if it reads too busy.
- **2026-06-20** — Fixed a **pre-existing** starfield bug found during sprint review: stars were confined to a 1600px tile, leaving viewports wider than 1600 bare on the right. Now tiles across the full width; regression test in `tests/starfield.test.ts`. (Not a planned task; unrelated to the quick-wins changes.)
- **2026-06-20** — Task 5 adversarially verified (6-probe workflow): determinism (journey on), cross-layer coherence, reverse-scroll/extreme-knob bounding, live-knobs-not-structural, and visible macro structure all **pass**. One finding accepted-by-design: `biomeVariety` drives a _stateful_ FSM, so a live `0→1→0` slider round-trip does **not** restore the exact untouched-seed city (only construction/permalink loads are byte-exact). Chose to **document** rather than make the knob structural (which would rebuild the world on every slider tick — jarring); the divergence is unobservable in the infinite scroll. Scoped the claim in `biome.ts`/`district.ts`/`tests/biome.test.ts`.
- **2026-06-20** — Task 5 tuning note (deferred to task 16): the journey is real but slow at default `biomeScale=5` (~3.3 min/cycle). Lowering the default (≈2–3) makes it more legible. Left at 5 pending a visual review rather than guessing blind; journey ships off by default so no snapshot impact.
- **2026-06-20** — Task 7 (foreground traffic) — the "road anchor" is the existing lit shore embankment (no separate road geometry needed), with a `TrafficDirector` of bounded (≤6) screen-space headlight/taillight crossers + their water reflections. Folded in task 10 (streak reflections) since a headlight without its reflection reads wrong. Knob `trafficChance` (default 0.6, sparse) — gated to scenes with a shore. Probed: gating, bounded commands, zero NaN; determinism + DOM-purity covered by existing tests. Shipped subtly on (re-tune at task 16); **not yet eyeballed**.
- **2026-06-20** — Task 6 (countryside content) adversarially verified (5-probe workflow, all pass): `variety=0` byte-identical to the pre-task commit (worktree comparison, 45M commands, 0 divergence); rural content gates on the journey and clusters 4.4× in low-urbanism stretches; render robust (0 NaN, bounded pool, 82k trees); deterministic; front-layer exclusion intact. `countryside` kept out of all base `next` lists, reached only via `BIOME_SUCCESSORS` at variety>0. Rural shape geometry (tree/barn/silo) is correctness-verified but **not yet eyeballed** — flag for the next visual review.

## How to resume (for a fresh conversation)

1. Read this file + [`00-overview-and-roadmap.md`](./00-overview-and-roadmap.md).
2. Pick the next ⬜/🚧 task; open its source doc section for the verified detail.
3. Resolve that task's "Open questions" with the owner; record in the Decisions log.
4. Branch → implement → `deno task check` + `deno task test` + `deno fmt` → update this file → commit when the owner asks.
