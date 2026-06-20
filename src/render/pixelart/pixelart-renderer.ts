/**
 * The pixel-art Canvas2D renderer — a third consumer of the renderer seam.
 *
 * It eats the very same {@link DisplayList} as the production {@link CanvasRenderer}, but realises
 * it as deliberate low-resolution pixel art in three steps each frame:
 *
 *  1. **Rasterise small.** Draw every {@link DrawCommand} into an offscreen buffer sized so that one
 *     art-pixel covers `pixelScale` CSS px (the shared {@link drawCommand} — identical primitives,
 *     just fewer pixels).
 *  2. **Quantise + dither.** Reduce the buffer to a palette extracted from the scene *as rendered*
 *     (so the live mood drives the colours), with ordered (Bayer) dithering so gradients and glows
 *     cross-hatch instead of banding. The palette refreshes every few frames (not every frame), so
 *     it follows the slow mood drift without per-frame shimmer; because each refresh is an
 *     independent median-cut, a *fast* colour change can step the palette rather than glide.
 *  3. **Upscale crisp.** Blit the buffer to the visible canvas with nearest-neighbour scaling — the
 *     chunky pixels that read, unmistakably, as pixel art.
 *
 * The hard parts (palette extraction, the quantise LUT, the dither) are pure, DOM-free and
 * unit-tested in `engine/render/pixel`; this module only owns the canvases and the per-frame glue.
 * `pixelScale` is a *renderer* option (like `AsciiRenderer`'s cell size), not a simulation config
 * knob — it has no meaning for the other renderers and never enters a permalink.
 *
 * @module
 */

import type { Color } from "../../engine/math/color.ts";
import type { DisplayList } from "../../engine/render/draw-command.ts";
import type { Renderer } from "../../engine/render/renderer.ts";
import {
	type BayerMatrix,
	buildPaletteLut,
	ditherQuantize,
	extractPalette,
	makeBayer,
	type PaletteLut,
} from "../../engine/render/pixel/mod.ts";
import { drawCommand } from "../shared/draw2d.ts";

/** Options for {@link PixelArtRenderer}. */
export interface PixelArtOptions {
	/**
	 * CSS px per art-pixel (≥1). Higher = chunkier. Default `4`. Per-frame cost scales with the
	 * buffer area (≈ viewport ÷ `pixelScale`²) — the default is cheap, but very low values (1–2) on
	 * a large viewport read back a big buffer every frame.
	 */
	pixelScale?: number;
	/** Target palette size. Generous keeps colour rich; small reads more retro. Default `48`. */
	paletteSize?: number;
	/** Ordered-dither strength `0..1` (0 = flat bands, 1 = full cross-hatch). Default `1`. */
	dither?: number;
	/** Frames between palette refreshes — higher is steadier but lags the mood. Default `18`. */
	paletteRefreshFrames?: number;
	/** Bits per channel for the quantisation LUT (`4..6` sensible). Default `5`. */
	lutBits?: number;
}

/** A {@link Renderer} that paints a {@link DisplayList} as low-resolution, dithered pixel art. */
export class PixelArtRenderer implements Renderer {
	#canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#buf: HTMLCanvasElement;
	#bctx: CanvasRenderingContext2D;

	#dpr = 1;
	#width = 0;
	#height = 0;
	#vw = 1; // art-pixel buffer width
	#vh = 1; // art-pixel buffer height

	#pixelScale: number;
	#paletteSize: number;
	#dither: number;
	#refresh: number;
	#lutBits: number;

	#bayer: BayerMatrix;
	#palette: Color[] = [];
	#lut: PaletteLut | null = null;
	#frame = 0;
	#lastPaletteFrame = -1;

	constructor(canvas: HTMLCanvasElement, opts: PixelArtOptions = {}) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("PixelArtRenderer: 2D context unavailable");
		this.#canvas = canvas;
		this.#ctx = ctx;

		// The offscreen low-res buffer everything is drawn into before upscaling. We read it back
		// with getImageData every frame, so hint the browser to keep it CPU-resident.
		const buf = document.createElement("canvas");
		const bctx = buf.getContext("2d", { willReadFrequently: true });
		if (!bctx) throw new Error("PixelArtRenderer: offscreen 2D context unavailable");
		this.#buf = buf;
		this.#bctx = bctx;

