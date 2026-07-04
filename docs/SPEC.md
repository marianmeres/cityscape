<!--
SPEC — @marianmeres/cityscape
Produced 2026-06-19 (greenfield, no commits yet).
This is the design contract the implementation follows. It is a living document;
PROGRESS lives in docs/PROGRESS.md.
-->

# @marianmeres/cityscape — Spec & Architecture

> An infinite, procedurally-generated, parallax **night-city-skyline** animation. A full-page
> 2D canvas shows a calm, dark, Batman-night skyline scrolling sideways; buildings spawn as they
> enter view across multiple parallax depths; colours breathe on a slow warmer→cooler→darker
> cycle; a moon, stars, clouds, birds and the odd plane drift past; windows light up and dim
> like a living city; sparse synthesised ambient sound (distant horn, wind) plays if unmuted.
>
> **The real deliverable is the architecture.** The animation is the demo that proves it. The
> single hard constraint everything else serves: a clean seam between a **pure, DOM-free
> simulation core** (fully unit-testable) and a **swappable renderer**. We ship three renderers
> from one display-list to prove the seam is real: a Canvas2D renderer, an ASCII renderer, and a
> pixel-art renderer (low-res + palette-quantised + ordered-dithered).

## 1. Decisions (locked)

| Area              | Decision                                                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual north star | Calm deep-navy night **default**, built as a **swappable palette system** (vaporwave / ink / dawn drop in via config). One global "mood phase" drives sky + tints + window warmth together.                       |
| Renderer seam     | Entities emit **renderer-agnostic draw commands** (a display list). Ship **`CanvasRenderer`** (Canvas2D) **+ `AsciiRenderer`** (char grid) **+ `PixelArtRenderer`** (low-res, dithered) to prove swappability.    |
| Audio             | **WebAudio-synthesised** ambient (drone + sparse stochastic horn/wind). **Muted by default.** No audio assets. The _decision_ to emit a sound is part of the pure sim (an event); synthesis is a browser adapter. |
| Interaction       | **Passive by default** (good as a page background) + **optional light interaction** (pointer parallax, wheel scrubs speed, click toggles a window). Input is a decoupled, disable-able module.                    |
| Module boundary   | **Generic headless engine** underneath + **cityscape content** on top. Both exposed via **JSR subpath exports** so the engine is independently reusable.                                                          |
| Determinism       | Fully **seeded**. `seed + config` reproduces the exact city. Enables unit tests and shareable permalinks.                                                                                                         |
| Tests             | **Thorough core unit tests** — every pure unit is Deno-testable with no DOM.                                                                                                                                      |
| Tech              | Deno + plain TS, no frameworks. Panel built with **@marianmeres/vanilla** (reactive core) + **@marianmeres/design-tokens** (themed CSS). Bundled with **@marianmeres/deno-build**.                                |

## 2. Layering (the architecture)

Four concentric layers; each inner layer is ignorant of every outer one. **Dependencies point
inward only.** The two innermost layers are 100% DOM-free and unit-tested.

