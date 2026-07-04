/**
 * `@marianmeres/cityscape/engine` — the generic, headless animation engine.
 *
 * A small, renderer-agnostic, DOM-free toolkit: seeded math, a fixed-step loop, a parallax
 * scene graph, and the {@link Renderer}/{@link DrawCommand} seam. It knows nothing about cities
 * — the cityscape content (`../cityscape`) is built on top of it, and so could anything else.
 *
 * @module
 */

// math
export * from "./math/rng.ts";
export * from "./math/noise.ts";
export * from "./math/ease.ts";
export * from "./math/color.ts";

// time
export * from "./time/clock.ts";

// scene
export * from "./scene/entity.ts";
export * from "./scene/camera.ts";
export * from "./scene/layer.ts";
export * from "./scene/world.ts";

// render seam
export * from "./render/draw-command.ts";
export * from "./render/renderer.ts";

// pixel-art primitives (pure: ordered dither + palette quantisation)
export * from "./render/pixel/mod.ts";

// loop
export * from "./loop/engine.ts";

// input
export * from "./input/input.ts";
export * from "./input/intent.ts";

// config
export * from "./config/schema.ts";
export * from "./config/serialize.ts";
