# @marianmeres/cityscape

[![JSR](https://jsr.io/badges/@marianmeres/cityscape)](https://jsr.io/@marianmeres/cityscape)
[![NPM](https://img.shields.io/npm/v/@marianmeres/cityscape)](https://www.npmjs.com/package/@marianmeres/cityscape)
[![License](https://img.shields.io/npm/l/@marianmeres/cityscape)](LICENSE)

An infinite, procedurally-generated, **parallax night-city-skyline** animation for a full-page
2D canvas. A calm, dark, Batman-night skyline scrolls sideways across the water; buildings spawn
as they enter view at multiple depths; the whole palette breathes on a slow warmer→cooler→darker
cycle; a moon, stars, clouds, birds and the odd plane drift past; lit windows flicker like a
living city; a lamp-lit shore separates the city from a reflective sea; the camera floats gently;
and sparse synthesised ambient sound plays if you unmute it.

```ts
import { mountCityscape } from "@marianmeres/cityscape";

mountCityscape(); // full-page animated background + control panel. That's it.
```

> ### A note on authorship
>
> I (Marian) did **not** write a single line of this code — it was generated end-to-end by an AI
> coding agent (Claude Code). I only described what I wanted at a high level (the brief, a handful
> of preferences, and feedback as it went along), then reviewed and steered. I'm keeping it public
> as a **study piece**: a small-but-real example of how to architect a renderer-agnostic
> animation / game-like framework, for me — and anyone curious — to read and learn from. So treat
> it as **100% AI-authored, human-curated**. The internals (especially the pure simulation core
> and the renderer seam) are the point; the pretty skyline is just the proof.

## Why it's interesting (the architecture)

The animation is the demo; the architecture is the point. The whole simulation is a **pure,
DOM-free, deterministic core**, and a **swappable renderer** turns it into pixels. To prove the
seam is real, it ships **three** renderers that consume the _same_ draw list — a Canvas2D renderer,
an ASCII renderer, and a pixel-art renderer (low-res, palette-quantised, ordered-dithered) — and you
can toggle between them live.

- **Renderer-agnostic core.** Entities emit a `DisplayList` of abstract draw commands (rect,
  polygon, circle, gradient, line, glow). A `Renderer` rasterises it. Swapping Canvas → ASCII →
  PixelArt is swapping the consumer of the same list — the simulation never changes.
- **Pure & deterministic.** `engine/` and `cityscape/` never touch the DOM — a
  [test enforces it](tests/dom-purity.test.ts). Same `seed` + config reproduces the exact city,
  which is why it's unit-testable and why a chosen look is a shareable URL-hash permalink.
- **One mood clock.** A single slow phase resolves the sky gradient, building tints, window
  warmth and moon/star colours together, so transitions are inherently coherent.
- **Districts that make sense.** A small zoning state machine sequences downtown towers →
  midrise → houses → factories → parks, so a factory never sits beside a skyscraper.
- **Infinite at bounded cost.** Per-layer spawners pool and recycle buildings as the camera
  moves; memory stays flat.
- **Schema-driven panel.** The floating control panel is generated from the config schema (built
  with [`@marianmeres/vanilla`](https://jsr.io/@marianmeres/vanilla) +
  [`@marianmeres/design-tokens`](https://jsr.io/@marianmeres/design-tokens)). Add a knob with a
  one-line schema edit.

## What kind of thing is it?

**Not a game framework** — though it borrows a fixed-timestep loop and a scene graph from one.
There's no player, no goal, no physics, no collision, and entities never interact: a building
doesn't know a cloud exists. Input is optional and purely decorative. A game simulates a system
_reacting to an agent_; this simulates a world that _ignores you_.

**Nor is it just an "animation" or "drawing" library** — the word _drawing_ points at the renderer,
which is the least important, most swappable, furthest-downstream part. The core deliberately draws
nothing: it **simulates and then describes**, and turning that description into pixels is somebody
else's job (three times over — Canvas, ASCII, PixelArt).

What it actually is, is two well-worn patterns fused with nothing content-specific between them:

1. **A deterministic simulation kernel** — seeded RNG + value noise + a fixed-step clock, so
   `seed + config` reproduces the exact frame. That lineage is demoscene / reproducible-sim, not games.
2. **A miniature render-hardware-interface.** The `DrawCommand` union + `DisplayList` + `Renderer`
   seam is, structurally, a command buffer with interchangeable backends — the same idea as a
   graphics RHI, or a retained scene graph flattened to draw calls.

> **A deterministic, procedural _ambient-scene engine_** — a headless world-simulator that emits a
> renderer-agnostic display list.

Spiritually it's a screensaver / living-wallpaper / demoscene engine, built with the architectural
rigor (a DOM-free seam, a purity test, a second domain proving reuse) you'd normally only find in a
real graphics stack. That `cityscape/` and `naturescape/` ride the _identical_ engine, renderers and
panel — neither importing the other — is the proof the seam is load-bearing rather than a
city-specific accident. The two worlds are just the test harness that happens to be pretty.

One honest caveat: because nothing here gives entities physics, shared state or a way to affect one
another, "engine" promises a little more than it delivers. It's an engine for a **specific shape of
problem** — infinite, depth-banded, deterministic, passive 2.5D scenes. Inside that shape it's
complete; outside it (anything where entities must react to each other) you'd be building on sand.
That's the scope being honest, not a flaw.

## Install

```ts
import { mountCityscape } from "jsr:@marianmeres/cityscape";
```

| Subpath                                  | What                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `@marianmeres/cityscape`                 | high-level API: `mountCityscape`, `createCityscape`, renderers, panel, config |
| `@marianmeres/cityscape/engine`          | the generic, headless animation engine (reusable on its own)                  |
| `@marianmeres/cityscape/cityscape`       | the city domain: config, palettes, mood, entities, generation                 |
| `@marianmeres/cityscape/naturescape`     | a second domain on the same engine: a sunlit day-cycling nature valley        |
| `@marianmeres/cityscape/render/canvas`   | `CanvasRenderer`                                                              |
| `@marianmeres/cityscape/render/ascii`    | `AsciiRenderer` (headless, string-producing)                                  |
| `@marianmeres/cityscape/render/pixelart` | `PixelArtRenderer` (low-res, palette-quantised, dithered)                     |
| `@marianmeres/cityscape/ui`              | the schema-driven control panel                                               |

## Run the example

```sh
deno task example:theme    # generate the panel's design-tokens CSS (once)
deno task example:build    # bundle example/main.ts → example/dist/bundle.js
deno task serve            # static-serve the repo, then open http://localhost:8000/example/
```

The example is an **installable, hash-routed SPA** — one app, one manifest: a chooser landing page
plus the three worlds at `#/city`, `#/nature`, `#/shapes`. Switching worlds is a client-side swap
(no reload). On a phone, **Add to Home Screen** launches it full-screen — the manifest declares
`display: fullscreen` and the iOS standalone meta tags make it run chrome-free, edge-to-edge under
the notch.

In any world: **move** the pointer for parallax + vertical pan · **wheel** to scrub speed · **click**
to flash/ripple · press **`a`** to toggle the ASCII view · **`p`** for the pixel-art view (**`[`** /
**`]`** adjust the pixel size) · **`h`** to hide the panel · **`f`** for immersive fullscreen.

> Installability (the Android install prompt, the offline service worker) needs a secure context —
> HTTPS or `localhost`. Over a plain-HTTP LAN address the service worker won't register, but iOS
> Add-to-Home-Screen full-screen still works from the manifest + Apple meta tags alone.

### A second world on the same engine — `naturescape`

The headline isn't the skyline; it's the **seam**. To prove the engine, renderers and schema-panel
are genuinely domain-agnostic, the repo ships a _second_ full domain: an infinite, day-cycling
**nature valley** — rolling forested hills, distant snow-capped mountains, a reflective lake, cabins,
drifting clouds, birds and balloons, with seasons (spring↔winter), weather (rain, snow, god-rays, a
rainbow) and wildlife (deer, fish rises, butterflies). It reuses the _exact_ `engine/`, all three
renderers, and the control panel — only the content layer (`src/naturescape/`) is new.

```ts
import { mountNaturescape } from "@marianmeres/cityscape"; // (or build the example below)
mountNaturescape(); // a calm, sunny, full-page valley
```

The valley is simply the `#/nature` route of the same example SPA — no separate build:

```sh
deno task example:build    # one bundle drives the chooser + all three worlds
# then `deno task serve` and open http://localhost:8000/example/#/nature
```

Each world's menu hops straight to the siblings (and back to the chooser), and the chooser at `#/`
is the SPA's landing route.

## Headless usage (your own loop / renderer)

```ts
import { createCityscape } from "@marianmeres/cityscape/cityscape";
import { AsciiRenderer } from "@marianmeres/cityscape/render/ascii";

const scene = createCityscape({ seed: "paris", palette: "ink" });
scene.resize(120, 40);

const ascii = new AsciiRenderer({ cellWidth: 1, cellHeight: 1 });
ascii.resize(120, 40);

for (let i = 0; i < 60; i++) scene.update(16); // advance ~1s
ascii.render(scene.collect(120, 40));
console.log(ascii.toString()); // the skyline, in text
```

## Configuration

Every knob lives in `CONFIG_SCHEMA` (the panel and `DEFAULT_CONFIG` derive from it). See
[API.md](API.md#configuration) for the full list — highlights: `seed`, `palette`
(navy · vaporwave · ink · pre-dawn), `cameraSpeed` / `cameraDirection` / `zoom`, `cameraHeight` /
`verticalDrift`, `parallaxLayers`, `spawnDensity`, `waterLevel`, `shoreHeight`, `moodCycleSeconds`,
`darkness`, `colorTemperature`, window/sky chances, and audio.

```ts
import { createCityscape } from "@marianmeres/cityscape";
const scene = createCityscape({
	palette: "vaporwave",
	moodCycleSeconds: 45,
	darkness: 0.3,
});
scene.setConfig({ cameraDirection: "left" }); // live edits
```

## Docs

- **[API.md](API.md)** — the public API reference.
- **[docs/SPEC.md](docs/SPEC.md)** — the design & architecture (the "why").
- **[AGENTS.md](AGENTS.md)** — guide for AI agents working in this repo.

## Development

```sh
deno task test     # full DOM-free unit suite
deno task check    # type-check src/ + tests/
deno fmt           # format (tabs, 90 cols)
```

## License

[MIT](LICENSE) © Marian Meres