```
┌─ runtime / ui / audio (browser glue) ──────────────────────────────┐
│  mount full-page canvas · control panel (vanilla) · WebAudio synth  │
│  ┌─ renderers (target adapters) ─────────────────────────────────┐  │
│  │  CanvasRenderer · AsciiRenderer · PixelArtRenderer (dithered)  │  │
│  │  ┌─ cityscape (domain content) ─── DOM-FREE, TESTED ────────┐  │  │
│  │  │  config · palette · mood · buildings · sky · generation  │  │  │
│  │  │  ┌─ engine (generic) ──────── DOM-FREE, TESTED ───────┐  │  │  │
│  │  │  │  math (rng/noise/ease/color) · time · scene        │  │  │  │
│  │  │  │  draw-command · Renderer iface · loop · input      │  │  │  │
│  │  │  └────────────────────────────────────────────────────┘  │  │  │
│  │  └───────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**The seam.** The engine defines a `Renderer` interface and a `DrawCommand` union (rect, polygon,
circle, gradient, line, glow, text). The simulation `collect()`s a `DisplayList` of draw commands;
a renderer consumes it. The simulation never imports a renderer, a canvas, or the DOM. Swapping
Canvas→ASCII→PixelArt is swapping the consumer of the same list. This is what makes the architecture
claim real rather than aspirational — and the ASCII renderer, being string-producing, is itself
unit-tested. The pixel-art renderer goes further: its hard parts (palette extraction, the
quantisation LUT, the Bayer dither) are pure, DOM-free helpers in `engine/render/pixel`, so they too
are unit-tested — only the thin canvas glue (offscreen buffer + nearest-neighbour upscale) is browser-only.

## 3. Module map

`src/` (subpath export roots marked **⮕**):

```
mod.ts                       ⮕ "."            convenience barrel (browser): scene + canvas + ascii + pixelart + ui + mount
engine/                      ⮕ "./engine"     generic, headless, reusable
  math/rng.ts                seeded PRNG (mulberry32) — next/int/float/bool/pick/fork
  math/noise.ts              seeded 1-D value noise (smooth) — drives mood + organic drift
  math/ease.ts               lerp · clamp · smoothstep · wrap · easings
  math/color.ts              RGB color · mix (perceptual, oklab-space) · hsl · toCss
  time/clock.ts              Clock + FixedStepper (fixed-dt update decoupled from render)
  scene/entity.ts            Entity interface · UpdateContext · DrawContext
  scene/camera.ts            Camera: scroll position + parallax projection per depth
  scene/layer.ts             Layer: one depth band (parallax factor + entity set)
  scene/world.ts             World: layers + camera; update() + collect()->DisplayList
  render/draw-command.ts     DrawCommand union + DisplayList + small builder helpers
  render/renderer.ts         Renderer interface (begin/submit/end/resize)
  render/pixel/dither.ts     Bayer ordered-dither matrix (pure) — pixel-art gradients
  render/pixel/palette.ts    median-cut palette extraction + Oklab quantisation LUT (pure)
  loop/engine.ts             Engine: rAF loop wiring World+Renderer(+input+audio); scheduler injectable
  input/input.ts             PointerInput source (pointer/wheel) -> intents; optional, decoupled
  config/serialize.ts        generic config <-> URL-hash (base64-json) round-trip
cityscape/                   ⮕ "./cityscape"  domain content, headless
  config.ts                  CityscapeConfig · CONFIG_SCHEMA (field descriptors) · DEFAULT_CONFIG · normalize
  palette.ts                 Palette type + registry (navy/vaporwave/ink/dawn)
  mood.ts                    Mood: time -> resolved {sky stops, tints[depth], windowWarmth, moon, star}
  events.ts                  AmbientEventBus: stochastic ambient events (horn/wind/dog) — pure
  buildings/building.ts      Building entity: silhouette + window grid; BuildingSpec
  buildings/kinds.ts         per-kind generators: skyscraper · midrise · factory · house · landmark
  buildings/window-grid.ts   window occupancy model (slow on/off + floor sweeps, low blink)
  sky/moon.ts                Moon (phase + halo), occasional
  sky/starfield.ts           parallax stars with subtle twinkle
  sky/cloud.ts               drifting clouds (can dim the moon)
  sky/bird.ts                occasional bird flocks
  sky/flyer.ts               rare crossers: plane (blinking) · satellite · shooting star
  generation/district.ts     zoning FSM: district sequence + adjacency rules (no factory beside tower)
  generation/spawner.ts      per-layer spawn/recycle: object pool + viewport culling (the "infinite")
  generation/skyline.ts      assemble depth-banded layers from config (parallax + atmospheric haze)
  scene.ts                   createCityscape(config) -> CityscapeScene (the headless top-level)
render/
  shared/draw2d.ts           per-DrawCommand Canvas2D rasteriser, shared by Canvas + PixelArt
  canvas/canvas-renderer.ts  ⮕ "./render/canvas"    CanvasRenderer implements Renderer (Canvas2D, DPR-aware)
  ascii/ascii-renderer.ts    ⮕ "./render/ascii"     AsciiRenderer implements Renderer (char grid; headless-capable)
  pixelart/pixelart-renderer.ts ⮕ "./render/pixelart" PixelArtRenderer (low-res buffer + scene palette + Bayer dither)
