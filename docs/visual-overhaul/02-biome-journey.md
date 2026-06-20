<!--
GENERATED ANALYSIS — @marianmeres/cityscape · visual overhaul
Produced 2026-06-20 by inline scout → verify pass over the codebase.
Claims verified against the codebase at commit 5997d8f. Planning artifact; no code was changed.
-->

# Biome Journey — country ⇄ city as you scroll

> This is the centerpiece and the only item with real design weight. Today the infinite scroll is
> statistically **uniform**: the zoning FSM ([district.ts](../../src/cityscape/generation/district.ts))
> gives nice _local_ coherence (downtown → commercial → park → …), but every region is still "some
> city," so minutes of scrolling look the same. The goal is a **macro journey** — metropolis →
> town → countryside → coast → back — that gives the piece narrative and a reason to keep watching.
>
> The key realization from the code: the District FSM is the _meso_ layer; we add a **macro biome
> as a pure, seeded function of world-position** that _gates_ which districts/kinds are legal and
> how dense they are. Crucially, every parallax band and both scroll directions sample the **same**
> `biome(worldX)` function, so the whole frame agrees it's "passing the coast." No rewrite of the
> spawner pooling/recycle ([spawner.ts](../../src/cityscape/generation/spawner.ts)) — it stays a
> generation-content change.

## Summary of recommendations

| # | Recommendation                                                            | Value | Effort | Risk |
| - | ------------------------------------------------------------------------- | ----- | ------ | ---- |
| 1 | `BiomeField`: shared, seeded `biome(worldX)` gating the District FSM (2a) | high  | M      | med  |
| 2 | Countryside content: tree/barn/silo/field kinds + a shape branch (2b)     | high  | M      | med  |
| 3 | Coast biome: sparse waterfront stretch (2c)                               | med   | M      | med  |
| 4 | Transition blending + far-layer hills/treeline (2d)                       | med   | M–L    | med  |

## Findings & recommendations (detailed)

### 1. `BiomeField` — macro coherence (2a)

