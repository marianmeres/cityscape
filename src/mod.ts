/**
 * `@marianmeres/cityscape` — an infinite, procedurally-generated, parallax night-city-skyline
 * animation with a swappable renderer and a schema-driven control panel.
 *
 * This is the convenience barrel: the high-level browser API plus the most-used building blocks.
 * For the full, granular surface use the subpath exports:
 *
 *  - `@marianmeres/cityscape/engine`        — the generic, headless animation engine
 *  - `@marianmeres/cityscape/cityscape`     — the city domain (config, palettes, mood, entities)
 *  - `@marianmeres/cityscape/naturescape`   — a second domain on the same engine (a nature valley)
 *  - `@marianmeres/cityscape/render/canvas`   — the Canvas2D renderer
 *  - `@marianmeres/cityscape/render/ascii`    — the ASCII renderer (proof of the seam)
 *  - `@marianmeres/cityscape/render/pixelart` — the pixel-art renderer (dithered, palette-quantised)
 *  - `@marianmeres/cityscape/ui`              — the floating control panel
 *
 * @example One-liner full-page background
 * ```ts
 * import { mountCityscape } from "@marianmeres/cityscape";
 * mountCityscape();
 * ```
 *
 * @module
 */

// High-level runtime
export {
	type CityscapeHandle,
	mountCityscape,
	type MountOptions,
} from "./runtime/mount.ts";

// Headless scene + config
export { type CityscapeScene, createCityscape } from "./cityscape/scene.ts";
export {
	type CityscapeConfig,
	CONFIG_SCHEMA,
	type ConfigField,
	DEFAULT_CONFIG,
	GROUP_ORDER,
	normalizeConfig,
} from "./cityscape/config.ts";
export {
	getPalette,
	type Palette,
	PALETTE_NAMES,
	PALETTES,
} from "./cityscape/palette.ts";

// Renderers + the seam types
export { CanvasRenderer } from "./render/canvas/canvas-renderer.ts";
export { type AsciiOptions, AsciiRenderer } from "./render/ascii/ascii-renderer.ts";
export {
	type PixelArtOptions,
	PixelArtRenderer,
} from "./render/pixelart/pixelart-renderer.ts";
export type { Renderer } from "./engine/render/renderer.ts";
export type { DisplayList, DrawCommand } from "./engine/render/draw-command.ts";

// UI + audio
export {
	type ControlPanel,
	type ControlPanelOptions,
	createControlPanel,
} from "./ui/panel.ts";
export { AmbientAudio } from "./audio/ambient-audio.ts";

// Naturescape — a second domain on the same engine + renderers (high-level entry points only; the
// full surface, which shares many names with the city, is under `@marianmeres/cityscape/naturescape`).
export {
	mountNaturescape,
	type NatureHandle,
	type NatureMountOptions,
} from "./runtime/mount-nature.ts";
export {
	createNaturescape,
	type NatureConfig,
	type NatureScene,
} from "./naturescape/mod.ts";
export { NatureAudio } from "./audio/nature-audio.ts";

// Shapes — a third, interactive domain on the same engine + renderers: a polyomino reassembly
// puzzle (the full headless surface is under `@marianmeres/cityscape/shapes`).
export {
	mountShapes,
	type ShapesHandle,
	type ShapesMountOptions,
} from "./runtime/mount-shapes.ts";
export { createShapes, type ShapesConfig, type ShapesScene } from "./shapes/mod.ts";