runtime/mount.ts             mountCityscape(opts): full-page canvas + Engine + input + audio (browser)
audio/ambient-audio.ts       AmbientAudio: WebAudio synth consuming AmbientEvents (browser, optional)
ui/panel.ts                  ⮕ "./ui"  createControlPanel(schema, config): floating panel (vanilla + design-tokens)
```

## 4. Key contracts (the frozen seams)

```ts
// engine/render/draw-command.ts — renderer-agnostic primitives
type Color = { r: number; g: number; b: number; a: number }; // 0..255, a 0..1
type Stop = { at: number; color: Color }; // gradient stop, at 0..1
type DrawCommand =
	| { kind: "rect"; x; y; w; h; color: Color }
	| { kind: "polygon"; points: number[]; color: Color } // flat [x,y,x,y,...]
	| { kind: "circle"; x; y; r; color: Color }
	| { kind: "gradient"; x; y; w; h; stops: Stop[]; vertical?: boolean }
	| { kind: "line"; x1; y1; x2; y2; width; color: Color }
	| { kind: "glow"; x; y; r; color: Color; intensity: number } // soft radial light
	| { kind: "text"; x; y; text; size; color: Color }; // ASCII renderer mainly
interface DisplayList {
	width: number;
	height: number;
	commands: DrawCommand[];
}

// engine/render/renderer.ts — the swappable seam
interface Renderer {
	resize(width: number, height: number, dpr?: number): void;
	render(list: DisplayList): void; // begin+submit+end folded into one call
}

// engine/scene/entity.ts
interface UpdateContext {
	dt: number;
	time: number;
	rng: Rng;
	mood: Mood;
	config;
	bus: AmbientEventBus;
}
interface DrawContext {
	list: DisplayList;
	camera: Camera;
	mood: Mood;
	viewport: { w; h };
}
interface Entity {
	depth: number; // 0 (far) .. 1 (near) — parallax + haze
	bounds: { x: number; width: number }; // world-space horizontal extent (for culling)
	update(ctx: UpdateContext): void;
	draw(ctx: DrawContext): void; // pushes DrawCommands; never touches DOM
	alive: boolean;
}

// cityscape/scene.ts — headless top-level
interface CityscapeScene {
	readonly world: World;
	readonly config: CityscapeConfig;
	update(dtMs: number): void; // advance the simulation
	collect(width: number, height: number): DisplayList;
	setConfig(patch: Partial<CityscapeConfig>): void; // live panel edits
	events: AmbientEventBus;
}
```

The `Mood` object is the unifier: a single noise-driven phase resolves to the sky gradient stops,
the per-depth building tints, the window warmth, and moon/star colours — so "warmer → calmer →
darker → slightly-less-dark" is one coherent breathing cycle, not three unrelated fades.

## 5. The "make sense" generator (districts)

A small zoning state machine (`generation/district.ts`) emits a sequence of **districts**
(`downtown` towers → `commercial` midrise → `residential` houses → `industrial` factories →
`park`/gap). Allowed transitions are constrained (`industrial`↛`downtown` directly; a `park`
buffers them), so a factory never sits beside a skyscraper. Each district yields `BuildingSpec`s
with kind-appropriate height/width/colour/roof-detail distributions. `spawner.ts` pulls specs as
the camera advances, instantiates pooled `Building` entities entering the viewport, and recycles
those that exit — giving an infinite world at bounded memory. Each parallax layer runs its own
district stream at its own scale, seeded as a deterministic fork of the master seed.

## 6. Config & the panel

`CONFIG_SCHEMA` is an array of typed field descriptors (`range`/`select`/`toggle`/`color`, with
`min/max/step/options/label/group`). `DEFAULT_CONFIG` is derived from it. The panel
(`ui/panel.ts`) is **generated from the schema** — so adding a knob is a one-line schema edit, and
a static `<template>` wouldn't fit a schema-driven control list (this is why the panel builds DOM
via `document.createElement` + vanilla's reactive `observable`/`reactTo`, not `fromTemplate`; the
"no markup-from-strings" rule is honoured — no `innerHTML`). Config round-trips to the URL hash
(`config/serialize.ts`) so a chosen look is a shareable permalink.

Planned knobs: `seed`, `palette`, `cameraSpeed`, `cameraDirection`, `parallaxLayers`,
`spawnDensity`, `moodCycleSeconds`, `darkness`, `colorTemperature`, `windowLightChance`,
`windowToggleRate`, `moonChance`, `starDensity`, `cloudChance`, `birdChance`, `flyerChance`,
`pointerParallax`, `audioEnabled`, `audioVolume`, `showStats`.

## 7. Testing strategy (DOM-free)

Unit-tested: `rng` (determinism, distribution, `fork` independence), `noise` (smoothness, range,
determinism), `ease`/`color` (math + `mix` monotonicity), `clock`/`FixedStepper` (accumulator),
`camera` (parallax projection), `world` (update/collect ordering), `mood` (cycle bounds + warm/cool
direction), `district` (legal transitions, no illegal adjacency over N runs), `spawner` (pool reuse,
culling, no leak), `config` (normalize + serialize round-trip), `draw-command` (builder output),
**`ascii-renderer`** (rasterises a known display list to an expected string — this doubly verifies
the seam), and the **pixel-art primitives** (`pixel-dither`: Bayer matrix construction + tiling;
`pixel-palette`: median-cut extraction, the Oklab quantisation LUT, and dithered quantisation
output). `CanvasRenderer`, `PixelArtRenderer`'s canvas glue, `panel`, `mount`, `audio` are
browser-only and verified by serving `example/` (documented, not Deno-unit-tested), mirroring
vanilla's convention.

## 8. Milestones (build order)

1. **Engine foundation** — math, draw-command, renderer iface, scene (entity/camera/layer/world), clock, loop, input, serialize. _(frozen seams first)_
2. **Cityscape domain** — config+schema, palette, mood, buildings, sky, generation, scene, events.
3. **Renderers** — CanvasRenderer + AsciiRenderer.
4. **Runtime/UI/Audio** — mount, control panel (vanilla+design-tokens), ambient audio.
5. **Example** — one installable, hash-routed SPA: `example/index.html` (shell + manifest/iOS meta) + `example/main.ts` (router over `#app`) + `chooser.ts` + `worlds/scape.ts` + generated theme tokens + a service worker; bundle with deno-build. Full-screen on mobile via Add-to-Home-Screen.
6. **Tests** — thorough DOM-free suite; `deno test` + `deno check` green.
7. **Adversarial review** — DOM-purity (no DOM import reaches engine/cityscape), correctness, coverage; fix.

