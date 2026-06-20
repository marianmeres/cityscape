<!--
GENERATED ANALYSIS — @marianmeres/cityscape · visual overhaul
Produced 2026-06-20 by inline scout → verify pass over the codebase.
Claims verified against the codebase at commit 5997d8f. Planning artifact; no code was changed.
-->

# Atmosphere Polish — depth, identity, and night-mood flourishes

> A grab-bag of independent, in-mood touches to fold in after the centerpiece lands. Each reuses
> existing primitives, is individually shippable, and is ranked so the cheap/broad ones come first.
> All of them must stay **subtle** — this piece's calm is load-bearing, and several of these can
> tip into busy if over-dialed.

## Summary of recommendations

| # | Recommendation                                     | Value   | Effort | Risk |
| - | -------------------------------------------------- | ------- | ------ | ---- |
| 1 | Ground fog / mist over the water and building feet | med     | S–M    | low  |
| 2 | Neon rooftop signs / billboards on near buildings  | med     | S–M    | low  |
| 3 | Water reflections of near-window lights            | med     | M      | low  |
| 4 | Drifting airship/blimp (new flyer type)            | low–med | S      | low  |
| 5 | Aurora / nebula ribbon (palette-gated)             | low–med | M      | med  |

## Findings & recommendations (detailed)

### 1. Ground fog / mist

- **Proposed change** — a low, slowly-drifting translucent `gradient` band sitting at the building
  feet / waterline, thicker on far layers (atmospheric depth). Reads as night haze and deepens the
  parallax separation already done tonally in
  [`silhouetteColor`](../../src/cityscape/mood.ts#L164).
- **Affected files** — new small entity under `src/cityscape/sky/`;
  [skyline.ts](../../src/cityscape/generation/skyline.ts); [config.ts](../../src/cityscape/config.ts)
  (`fog` knob). **Effort S–M / Value med / Risk low.**

### 2. Neon rooftop signs / billboards

- **Proposed change** — on a small fraction of near buildings, a tiny glowing color-cycling rect
  (1–2 hue steps) on the roof or facade. Sings on the `vaporwave` palette
  ([palette.ts:78](../../src/cityscape/palette.ts#L78)); should be rare elsewhere.
- **Affected files** — a roof/facade feature in
  [building.ts](../../src/cityscape/buildings/building.ts) (or a `WindowGrid` sibling);
  [config.ts](../../src/cityscape/config.ts). **Effort S–M / Value med / Risk low** — deterministic
  via the building RNG; gate frequency by palette/biome (metropolis only) to avoid clutter.

### 3. Water reflections of near-window lights

- **Observation** — `Water` reflects the horizon glow, a few fixed generic smears, and shore lamps
  ([water.ts:79–99](../../src/cityscape/sky/water.ts#L79)) — but **not** the city's actual lit
  windows, which is the most striking real-world night reflection.
- **Proposed change** — echo the brightest near-window column lights as extra wavy vertical smears
  tinted by `mood.window`. **Effort M / Value med / Risk low.**
- **Implementation note** — `Water` doesn't know window positions; either (a) couple it to a cheap
  per-frame summary of near-layer lit density (accurate, more wiring) or (b) richer procedural
  smears keyed to `mood.window` + lit-fraction (approximate, cheap). Decide at execute; (b) first.

### 4. Drifting airship/blimp

- **Proposed change** — a new `FlyerType` in
  [FlyerDirector](../../src/cityscape/sky/flyer.ts#L66): a slow blimp with a faintly-lit underside.
  Charming, trivially additive. **Effort S / Value low–med / Risk low.**

### 5. Aurora / nebula ribbon

- **Proposed change** — a noise-driven, slowly-drifting colored `gradient` ribbon high in the sky,
  enabled only for certain palettes (navy/vaporwave). **Effort M / Value low–med / Risk med** —
  easy to overdo; keep faint and rare.

## Open questions / decisions needed

- **Window reflections** — couple `Water` to real near-layer lit density (accurate) vs richer
  procedural smears (cheap)? Recommend cheap first, upgrade only if it reads flat.
- **Neon scope** — all palettes vs vaporwave/metropolis only (recommended)?
- **Aurora** — which palettes, and is it worth it at all vs cut for scope? Lowest priority here.
