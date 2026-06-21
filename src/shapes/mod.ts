/**
 * `@marianmeres/cityscape/shapes` — the shapes puzzle domain, built on `../engine`.
 *
 * A third sibling of the city and the valley, and the first *interactive* one: a polyomino
 * dissection-and-reassembly puzzle. A figure is cut into pieces, scrambled into a tray, and the
 * player rotates/flips/drags them back into its outline in the fewest moves. Headless and DOM-free
 * — generation, the game-state machine, snapping, scoring and the renderer-agnostic draw all live
 * here; pair it with a renderer (`../render/canvas`, `../render/ascii`, `../render/pixelart`) to see
 * it, and drive it with your own loop or the runtime mount. That it rides the *exact* same engine +
 * renderers as the generative domains — while adding input, a state machine and a non-scrolling
 * board — is the point.
 *
 * @module
 */

export * from "./config.ts";
export * from "./palette.ts";
export * from "./grid.ts";
export * from "./figure.ts";
export * from "./dissection.ts";
export * from "./piece.ts";
export * from "./scramble.ts";
export * from "./difficulty.ts";
export * from "./level.ts";
export * from "./layout.ts";
export * from "./scoring.ts";
export * from "./game.ts";
export * from "./scene.ts";
export { drawGame } from "./draw.ts";