## 9. A second domain: `naturescape` (proving the seam)

The strongest evidence that the engine/renderer seam is real is a **second, unrelated content
domain built on the same foundation**. `src/naturescape/` is a full sibling of `src/cityscape/`: an
infinite, day-cycling **nature valley** (rolling forested hills, distant snow-capped mountains, a
reflective lake, cabins, clouds, birds, balloons; selectable + auto-cycling seasons; rain, snow,
god-rays and a rainbow; deer, fish rises and butterflies). It reuses, unchanged:

- the entire generic **`engine/`** (math, scene graph, the `DrawCommand`/`Renderer` seam, loop, input);
- **all three renderers** (Canvas, ASCII, PixelArt) and the shared `draw2d` rasteriser;
- the **schema-driven control panel** — made generic (`createControlPanel<C>`) so it renders any
  domain's `CONFIG_SCHEMA` (the field-descriptor types + `buildDefaults`/`normalizeConfig` were
  lifted into `engine/config/schema.ts`, shared by both domains);
- the config⇄URL-hash permalink machinery and the runtime/audio patterns.

Only the **content layer** is new, and it maps one-to-one onto the city's: `palette` + `season`
(two orthogonal colour axes) feed one `mood.ts` **day clock** (the analogue of the city's night
mood clock — a single phase resolves sky, sun, haze, water and foliage together, and stays light
all cycle long); `features/` are the land's "buildings" (trees/cabins/rocks/hills); `scenery/` +
`weather/` are its sky/atmosphere; a `generation/` **zone** FSM + shared biome field sequences
meadow → grove → forest → foothills → alpine so the landscape "makes sense" exactly as the city's
district FSM does. The two domains are siblings: neither imports the other; both are DOM-free
(the purity test covers both) and fully deterministic from `seed`. `mountNaturescape()` is the
nature counterpart of `mountCityscape()`. It's the `#/nature` route of the example SPA (the chooser
at `#/` is the landing route; `worlds/scape.ts` drives both the city and the valley from one factory).

See [PROGRESS.md](./PROGRESS.md) for live status.
