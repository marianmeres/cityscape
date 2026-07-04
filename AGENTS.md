# @marianmeres/cityscape — Agent Guide

Procedurally-generated parallax animation. **The architecture is the point**: a pure, DOM-free,
deterministic simulation core behind a swappable renderer seam (Canvas + ASCII + PixelArt). To prove
the seam and the engine are genuinely reusable, **two** content domains ride the same engine +
renderers + schema-panel: `cityscape/` (a night skyline) and `naturescape/` (a sunlit, day-cycling
nature valley). They are siblings — neither imports the other; both depend only inward on `engine/`.

> This codebase was authored end-to-end by an AI agent from a high-level brief; it's a study piece.
> Keep that bar: clean, well-commented, tested, idiomatic.

## Quick Reference

- **Stack**: Deno · TypeScript · DOM (browser runtime only) · published to JSR + npm.
- **Test**: `deno task test` (= `deno test -A`) | **Type-check**: `deno task check` (= `deno check src/ tests/`)
- **Format/lint**: `deno fmt` · `deno lint` (tabs, 90 cols, indent 4)
- **Example**: one installable SPA. `deno task example:theme` (once) then `deno task example:build` → `example/dist/bundle.js`; `deno task serve` and open `http://localhost:8000/example/`.
- **SPA shape**: `example/main.ts` is a hash router over `#app` — a chooser (`#/`) plus the two worlds (`#/city`, `#/nature`). Each route is a `ViewFactory` returning a leak-free `destroy()`; switching worlds is a client-side swap. `example/manifest.webmanifest` + iOS meta in `index.html` make it home-screen-installable + full-screen on mobile.
- **Old URLs**: `example/{city,nature}/index.html` are now redirects into the SPA routes.

## Project Structure

```
src/
  mod.ts                 ⮕ "."             convenience barrel (high-level browser API)
  engine/                ⮕ "./engine"      generic, headless, DOM-FREE, reusable
    math/{rng,noise,ease,color}.ts         seeded RNG · value noise · easing · Oklab colour
    time/clock.ts                          FixedStepper (fixed-dt loop)
    scene/{entity,camera,layer,world}.ts   parallax scene graph (generic over an Env)
    render/{draw-command,renderer}.ts      the DrawCommand union + Renderer interface (THE SEAM)
    config/{schema,serialize}.ts           generic schema-driven config (shared by both domains) · config⇄URL-hash
    loop/engine.ts · input/input.ts        rAF-agnostic loop (scheduler injected) · pure pointer model
  cityscape/             ⮕ "./cityscape"   the city domain, DOM-FREE
    config.ts            CONFIG_SCHEMA (source of truth) · DEFAULT_CONFIG · normalizeConfig
    palette.ts · mood.ts · events.ts · env.ts · scene.ts (createCityscape)
    buildings/{kinds,building,window-grid}.ts
    sky/{backdrop,aurora,starfield,moon,cloud,bird,flyer,water,shore,fog,traffic}.ts
    generation/{biome,district,spawner,skyline}.ts
  naturescape/           ⮕ "./naturescape" the nature domain, DOM-FREE (sibling of cityscape)
    config.ts · palette.ts · season.ts · mood.ts (the DAY clock + season blend) · events.ts · env.ts · scene.ts (createNaturescape)
    features/{kinds,feature}.ts            trees · pines · cabins · rocks · bushes · hills (the land's "buildings")
    scenery/{backdrop,sun,mountains,cloud,bird,flyer,lake,meadow}.ts
    weather/{rain,snow,rays,rainbow}.ts · wildlife.ts (deer · fish · butterflies)
    generation/{biome,zone,spawner,landscape}.ts
  engine/render/pixel/   pure pixel-art math (Bayer dither · median-cut palette · Oklab LUT), tested
  render/shared/draw2d.ts  per-DrawCommand Canvas2D rasteriser (shared by Canvas + PixelArt)
  render/canvas/  ⮕ "./render/canvas"  · render/ascii/  ⮕ "./render/ascii"  · render/pixelart/  ⮕ "./render/pixelart"
  runtime/{mount,mount-nature}.ts   audio/{ambient,nature}-audio.ts   ui/panel.ts  ⮕ "./ui"   (the only DOM code)
tests/                 DOM-free unit suite (mirrors src/ modules; covers both domains)
example/               installable SPA: index.html (shell) + main.ts (hash router) + chooser.ts + worlds/scape.ts + manifest/sw/icons/theme; {city,nature}/ are redirect stubs
docs/SPEC.md           design & architecture (read this first)
```

