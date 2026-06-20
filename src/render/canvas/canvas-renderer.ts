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