		this.#pixelScale = Math.max(1, opts.pixelScale ?? 4);
		this.#paletteSize = Math.max(2, opts.paletteSize ?? 48);
		this.#dither = clamp01(opts.dither ?? 1);
		this.#refresh = Math.max(1, opts.paletteRefreshFrames ?? 18);
		this.#lutBits = Math.max(4, Math.min(6, opts.lutBits ?? 5));
		this.#bayer = makeBayer(3); // 8×8 — a fine, classic dither grid
	}

	/** The current art-pixel buffer size (mainly for tests / stats). */
	get bufferSize(): { width: number; height: number } {
		return { width: this.#vw, height: this.#vh };
	}

	/**
	 * Update live options (e.g. the example's pixel-size keys). Re-sizes the buffer and forces a
	 * palette rebuild as needed; takes effect on the next {@link render}.
	 */
	setOptions(opts: PixelArtOptions): void {
		let geometryChanged = false;
		if (opts.pixelScale !== undefined) {
			const next = Math.max(1, opts.pixelScale);
			geometryChanged = next !== this.#pixelScale;
			this.#pixelScale = next;
		}
		if (opts.paletteSize !== undefined) {
			this.#paletteSize = Math.max(2, opts.paletteSize);
			this.#lastPaletteFrame = -1;
		}
		if (opts.dither !== undefined) this.#dither = clamp01(opts.dither);
		if (opts.paletteRefreshFrames !== undefined) {
			this.#refresh = Math.max(1, opts.paletteRefreshFrames);
		}
		if (opts.lutBits !== undefined) {
			this.#lutBits = Math.max(4, Math.min(6, opts.lutBits));
			this.#lastPaletteFrame = -1;
		}
		// Only `pixelScale` changes the buffer geometry. The rest take effect live: `dither` and
		// `paletteRefreshFrames` are read each frame; `paletteSize`/`lutBits` force a rebuild above.
		// (Reassigning a canvas's width/height reallocates and clears it, so don't do it needlessly.)
		if (geometryChanged && this.#width > 0) {
			this.resize(this.#width, this.#height, this.#dpr);
		}
	}

	resize(width: number, height: number, dpr = 1): void {
		this.#width = width;
		this.#height = height;
		this.#dpr = dpr;
		// Visible canvas backs the store at device resolution (matches CanvasRenderer).
		this.#canvas.width = Math.max(1, Math.round(width * dpr));
		this.#canvas.height = Math.max(1, Math.round(height * dpr));
		this.#canvas.style.width = `${width}px`;
		this.#canvas.style.height = `${height}px`;
		// Art-pixel buffer is sized in CSS px ÷ scale, so an art-pixel is `pixelScale` CSS px on any
		// display (DPR-independent look).
		this.#vw = Math.max(1, Math.round(width / this.#pixelScale));
		this.#vh = Math.max(1, Math.round(height / this.#pixelScale));
		this.#buf.width = this.#vw;
		this.#buf.height = this.#vh;
		this.#lastPaletteFrame = -1; // buffer geometry changed → rebuild the palette
	}

	render(list: DisplayList): void {
		const b = this.#bctx;
		const vw = this.#vw;
		const vh = this.#vh;
		const sx = vw / Math.max(1, this.#width);
		const sy = vh / Math.max(1, this.#height);

		// ── 1. Rasterise the display list into the low-res buffer (camera offset folded in) ──
		b.setTransform(1, 0, 0, 1, 0, 0);
		b.clearRect(0, 0, vw, vh);
		b.setTransform(sx, 0, 0, sy, 0, list.offsetY * sy);
		for (const cmd of list.commands) drawCommand(b, cmd);
		b.setTransform(1, 0, 0, 1, 0, 0);

		// ── 2. Quantise + dither the buffer to a scene-derived palette ──
		const img = b.getImageData(0, 0, vw, vh);
		if (this.#lut === null || this.#frame - this.#lastPaletteFrame >= this.#refresh) {
			this.#palette = extractPalette(img.data, {
				size: this.#paletteSize,
				sampleStride: paletteStride(vw, vh),
			});
			this.#lut = buildPaletteLut(this.#palette, this.#lutBits);
			this.#lastPaletteFrame = this.#frame;
		}
		ditherQuantize(img.data, vw, vh, this.#lut, this.#bayer, this.#dither);
		b.putImageData(img, 0, 0);

		// ── 3. Upscale to the visible canvas, nearest-neighbour (the chunky pixels) ──
		const c = this.#ctx;
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.imageSmoothingEnabled = false;
		c.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
		c.drawImage(
			this.#buf,
			0,
			0,
			vw,
			vh,
			0,
			0,
			this.#canvas.width,
			this.#canvas.height,
		);
		// Leave the (possibly shared) context in its default state — a host may swap this canvas to
		// another renderer that assumes smoothing is on.
		c.imageSmoothingEnabled = true;

		this.#frame++;
	}

	dispose(): void {
		// Release the offscreen backing store.
		this.#buf.width = 0;
		this.#buf.height = 0;
		this.#lut = null;
		this.#palette = [];
	}
}

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Sample stride that keeps palette extraction at ~few-thousand samples regardless of resolution. */
function paletteStride(vw: number, vh: number): number {
	return Math.max(1, Math.floor((vw * vh) / 3000));
}
