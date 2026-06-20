/**
 * Pure pixel-art primitives: ordered dithering and palette quantisation.
 *
 * DOM-free, deterministic, unit-tested building blocks the {@link PixelArtRenderer} composes — kept
 * here in `engine/` (rather than in the renderer) so the hard colour math is testable without a
 * canvas, exactly like the rest of the engine.
 *
 * @module
 */

export * from "./dither.ts";
export * from "./palette.ts";
