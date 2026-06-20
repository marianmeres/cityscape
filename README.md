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

## Install

```ts
import { mountCityscape } from "jsr:@marianmeres/cityscape";
```

| Subpath                                  | What                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `@marianmeres/cityscape`                 | high-level API: `mountCityscape`, `createCityscape`, renderers, panel, config |
| `@marianmeres/cityscape/engine`          | the generic, headless animation engine (reusable on its own)                  |
| `@marianmeres/cityscape/cityscape`       | the city domain: config, palettes, mood, entities, generation                 |
| `@marianmeres/cityscape/render/canvas`   | `CanvasRenderer`                                                              |
| `@marianmeres/cityscape/render/ascii`    | `AsciiRenderer` (headless, string-producing)                                  |
| `@marianmeres/cityscape/render/pixelart` | `PixelArtRenderer` (low-res, palette-quantised, dithered)                     |
| `@marianmeres/cityscape/ui`              | the schema-driven control panel                                               |

## Run the example

```sh
deno task theme:build      # generate the panel's design-tokens CSS (once)
deno task example:build    # bundle example/main.ts → example/dist/bundle.js
# then serve the repo over http:// and open example/index.html
```

In the example: **move** the pointer for parallax + vertical pan · **wheel** to scrub speed ·
**click** to flash a building's windows · press **`a`** to toggle the ASCII view · **`p`** for the
pixel-art view (**`[`** / **`]`** adjust the pixel size) · **`h`** to hide the panel · the **🔗**
button copies a permalink that restores the exact look.

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
