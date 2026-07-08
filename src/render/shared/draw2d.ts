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

import { type Color, toCss } from "../../engine/math/color.ts";
import type { DrawCommand } from "../../engine/render/draw-command.ts";

/** Rasterise a single {@link DrawCommand} into `ctx` (screen-space coords; caller sets transform). */
export function drawCommand(ctx: CanvasRenderingContext2D, cmd: DrawCommand): void {
	switch (cmd.kind) {
		case "rect": {
			ctx.fillStyle = toCss(cmd.color);
			const r = cmd.radius;
			const radii = typeof r === "number"
				? (r > 0 ? [r, r, r, r] as const : null)
				: (r && (r[0] > 0 || r[1] > 0 || r[2] > 0 || r[3] > 0))
				? r
				: null;
			if (radii && cmd.w > 0 && cmd.h > 0) {
				roundRectPath(ctx, cmd.x, cmd.y, cmd.w, cmd.h, radii);
				ctx.fill();
			} else {
				ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
			}
			return;
		}
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
			// A radial gradient's stops depend only on (r, colour, intensity), not on centre —
			// so build it once at the origin (cached per-context) and translate it into place.
			// Radius is quantised to 0.5px so continuously-drifting glows reuse a bounded set.
			const r = Math.max(0.5, Math.round(cmd.r * 2) / 2);
			const g = glowGradient(ctx, r, cmd.color, cmd.intensity);
			ctx.globalCompositeOperation = "lighter";
			ctx.save();
			ctx.translate(cmd.x, cmd.y);
			ctx.fillStyle = g;
			ctx.fillRect(-r, -r, r * 2, r * 2);
			ctx.restore();
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

/**
 * Per-context cache of origin-centred radial glow gradients.
 *
 * A `CanvasGradient` is bound to the context that created it, and this rasteriser runs against
 * **two** contexts (the full-res {@link CanvasRenderer} and the low-res {@link PixelArtRenderer}
 * buffer) — so the cache is keyed by context via a `WeakMap` (never reuse a gradient cross-context;
 * entries are freed when a context is GC'd). The inner map is bounded so a consumer animating
 * radius/colour continuously can't grow it without limit — oldest insertions are evicted first.
 */
const glowCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
const GLOW_CACHE_MAX = 64;

/** A glow gradient centred at (0,0) with radius `r`; cached per-context keyed by `(r, rgba)`. */
function glowGradient(
	ctx: CanvasRenderingContext2D,
	r: number,
	c: Color,
	intensity: number,
): CanvasGradient {
	let byCtx = glowCache.get(ctx);
	if (!byCtx) glowCache.set(ctx, byCtx = new Map());
	const a = c.a * intensity;
	const key = `${r}:${c.r},${c.g},${c.b},${a.toFixed(3)}`;
	const hit = byCtx.get(key);
	if (hit) return hit;
	const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
	g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${a})`);
	g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
	if (byCtx.size >= GLOW_CACHE_MAX) {
		const oldest = byCtx.keys().next().value;
		if (oldest !== undefined) byCtx.delete(oldest);
	}
	byCtx.set(key, g);
	return g;
}

/**
 * Trace a rounded-rectangle path with independent `[tl, tr, br, bl]` corner radii (each clamped to
 * half the shorter side; 0 = a square corner). Written by hand rather than relying on the still-
 * unevenly-supported `ctx.roundRect`, so the pixel-art buffer and the full-res canvas round corners
 * identically everywhere. Per-corner control lets callers round only a shape's exterior silhouette.
 */
function roundRectPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	radii: readonly [number, number, number, number],
): void {
	const max = Math.min(w, h) / 2;
	const clamp = (v: number): number => Math.min(Math.max(0, v), max);
	const tl = clamp(radii[0]);
	const tr = clamp(radii[1]);
	const br = clamp(radii[2]);
	const bl = clamp(radii[3]);
	// arcTo rounds the corner at its first control point; a radius of 0 degenerates to a sharp turn.
	ctx.beginPath();
	ctx.moveTo(x + tl, y);
	ctx.arcTo(x + w, y, x + w, y + h, tr);
	ctx.arcTo(x + w, y + h, x, y + h, br);
	ctx.arcTo(x, y + h, x, y, bl);
	ctx.arcTo(x, y, x + w, y, tl);
	ctx.closePath();
}