- **Observation** — each layer builds **two independent** `DistrictStream`s (per side:
  [spawner.ts:70–71](../../src/cityscape/generation/spawner.ts#L70)), each walking the FSM on its
  own RNG. Nothing makes layers or sides agree on a region, which is fine for uniform city but fatal
  for a "we're in the countryside now" read.
- **Proposed change** — introduce a `Biome` axis above `District`:
  `coast (0) — countryside (0.25) — town (0.6) — metropolis (1.0)` ordered on a 1-D **urbanism**
  scalar. A `BiomeField` maps world-x → urbanism via smooth value noise
  ([noise.ts `createNoise1D`](../../src/engine/math/noise.ts), already used by the mood engine), so:
  - it's a **pure function of `(seed, worldX)`** — reversible (camera can scroll either way),
    needs no sequential state, and reproduces exactly per seed;
  - because noise is continuous and biomes are ordered on the axis, regions are contiguous and
    **transitions are inherently gradiented** (countryside → town → metropolis → town → …) with no
    illegal jumps.
    The existing District FSM then runs _within_ the biome: the biome restricts the legal `kinds`
    and scales `gap`/density. Sampling point = the placement local-x in
    [`#placeRight`/`#placeLeft`](../../src/cityscape/generation/spawner.ts#L121) (local-x is in world
    units, shared across sides; layers sample the same field).
- **Affected files** — new `src/cityscape/generation/biome.ts`;
  [district.ts](../../src/cityscape/generation/district.ts) (biome-gated district/kind selection);
  [spawner.ts](../../src/cityscape/generation/spawner.ts) (sample biome at placement);
  [config.ts](../../src/cityscape/config.ts) (`biomeVariety` 0..1, `biomeScale`).
- **Effort M / Value high / Risk med** — risk is in tuning the noise scale so a "region" lasts a
  pleasing distance (tens of world-units), and in keeping `biomeVariety = 0` an exact reproduction
  of today's city (so the knob is a true superset). **2a ships with only existing city kinds** —
  density and skyscraper-frequency varying by urbanism — which proves macro coherence before any
  new art exists. That de-risks the whole centerpiece.
- **Implementation notes** — biome is computed **live**; it needs no world rebuild (unlike `seed`/
  `parallaxLayers` in [scene.ts:131](../../src/cityscape/scene.ts#L131)). Add a small pure unit test
  asserting `biome(seed, x)` is deterministic and that variety=0 collapses to the current behavior.

### 2. Countryside content (2b)

- **Observation** — `Building.draw` assumes body + windows + roof. Trees/fields have none of that.
- **Proposed change** — add windowless `BuildingKind`s (`tree`, `barn`, `silo`, with `field` as
  mostly open gaps) and a small **shape branch** in `drawBody`: `box` (default) vs `tree` (trunk
  rect + canopy circle/polygon) vs low rounded `mound`. `cols/rows = 0` already suppresses windows
  cleanly ([window-grid.ts:93](../../src/cityscape/buildings/window-grid.ts#L93)). `silo`/`barn`
  reuse the `watertower`/`barrel`/`pitched` roofs from doc 01 #3.
- **Affected files** — [kinds.ts](../../src/cityscape/buildings/kinds.ts) (kinds + generators);
  [building.ts](../../src/cityscape/buildings/building.ts) (shape branch in `drawBody`);
  [district.ts](../../src/cityscape/generation/district.ts) (countryside district rules).
- **Effort M / Value high / Risk med** — the `SUBSTITUTE` map in
  [spawner.ts:34](../../src/cityscape/generation/spawner.ts#L34) must learn the new kinds so the
  near-layer exclusion logic doesn't throw.
- **Implementation notes** — keep tree silhouettes simple (one canopy blob); detail is invisible at
  parallax scale and costs draw commands across a forest.

### 3. Coast biome (2c)

- **Observation** — the waterfront (water + shore) is global config
  ([water.ts](../../src/cityscape/sky/water.ts), [shore.ts](../../src/cityscape/sky/shore.ts)),
  driven by `waterLevel`/`shoreHeight`. A coast biome wants _more_ water and sparse, low structures.
- **Proposed change (v1, cheap)** — coast = a sparse biome: wide gaps, only `house`/`tree`/`barn`,
  lots of open shore. Lean on the existing water/shore as-is.
- **Affected files** — [district.ts](../../src/cityscape/generation/district.ts) (coast rules);
  `biome.ts`.
- **Effort M / Value med / Risk med** — a _dynamic waterline_ (water visibly widening in coastal
  stretches) is the tempting version but `waterLevel` is a single global knob read by water/shore
  every tick; making it positional couples three entities to the biome field. **Deferred to 2d / a
  later pass** — v1 fakes "coast" with sparseness + open shore, which reads fine at night.

### 4. Transition blending + far-layer terrain (2d)

- **Proposed change** — (a) ensure biome boundaries cross-fade (the noise axis already gradients
  density; add kind-mix blending in the overlap band so a lone farmhouse can sit at a town's edge);
  (b) give the **far** bands rolling `hill`/treeline silhouettes (a wide, low, rounded `mound`
  shape) so the horizon itself changes between city and country.
- **Effort M–L / Value med / Risk med** — open question whether distant ridgelines are discrete
  `mound` buildings (cheap, reuses everything) or a dedicated continuous terrain entity (smoother,
  more work). Recommend discrete mounds for v1.

## Scaffold (2a) — implemented & verified ✅

Landed: a shared [`BiomeField`](../../src/cityscape/generation/biome.ts) (value-noise urbanism axis,
no RNG) biases District transitions in [`district.ts`](../../src/cityscape/generation/district.ts);
the [spawner](../../src/cityscape/generation/spawner.ts) samples one shared field per band at a
near-plane-converted coordinate; knobs `biomeVariety` (default **0**) + `biomeScale` (default 5).
A 6-probe adversarial verification confirmed: cross-layer coherence (all bands share one journey),
determinism with the journey on, reverse-scroll/extreme-knob bounding, live-knobs-don't-rebuild,
and visible macro structure.

- **Resolved — zoning mechanism:** value-noise on an urbanism axis (chosen).
- **Resolved — default `biomeVariety`:** uniform city by default (journey opt-in); the curated
  snapshot is byte-unchanged (golden test).
- **Accepted by design — live-toggle path-dependence:** because the District FSM is stateful and
  `biomeVariety` is a live (non-structural) knob, a `0→1→0` slider round-trip does not restore the
  exact untouched-seed city. Documented in `biome.ts`; not made structural (that would rebuild the
  world per slider tick). Construction/permalink loads remain byte-exact.
- **Open — legibility tuning (for task 16):** the journey is real but slow at `biomeScale=5`
  (~3.3 min/cycle). Consider lowering the default (≈2–3) after a visual review.

## Open questions / decisions needed (for 2b–2d)

- **Trees/hills representation** — new `Building` kinds + a `drawBody` shape branch (recommended:
  reuses pooling/spawner/recycle) vs dedicated terrain entities?
- **Coast** — v1 sparse-waterfront fake (recommended) vs a positional/dynamic waterline (defer)?
