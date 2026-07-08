/**
 * The Canvas2D renderer — the production target.
 *
 * It consumes a {@link DisplayList} (the same one the ASCII renderer consumes) and rasterises each
 * {@link DrawCommand} with the Canvas 2D API. The only place in the codebase that knows about a
 * `<canvas>`. Device-pixel-ratio aware, with additive blending for glows so window lights and the
 * moon halo bloom against the dark sky.
 *
 * @module
 */

import type { DisplayList } from "../../engine/render/draw-command.ts";
import type { Renderer } from "../../engine/render/renderer.ts";
import { drawCommand } from "../shared/draw2d.ts";

/** A {@link Renderer} that paints onto a Canvas 2D context. */
export class CanvasRenderer implements Renderer {
	#ctx: CanvasRenderingContext2D;
	#canvas: HTMLCanvasElement;
	#dpr = 1;
	#width = 0;
	#height = 0;
	/** Frame vignette strength (0 = off). Set by the runtime from the `vignette` config knob. */
	#vignette = 0;
	/**
	 * The composited vignette+grain post-pass, baked once at backing-store size. Its output is a
	 * pure function of `(width, height, vignette)`, so it is blitted with a single `drawImage`
	 * each frame and only rebuilt when that signature changes (resize / vignette change).
	 */
	#postCanvas: HTMLCanvasElement | null = null;
	#postSig = "";

	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("CanvasRenderer: 2D context unavailable");
		this.#canvas = canvas;
		this.#ctx = ctx;
	}

	resize(width: number, height: number, dpr = 1): void {
		this.#width = width;
		this.#height = height;
		this.#dpr = dpr;
		this.#canvas.width = Math.max(1, Math.round(width * dpr));
		this.#canvas.height = Math.max(1, Math.round(height * dpr));
		this.#canvas.style.width = `${width}px`;
		this.#canvas.style.height = `${height}px`;
	}

	/**
	 * Renderer-level post-processing (a frame vignette + faint grain). This is a raster concern, so
	 * it lives here rather than in the `DrawCommand` seam — the ASCII renderer correctly has none.
	 * `vignette` 0 disables the whole pass.
	 */
	setPost(opts: { vignette?: number }): void {
		if (opts.vignette !== undefined) this.#vignette = Math.max(0, opts.vignette);
	}

	render(list: DisplayList): void {
		const ctx = this.#ctx;
		// Work in CSS pixels regardless of DPR, with the camera's vertical offset folded in. The
		// backdrop/water over-draw vertically so this translation never reveals a gap.
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, list.offsetY * this.#dpr);
		// The sky backdrop is opaque and full-screen, so no explicit clear is needed; but if the
		// list is empty (or doesn't start with a fill) we still want a clean frame.
		if (list.commands.length === 0 || list.commands[0].kind !== "gradient") {
			ctx.clearRect(0, -list.offsetY, this.#width, this.#height);
		}
		for (const cmd of list.commands) drawCommand(ctx, cmd);
		ctx.globalCompositeOperation = "source-over";
		this.#applyPost(ctx);
	}

	/**
	 * Vignette + faint grain, painted in device pixels over the finished frame. The pass is a pure
	 * function of `(width, height, vignette)`, so it is baked into an offscreen once and blitted with
	 * a single `drawImage` each frame — replacing two full-screen fills + a per-frame gradient alloc.
	 */
	#applyPost(ctx: CanvasRenderingContext2D): void {
		const vig = this.#vignette;
		if (vig <= 0) return;
		const w = this.#canvas.width;
		const h = this.#canvas.height;
		const sig = `${w}x${h}@${vig}`;
		if (sig !== this.#postSig) {
			this.#postCanvas = bakePost(w, h, vig);
			this.#postSig = sig;
		}
		const post = this.#postCanvas;
		if (!post) return;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0); // device pixels; ignore the camera offset
		ctx.drawImage(post, 0, 0); // one blit reproduces the two source-over fills byte-for-byte
		ctx.restore();
	}
}

/**
 * Bake the vignette gradient and grain fill into a transparent offscreen at backing-store size, in
 * the same order/alpha as the live pass. Because source-over is associative, blitting this over the
 * frame is pixel-identical to running the two fills against the frame directly. Returns `null` if a
 * 2D context can't be had (the caller then skips the pass).
 */
function bakePost(w: number, h: number, vig: number): HTMLCanvasElement | null {
	const off = document.createElement("canvas");
	off.width = w;
	off.height = h;
	const octx = off.getContext("2d");
	if (!octx) return null;
	const cx = w / 2;
	const cy = h / 2;
	const g = octx.createRadialGradient(
		cx,
		cy,
		Math.min(w, h) * 0.4,
		cx,
		cy,
		Math.hypot(w, h) * 0.6,
	);
	g.addColorStop(0, "rgba(0,0,0,0)");
	g.addColorStop(1, `rgba(0,0,0,${(vig * 0.9).toFixed(3)})`);
	octx.fillStyle = g;
	octx.fillRect(0, 0, w, h);
	// A barely-there grain breaks up the smooth sky/water gradients (scales with the knob).
	const grain = buildGrain(octx);
	if (grain) {
		octx.globalAlpha = vig * 0.06;
		octx.fillStyle = grain;
		octx.fillRect(0, 0, w, h);
		octx.globalAlpha = 1;
	}
	return off;
}

/** A small tiling noise pattern for film grain. Renderer-local, so `Math.random` is fine here. */
function buildGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
	const size = 64;
	const tile = document.createElement("canvas");
	tile.width = size;
	tile.height = size;
	const tctx = tile.getContext("2d");
	if (!tctx) return null;
	const img = tctx.createImageData(size, size);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) {
		const v = (Math.random() * 255) | 0;
		d[i] = d[i + 1] = d[i + 2] = v;
		d[i + 3] = 255;
	}
	tctx.putImageData(img, 0, 0);
	return ctx.createPattern(tile, "repeat");
}
