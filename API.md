# API

Public API of `@marianmeres/cityscape`. The default entry (`.`) re-exports the high-level
surface; deeper building blocks live under the subpath exports (see the table in the
[README](README.md#install)).

---

## Runtime (browser)

### `mountCityscape(options?)`

Create a full-page canvas, build the scene, drive it with an rAF loop, and wire interaction +
audio. Returns a [`CityscapeHandle`](#cityscapehandle).

**Parameters:** `options` ([`MountOptions`](#mountoptions), optional)

**Returns:** [`CityscapeHandle`](#cityscapehandle)

```ts
import { mountCityscape } from "@marianmeres/cityscape";

const handle = mountCityscape({ writeHash: true });
handle.update({ palette: "ink", zoom: 1.3 });
```

#### `MountOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `container` | `HTMLElement` | `document.body` | Where to attach the canvas. |
| `canvas` | `HTMLCanvasElement` | created | Use an existing canvas instead of creating one. |
| `config` | `Partial<CityscapeConfig>` | `{}` | Initial config overrides. |
| `autoStart` | `boolean` | `true` | Start the loop immediately. |
| `randomizeSeed` | `boolean` | `true` | If no seed given, pick a random one each load. |
| `readHash` | `boolean` | `true` | Read initial config from `location.hash`. |
| `writeHash` | `boolean` | `false` | Mirror config into `location.hash` (permalinks). |
| `interaction` | `boolean` | `true` | Enable pointer/wheel/click interaction. |
| `maxDpr` | `number` | `2` | Cap device pixel ratio. |

#### `CityscapeHandle`

| Member | Type | Description |
|--------|------|-------------|
| `scene` | [`CityscapeScene`](#cityscapescene) | The headless simulation. |
| `engine` | `Engine` | The frame loop. |
| `canvas` | `HTMLCanvasElement` | The canvas in use. |
| `audio` | [`AmbientAudio`](#ambientaudio) | The audio adapter. |
| `renderer` | [`Renderer`](#renderer) | The active renderer. |
| `setRenderer(r)` | `(Renderer) => void` | Swap the active renderer (e.g. Canvas ⇄ ASCII). Not disposed on swap — caller-owned. |
| `update(patch)` | `(Partial<CityscapeConfig>) => void` | Apply config + runtime side-effects (audio, permalink). |
| `onConfigChange(fn)` | `(fn) => () => void` | Subscribe to runtime-initiated changes (wheel scrub); returns unsubscribe. |
| `permalink()` | `() => string` | A shareable URL encoding the current config. |
| `start()` / `stop()` / `destroy()` | `() => void` | Loop + teardown control. |

---

## Headless scene

### `createCityscape(config?)`

Build the headless, renderer-agnostic simulation.

**Parameters:** `config` (`Partial<CityscapeConfig>`, optional) — merged over `DEFAULT_CONFIG`, then
clamped to valid ranges.

**Returns:** [`CityscapeScene`](#cityscapescene)

#### `CityscapeScene`

| Member | Type | Description |
|--------|------|-------------|
| `world` | `World<CityEnv>` | Camera + parallax layers. |
| `config` | `CityscapeConfig` | Live, normalised config (mutated by `setConfig`). |
| `events` | `AmbientEventBus` | Subscribe to drive audio. |
| `time` | `number` | Total simulated time, ms. |
| `update(dtMs)` | `(number) => void` | Advance the simulation by one fixed step. |
| `collect(w, h)` | `(number, number) => DisplayList` | Produce this frame's draw list. |
| `resize(w, h)` | `(number, number) => void` | Viewport resize (also primes a first frame). |
| `setConfig(patch)` | `(Partial<CityscapeConfig>) => void` | Apply config; rebuilds on seed/layers change. |
| `setSway(px, py?)` | `(number, number?) => void` | Pointer-parallax sway (set by the runtime). |
| `poke(x, y)` | `(number, number) => void` | Flash the windows of the building under a screen point. |

```ts
const scene = createCityscape({ seed: "paris" });
scene.resize(800, 400);
for (let i = 0; i < 60; i++) scene.update(16);
const list = scene.collect(800, 400); // hand to any Renderer
```

---

## Renderers

### `Renderer`

The swappable target seam. Implement it to render to any medium.

```ts
interface Renderer {
  resize(width: number, height: number, dpr?: number): void;
  render(list: DisplayList): void;
  dispose?(): void;
}
```

### `CanvasRenderer`

`new CanvasRenderer(canvas: HTMLCanvasElement)` — paints a `DisplayList` onto a Canvas 2D context
(DPR-aware, additive glows). From `@marianmeres/cityscape/render/canvas`.

### `AsciiRenderer`

`new AsciiRenderer(options?)` — rasterises the same `DisplayList` into a character grid. DOM-free
and deterministic, so it's the proof that the seam is real. From `@marianmeres/cityscape/render/ascii`.

| `AsciiOptions` | Type | Default | Description |
|----------------|------|---------|-------------|
| `cellWidth` | `number` | `7` | CSS px per character column. |
| `cellHeight` | `number` | `13` | CSS px per character row. |
| `ramp` | `string` | `" .,:;-=+*oO%#@"` | Dark→bright glyph ramp. |

Extra members: `cols`/`rows` (grid size), `toString()` (the frame as text), `buffer` (raw
brightness `Float32Array`).

### `DisplayList` & `DrawCommand`

```ts
interface DisplayList { width: number; height: number; offsetY: number; commands: DrawCommand[]; }

type DrawCommand =
  | { kind: "rect";     x; y; w; h; color }
  | { kind: "polygon";  points: number[]; color }          // flat [x,y,x,y,…]
  | { kind: "circle";   x; y; r; color }
  | { kind: "gradient"; x; y; w; h; stops; vertical }
  | { kind: "line";     x1; y1; x2; y2; width; color }
  | { kind: "glow";     x; y; r; color; intensity }
  | { kind: "text";     x; y; text; size; color };
```

Colours are `{ r, g, b, a }` (`r/g/b` 0–255, `a` 0–1). `offsetY` is a whole-frame vertical
translation (the camera's vertical movement).

---

## UI

### `createControlPanel(options)`

Build the floating, schema-driven control panel (vanilla + design-tokens). From
`@marianmeres/cityscape/ui`.

| `ControlPanelOptions` | Type | Description |
|-----------------------|------|-------------|
| `config` | `CityscapeConfig` | Current config to reflect. |
| `onChange` | `(Partial<CityscapeConfig>) => void` | Called on any control change. |
| `schema?` | `ConfigField[]` | Defaults to `CONFIG_SCHEMA`. |
| `title?` | `string` | Panel title. |
| `collapsed?` | `boolean` | Start collapsed. |
| `onShare?` | `() => void` | Optional "copy link" handler. |

**Returns** `ControlPanel`: `{ el, set(config), toggle(collapse?), destroy() }`.

---

## Audio

### `AmbientAudio`

`new AmbientAudio(bus: AmbientEventBus)` — a WebAudio synth (no assets) that listens to the
simulation's ambient events. Muted until enabled; needs a user gesture to start.

Members: `setEnabled(on)`, `setVolume(0..1)`, `resume()`, `destroy()`.

---

## Configuration

`CONFIG_SCHEMA: ConfigField[]` is the single source of truth; `DEFAULT_CONFIG` and the panel
derive from it. `normalizeConfig(input)` clamps/validates arbitrary input onto a valid config.

### `CityscapeConfig` fields

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `seed` | `string` | `"cityscape"` | Same seed + config → same city. |
| `palette` | `string` | `"navy"` | `navy` · `vaporwave` · `ink` · `dawn`. |
| `cameraSpeed` | `number` | `22` | Screen px/sec. |
| `cameraDirection` | `"right"\|"left"` | `"right"` | |
| `zoom` | `number` | `1` | Camera distance; >1 zooms in. |
| `cameraHeight` | `number` | `0` | Vertical aim (−0.25..0.25). |
| `verticalDrift` | `number` | `0.02` | Slow automatic vertical float. |
| `pointerParallax` | `boolean` | `true` | Pointer-driven sway/pan. |
| `parallaxLayers` | `number` | `4` | Building depth bands (2–6). |
| `spawnDensity` | `number` | `1` | Building packing. |
| `waterLevel` | `number` | `0.33` | Fraction of the bottom that is water. |
| `shoreHeight` | `number` | `0.025` | Lit shore/embankment band. |
| `moodCycleSeconds` | `number` | `90` | One warm→cool→warm breath. |
| `darkness` | `number` | `0.42` | Overall darkness. |
| `colorTemperature` | `number` | `0.5` | Bias warm (0) ↔ cool (1). |
| `windowLightChance` | `number` | `0.45` | Fraction of lit windows. |
| `windowToggleRate` | `number` | `0.22` | Flicker rate (low stays calm). |
| `moonChance` | `number` | `0.6` | |
| `starDensity` | `number` | `0.6` | |
| `cloudChance` | `number` | `0.4` | |
| `birdChance` | `number` | `0.25` | |
| `flyerChance` | `number` | `0.3` | Planes / satellites / shooting stars. |
| `audioEnabled` | `boolean` | `false` | Muted by default. |
| `audioVolume` | `number` | `0.5` | |
| `showStats` | `boolean` | `false` | FPS / entity / draw-command overlay. |

### Palettes

`PALETTES: Record<string, Palette>`, `PALETTE_NAMES: string[]`, `getPalette(name): Palette`. Each
palette is a warm and a cool end the mood cycles between.

---

## Engine (subpath `…/engine`)

The generic, headless, reusable toolkit underneath the cityscape: seeded `createRng`, value
`createNoise1D`, `Color` math (`mix`/`darken`/`lighten`/…), `clamp`/`lerp`/`smoothstep` easing,
`FixedStepper`, the parallax `Camera` / `Layer` / `World`, the `DrawCommand`/`Renderer` seam, the
`Engine` loop, and `encodeToHash`/`decodeFromHash`. See the inline JSDoc in `src/engine/` for
per-export detail.
