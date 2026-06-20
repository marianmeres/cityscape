# Visual Overhaul — @marianmeres/cityscape

This directory is the planning artifact for a focused **visual** pass on the cityscape (the
architecture is settled). Produced 2026-06-20, code-verified against commit `5997d8f`. Scope:
keep the calm night mood (no day mode), add per-building detail, a macro **biome journey**
(country ⇄ city), foreground **light-streak life**, and atmospheric polish — sequenced so each
step ships independently.

**Start here:** [`00-overview-and-roadmap.md`](./00-overview-and-roadmap.md).

## Documents

| #  | Doc                                                  | Scope                                     | Headline                                                                |
| -- | ---------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| 00 | [overview-and-roadmap](./00-overview-and-roadmap.md) | synthesis + ranked roadmap + first sprint | No new `DrawCommand` needed anywhere; biome is the one structural piece |
| 01 | [quick-wins](./01-quick-wins.md)                     | per-building richness + render post-pass  | Face-shading + window variety + curved roofs + vignette                 |
| 02 | [biome-journey](./02-biome-journey.md)               | generation / the centerpiece              | Seeded `biome(worldX)` macro field gating the District FSM              |
| 03 | [foreground-life](./03-foreground-life.md)           | near-layer motion                         | Sparse head/tail-light streaks on a near road                           |
| 04 | [atmosphere-polish](./04-atmosphere-polish.md)       | flourishes                                | Fog · neon · water/window reflections · airship · aurora                |
| —  | [PROGRESS](./PROGRESS.md)                            | living execution tracker                  | Source of truth for "where are we"                                      |

## How it was produced

Inline scout of the rendering seam, mood engine, building/window model, and generation pipeline →
verify pass (every `file:line` re-opened; nothing recommended that already exists) → synthesis.

> Decisions already taken by the owner are logged in [PROGRESS.md](./PROGRESS.md); each doc's
> "Open questions / decisions needed" lists what still needs a call before its tasks start.
