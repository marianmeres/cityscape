/**
 * `@marianmeres/cityscape/cityscape` — the city domain content, built on `../engine`.
 *
 * Everything here is headless and DOM-free: the config schema, the swappable palettes, the mood
 * engine, the building/sky entities, the zoning generator, and the top-level
 * {@link createCityscape} scene. Pair it with a renderer (`../render/canvas`, `../render/ascii`)
 * to see it; drive it with the engine loop or your own.
 *
 * @module
 */

export * from "./config.ts";
export * from "./palette.ts";
export * from "./mood.ts";
export * from "./events.ts";
export * from "./env.ts";
export * from "./scene.ts";

// entities & generation (exported for advanced/custom assembly)
export * from "./buildings/kinds.ts";
export { Building } from "./buildings/building.ts";
export { WindowGrid } from "./buildings/window-grid.ts";
export * from "./generation/district.ts";
export { LayerSpawner, type SpawnerOptions } from "./generation/spawner.ts";
export { buildSkyline, type Skyline } from "./generation/skyline.ts";
export { SkyBackdrop } from "./sky/backdrop.ts";
export { Starfield } from "./sky/starfield.ts";
export { Moon } from "./sky/moon.ts";
export { CloudField } from "./sky/cloud.ts";
export { BirdDirector } from "./sky/bird.ts";
export { FlyerDirector } from "./sky/flyer.ts";
export { Water } from "./sky/water.ts";
export { Shore } from "./sky/shore.ts";