## Critical Conventions

1. **The core is DOM-free.** Nothing under `engine/`, `cityscape/` or `naturescape/` may touch the
   DOM, browser globals, a renderer, or `@marianmeres/vanilla`/`design-tokens`. This is a **tested
   invariant** — see [tests/dom-purity.test.ts](tests/dom-purity.test.ts). DOM lives only in
   `render/canvas`, `runtime`, `audio`, `ui`.
2. **The renderer seam.** Entities emit `DrawCommand`s into a `DisplayList`; a `Renderer` consumes
   it. Never reach for a canvas inside the simulation. New visual primitive → add to the
   `DrawCommand` union and handle it in the shared `render/shared/draw2d.ts` rasteriser (covers
   **Canvas + PixelArt**) **and** the `AsciiRenderer`. The pixel-art look is a post pass over the
   shared raster, so it needs no per-primitive code of its own.
3. **Deterministic.** Everything derives from `config.seed` via `createRng` + `fork`. No
   `Math.random()` / `Date.now()` in `engine/` or `cityscape/` (allowed in `runtime/audio/ui`).
   Entities hold their own forked rng so update order can't change output.
4. **Two phases per entity.** `update(ctx)` resolves appearance from the `Env` (mood/config) and
   caches it; `draw(ctx)` is pure geometry + cached colours (no env, no clock, no DOM).
5. **Units.** Vertical = fraction of viewport height; **horizontal = viewport-height units**
   (`Camera.unit` = height × zoom) so building aspect ratios are constant at any window size.
6. **Config is schema-driven.** The field-descriptor types + `buildDefaults`/`normalizeConfig` are
   generic and live in [src/engine/config/schema.ts](src/engine/config/schema.ts); each domain
   supplies its own `CONFIG_SCHEMA` + config interface (e.g. [src/cityscape/config.ts](src/cityscape/config.ts),
   [src/naturescape/config.ts](src/naturescape/config.ts)). Add a knob by editing that domain's
   `CONFIG_SCHEMA` + interface; the panel and `DEFAULT_CONFIG` follow automatically. The
   `*-config.test.ts` suites enforce schema↔interface parity. The control panel
   (`createControlPanel<C>`) is generic over the config type — pass `{ config, schema }`.
7. **Live vs structural config.** Most knobs are read live each tick. Only `seed` and
   `parallaxLayers` rebuild the world (see `scene.setConfig`).
8. **Format.** `deno fmt` (tabs, 90 cols). Public exports need JSDoc + explicit return types (JSR).

## Before Making Changes

- [ ] Read [docs/SPEC.md](docs/SPEC.md) (architecture) and the target module's header JSDoc.
- [ ] Match the existing patterns in a sibling file.
- [ ] Keep `engine/` + `cityscape/` DOM-free (the purity test will fail otherwise).
- [ ] `deno task check` and `deno task test` stay green; `deno fmt`.
- [ ] Browser-only code (canvas/panel/audio/mount) isn't Deno-unit-testable — verify by serving
      `example/` over `http://`, or render headlessly via `AsciiRenderer` (string output).
- [ ] Rebuild the example bundle if you changed `src/` and want the demo current: `deno task example:build`.

## Documentation Index

- [docs/SPEC.md](docs/SPEC.md) — design contract, layering, the seam, generation strategy.
- [docs/PROGRESS.md](docs/PROGRESS.md) — build log + decisions (incl. notable bug fixes).
- [API.md](API.md) — public API reference.
- [README.md](README.md) — human overview + authorship note.
