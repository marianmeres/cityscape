# Implementation Progress — Cityscape Visual Overhaul

Living tracker for acting on [`00-overview-and-roadmap.md`](./00-overview-and-roadmap.md).
A fresh conversation should read this file first, then the relevant `NN-*.md` section.

**Status legend:** ⬜ not started · 🚧 in progress · ⏸️ blocked/awaiting decision · ✅ done · ⏭️ deferred

> Convention: one branch for the sprint, one commit per task. Each task resolves its source doc's
> "Open questions" first (record in the Decisions log), then implement → `deno task check` +
> `deno task test` + `deno fmt` → tick here. Commit only when the owner asks.

## First sprint (quick wins + biome de-risk)

Branch: `visual-overhaul`

| # | Task                                                    | Source                         | Status | Commit |
| - | ------------------------------------------------------- | ------------------------------ | ------ | ------ |
| 1 | Directional face-shading on near buildings              | [01](./01-quick-wins.md) #1    | ✅     | `visual-overhaul` (uncommitted) |
| 2 | Window variety (lit floors, penthouse, signage, blinds) | [01](./01-quick-wins.md) #2    | ✅     | `visual-overhaul` (uncommitted) |
| 3 | Curved roof features (barrel/deco/water-tower)          | [01](./01-quick-wins.md) #3    | ✅     | `visual-overhaul` (uncommitted) |
| 4 | Vignette + grain post-pass                              | [01](./01-quick-wins.md) #4    | ✅     | `visual-overhaul` (uncommitted) |
| 5 | `BiomeField` scaffold (city kinds only)                 | [02](./02-biome-journey.md) #1 | ⬜     | —      |

> Task 5 unblocked 2026-06-20 (decisions logged below): noise-on-urbanism-axis, variety off by default.

## Backlog (ranked, post-sprint)

| Rank | Task                                                      | Source                             | Status |
| ---- | --------------------------------------------------------- | ---------------------------------- | ------ |
| 6    | Countryside content (tree/barn/silo/field + shape branch) | [02](./02-biome-journey.md) #2     | ⬜     |
| 7    | Road anchor + `TrafficDirector` light-streaks             | [03](./03-foreground-life.md) #1–2 | ⬜     |
| 8    | Coast biome (sparse waterfront)                           | [02](./02-biome-journey.md) #3     | ⬜     |
| 9    | Transition blending + far-layer hills/treeline            | [02](./02-biome-journey.md) #4     | ⬜     |
| 10   | Streak reflections on water                               | [03](./03-foreground-life.md) #3   | ⬜     |
| 11   | Ground fog / mist                                         | [04](./04-atmosphere-polish.md) #1 | ⬜     |
| 12   | Neon rooftop signs                                        | [04](./04-atmosphere-polish.md) #2 | ⬜     |
| 13   | Water reflections of near-window lights                   | [04](./04-atmosphere-polish.md) #3 | ⬜     |
| 14   | Drifting airship                                          | [04](./04-atmosphere-polish.md) #4 | ⬜     |
| 15   | Aurora ribbon                                             | [04](./04-atmosphere-polish.md) #5 | ⏭️     |
| 16   | Re-tune the curated default snapshot                      | [00](./00-overview-and-roadmap.md) | ⬜     |

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

## How to resume (for a fresh conversation)

1. Read this file + [`00-overview-and-roadmap.md`](./00-overview-and-roadmap.md).
2. Pick the next ⬜/🚧 task; open its source doc section for the verified detail.
3. Resolve that task's "Open questions" with the owner; record in the Decisions log.
4. Branch → implement → `deno task check` + `deno task test` + `deno fmt` → update this file → commit when the owner asks.
