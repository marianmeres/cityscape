/**
 * Shared Canvas2D rasterisation of the {@link DrawCommand} vocabulary.
 *
 * Both raster targets — the full-resolution {@link CanvasRenderer} and the low-resolution buffer
 * inside the {@link PixelArtRenderer} — draw each primitive identically; only the buffer resolution
 * and the pixel-art post pass differ. Extracting the per-command switch keeps the two pixel-perfect
 * at the primitive level and the drawing logic in one place. Caller owns the transform, clearing,
 * and any post-processing; this just paints one command into the given context.
 *
 * @module
 */

import { toCss } from "../../engine/math/color.ts";
import type { DrawCommand } from "../../engine/render/draw-command.ts";

/** Rasterise a single {@link DrawCommand} into `ctx` (screen-space coords; caller sets transform). */
export function drawCommand(ctx: CanvasRenderingContext2D, cmd: DrawCommand): void {
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

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}
