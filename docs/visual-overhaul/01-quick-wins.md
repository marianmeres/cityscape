<!--
GENERATED ANALYSIS — @marianmeres/cityscape · visual overhaul
Produced 2026-06-20 by inline scout → verify pass over the codebase.
Claims verified against the codebase at commit 5997d8f. Planning artifact; no code was changed.
-->

# Quick Wins — per-building richness + a render post-pass

> The cityscape's buildings are flat silhouettes: a single filled `rect` body plus lit-window
> rects (see [building.ts:145](../../src/cityscape/buildings/building.ts#L145) and
> [window-grid.ts:132](../../src/cityscape/buildings/window-grid.ts#L132)). At night that reads
> well far away but the **near band looks papery** — no surface form, uniform window grids. This
> dimension is four changes that each reuse the _existing_ seven draw primitives, touch one or two
> files, carry near-zero mood risk, and together make every frame visibly richer. **None of them
> add a `DrawCommand`** — that's the whole point. Do these first: fast, safe, and they warm up the
> patterns the bigger features reuse.

## Summary of recommendations

| # | Recommendation                                                    | Value | Effort | Risk |
| - | ----------------------------------------------------------------- | ----- | ------ | ---- |
| 1 | Directional face-shading on near buildings (gradient overlay)     | high  | S      | low  |
| 2 | Window variety: lit floors, penthouse glow, signage, blinds       | high  | S–M    | low  |
| 3 | Curved roof features (new `RoofKind`s: barrel, deco, water-tower) | med   | S      | low  |
| 4 | Vignette + faint grain post-pass (canvas renderer only)           | med   | S      | low  |

## Findings & recommendations (detailed)

### 1. Directional face-shading

- **Observation** — `drawBody` emits one flat `rect` per body segment
  ([building.ts:135](../../src/cityscape/buildings/building.ts#L135)); a silhouette has no sense of
  volume. A faint gradient overlay gives each building a top-lit "face" without any lighting model.
- **Proposed change** — after the body rect(s), overlay a translucent vertical `gradient`
  (lighter at the top → transparent at the base; optionally a subtle base-darken for street-level
  ambient occlusion). Default is a **fixed rim-light from above** (no coupling to the moon's
  position, which `building.ts` can't see). Scope to **near layers only** (`this.depth > ~0.8`) —
  on far/dark bands the overlay is invisible and wastes a draw command.
- **Affected files** — [building.ts](../../src/cityscape/buildings/building.ts) (draw/`drawBody`);
  [config.ts](../../src/cityscape/config.ts) (`buildingShading` knob, group `World`);
  [config.test.ts](../../tests/config.test.ts) follows automatically (schema↔interface parity).
- **Effort S / Value high / Risk low** — additive; composes cleanly over setbacks because it
  paints _on top_ of the existing segment rects. Re-tunes the curated default snapshot subtly.
- **Implementation notes** — use `lighten(this.#color, k)` → `withAlpha(..., 0)` stops from
  [color.ts:135](../../src/engine/math/color.ts#L135). Keep the lightness delta small (≤ ~8%).
  Per-building variation can come from `this.#phase` so a row of towers isn't uniform. One extra
  `gradient` per near building — watch the draw-command count (see 00 "Completeness check").

### 2. Window variety

- **Observation** — every lit cell is an identically-shaped rect with a stable per-cell tint and
  brightness ([window-grid.ts:108–133](../../src/cityscape/buildings/window-grid.ts#L108)). Good,
  but the grid still reads as a uniform mesh. Real towers have whole-floor offices lit, a warmer
  glow at the top, the odd colored sign, and partly-drawn blinds.
- **Proposed change** — at `seed()` time give the grid stable per-building character flags, then
  honor them in `draw()`:
  - **Lit floors**: occasionally mark an entire row lit (an office floor working late).
  - **Penthouse**: bias the top 1–2 rows warmer + brighter.
  - **Signage**: rare cells get a saturated hue via `hsl()`
    ([color.ts:140](../../src/engine/math/color.ts#L140)).
  - **Blinds**: some lit cells draw at half height.
- **Affected files** — [window-grid.ts](../../src/cityscape/buildings/window-grid.ts);
  optionally a `windowVariety` knob in [config.ts](../../src/cityscape/config.ts) (group `Lights`).
- **Effort S–M / Value high / Risk low** — all deterministic via the existing `#salt` + `cellHash`
  ([window-grid.ts:25](../../src/cityscape/buildings/window-grid.ts#L25)); no new RNG draws on the
  hot path beyond seed-time flags.
- **Implementation notes** — keep signage _rare_ (a few % of buildings, 1–2 cells) so it stays a
  delight, not noise. Penthouse warmth should lean on the existing `WARM_TINT`.

### 3. Curved roof features

- **Observation** — the `RoofKind` union has eight flat/angular crowns
  ([kinds.ts:26](../../src/cityscape/buildings/kinds.ts#L26)); only `dome`
  ([building.ts:220](../../src/cityscape/buildings/building.ts#L220)) uses a curve. Curves read far
  better as _roof features_ than as rounded building corners (which are imperceptible at skyline
  scale and arguably wrong).
- **Proposed change** — add a few crowns that reuse `circle`/`polygon`: `barrel` (a rounded vault
  cap), `deco` (a stepped art-deco crown — stacked narrowing rects/polys), `watertower` (legs + a
  rounded tank). Wire them into the weighted roof lists in the relevant generators
  ([kinds.ts:68](../../src/cityscape/buildings/kinds.ts#L68)).
- **Affected files** — [kinds.ts](../../src/cityscape/buildings/kinds.ts) (union + generators);
  [building.ts](../../src/cityscape/buildings/building.ts) (`drawRoof` switch).
- **Effort S / Value med / Risk low** — extending the `RoofKind` union makes TypeScript flag the
  missing `switch` cases in `drawRoof` for free, so nothing is silently unhandled.
- **Implementation notes** — `watertower` pairs naturally with the coming countryside biome
  (silos); building it now means the biome work reuses it.

### 4. Vignette + grain post-pass

- **Observation** — the frame is painted edge-to-edge with uniform brightness
  ([canvas-renderer.ts:41](../../src/render/canvas/canvas-renderer.ts#L41)). A gentle corner
  darkening + a barely-there grain is the single cheapest perceived-quality lift, and it belongs at
  the **renderer** level — it must not enter the core or the `DrawCommand` seam.
- **Proposed change** — after the command loop, draw a radial vignette (`createRadialGradient`,
  source-over black fading from center) and optional low-alpha noise. The ASCII renderer simply
  doesn't get it — correct, it's a raster concern.
- **Affected files** — [canvas-renderer.ts](../../src/render/canvas/canvas-renderer.ts) (post-pass
  - a `setPost({vignette, grain})` setter); [runtime/mount.ts](../../src/runtime/mount.ts) (read the
    knob → call the setter); [config.ts](../../src/cityscape/config.ts) (`vignette` knob).
- **Effort S / Value med / Risk low** — the one wrinkle is that config lives in the DOM-free core
  and the renderer can't read it directly; the wiring crosses through `runtime`, which is _allowed_
  to touch both sides. This keeps the core pure (the dom-purity test stays green).
- **Implementation notes** — vignette is a _multiply/darken_, which the additive `glow` primitive
  can't express and the linear `gradient` can't shape radially — so a true vignette is genuinely a
  renderer post-pass, not an in-seam command. (A 4-corner gradient fake was **cut from the draft**:
  uglier and still needs core plumbing for a radial falloff.)

## Open questions / decisions needed

- **Face-shading light direction** — fixed vertical rim-light (recommended; no moon coupling) vs a
  horizontal directional gradient keyed to a scene-wide light azimuth?
- **Defaults vs the curated snapshot** — ship these subtly _on_ by default (and re-tune the curated
  navy snapshot once at the end) or default them low/off so the snapshot is untouched?
- **Knob count** — one knob per effect (panel grows) vs a single `detail` master? Recommend a knob
  for face-shading + window-variety (they change character), constants for the micro-details.
- **Vignette wiring** — renderer post-pass via `runtime` (recommended) vs an in-seam full-frame
  command (would also reach ASCII, but can't do radial falloff cleanly)?
