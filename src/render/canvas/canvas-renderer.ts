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

import { toCss } from "../../engine/math/color.ts";
import type { DisplayList, DrawCommand } from "../../engine/render/draw-command.ts";
import type { Renderer } from "../../engine/render/renderer.ts";

/** A {@link Renderer} that paints onto a Canvas 2D context. */
export class CanvasRenderer implements Renderer {
	#ctx: CanvasRenderingContext2D;
	#canvas: HTMLCanvasElement;
	#dpr = 1;
	#width = 0;
	#height = 0;
	/** Frame vignette strength (0 = off). Set by the runtime from the `vignette` config knob. */
	#vignette = 0;
	#grainPattern: CanvasPattern | null = null;

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
		for (const cmd of list.commands) this.#draw(ctx, cmd);
		ctx.globalCompositeOperation = "source-over";
		this.#applyPost(ctx);
	}

	/** Vignette + faint grain, painted in device pixels over the finished frame. */
	#applyPost(ctx: CanvasRenderingContext2D): void {
		const vig = this.#vignette;
		if (vig <= 0) return;
		const w = this.#canvas.width;
		const h = this.#canvas.height;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0); // device pixels; ignore the camera offset
		const cx = w / 2;
		const cy = h / 2;
		const g = ctx.createRadialGradient(
			cx,
			cy,
			Math.min(w, h) * 0.4,
			cx,
			cy,
			Math.hypot(w, h) * 0.6,
		);
		g.addColorStop(0, "rgba(0,0,0,0)");
		g.addColorStop(1, `rgba(0,0,0,${(vig * 0.9).toFixed(3)})`);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		// A barely-there grain breaks up the smooth sky/water gradients (scales with the knob).
		const grain = this.#grainPattern ?? (this.#grainPattern = buildGrain(ctx));
		if (grain) {
			ctx.globalAlpha = vig * 0.06;
			ctx.fillStyle = grain;
			ctx.fillRect(0, 0, w, h);
			ctx.globalAlpha = 1;
		}
		ctx.restore();
	}

	#draw(ctx: CanvasRenderingContext2D, cmd: DrawCommand): void {
		switch (cmd.kind) {
			case "rect":
				ctx.fillStyle = toCss(cmd.color);
				ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
				return;
			case "polygon": {
				const p = cmd.points;
				if (p.length < 6) return;
				ctx.fillStyle = toCss(cmd.color);
				ctx.beginPath();
				ctx.moveTo(p[0], p[1]);
				for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
				ctx.closePath();
				ctx.fill();
				return;
			}
			case "circle":
				ctx.fillStyle = toCss(cmd.color);
				ctx.beginPath();
				ctx.arc(cmd.x, cmd.y, Math.max(0, cmd.r), 0, Math.PI * 2);
				ctx.fill();
				return;
			case "gradient": {
				const g = cmd.vertical
					? ctx.createLinearGradient(cmd.x, cmd.y, cmd.x, cmd.y + cmd.h)
					: ctx.createLinearGradient(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y);
				for (const s of cmd.stops) g.addColorStop(clamp01(s.at), toCss(s.color));
				ctx.fillStyle = g;
				ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
				return;
			}
			case "line":
				ctx.strokeStyle = toCss(cmd.color);
				ctx.lineWidth = cmd.width;
				ctx.lineCap = "round";
				ctx.beginPath();
				ctx.moveTo(cmd.x1, cmd.y1);
				ctx.lineTo(cmd.x2, cmd.y2);
				ctx.stroke();
				return;
			case "glow": {
				const r = Math.max(0.5, cmd.r);
				const g = ctx.createRadialGradient(cmd.x, cmd.y, 0, cmd.x, cmd.y, r);
				const c = cmd.color;
				g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${c.a * cmd.intensity})`);
				g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
				ctx.globalCompositeOperation = "lighter";
				ctx.fillStyle = g;
				ctx.fillRect(cmd.x - r, cmd.y - r, r * 2, r * 2);
				ctx.globalCompositeOperation = "source-over";
				return;
			}
			case "text":
				ctx.fillStyle = toCss(cmd.color);
				ctx.font = `${cmd.size}px ui-monospace, monospace`;
				ctx.textBaseline = "top";
				ctx.fillText(cmd.text, cmd.x, cmd.y);
				return;
		}
	}
}

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
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
