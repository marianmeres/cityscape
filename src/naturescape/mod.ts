/**
 * `@marianmeres/cityscape/naturescape` — the nature-valley domain content, built on `../engine`.
 *
 * The same architecture as the cityscape, a different world: a calm, sunlit, day-cycling landscape
 * of rolling hills, forests, lakes, cabins and wildlife, scrolling past on parallax bands. Headless
 * and DOM-free — the config schema, the swappable palettes + seasons, the mood engine (the day
 * clock), the feature/scenery/weather/wildlife entities, the zoning generator, and the top-level
 * {@link createNaturescape} scene. Pair it with a renderer (`../render/canvas`, `../render/ascii`,
 * `../render/pixelart`) to see it; drive it with the engine loop or your own. That it reuses the
 * *exact* engine + renderers the cityscape uses is the point — the seam is real.
 *
 * @module
 */

export * from "./config.ts";
export * from "./palette.ts";
export * from "./season.ts";
export * from "./mood.ts";
export * from "./events.ts";
export * from "./env.ts";
export * from "./scene.ts";

// entities & generation (exported for advanced/custom assembly)
export * from "./features/kinds.ts";
export { Feature } from "./features/feature.ts";
export * from "./generation/zone.ts";
export { BiomeField } from "./generation/biome.ts";
export { LayerSpawner, type SpawnerOptions } from "./generation/spawner.ts";
export { buildLandscape, type Landscape } from "./generation/landscape.ts";
export { SkyBackdrop } from "./scenery/backdrop.ts";
export { Sun, type SunPlacement, sunPlacement } from "./scenery/sun.ts";
export { MountainRange } from "./scenery/mountains.ts";
export { CloudField } from "./scenery/cloud.ts";
export { BirdDirector } from "./scenery/bird.ts";
export { FlyerDirector } from "./scenery/flyer.ts";
export { Lake } from "./scenery/lake.ts";
export { Meadow } from "./scenery/meadow.ts";
export { WildlifeDirector } from "./wildlife.ts";
export { Rain } from "./weather/rain.ts";
export { Snow } from "./weather/snow.ts";
export { SunRays } from "./weather/rays.ts";
export { Rainbow } from "./weather/rainbow.ts";
