/**
 * The {@link Building} entity — a procedurally-shaped silhouette with lit windows, a crown, and
 * (for factories) drifting smoke.
 *
 * It is poolable: `reset()` reconfigures an existing instance for a new spec so the infinite
 * scroll recycles a bounded set of objects rather than churning the GC. `update()` resolves its
 * colour from the {@link Mood} and ticks its windows; `draw()` is pure geometry against the
 * camera. Time-based flourishes (a blinking antenna light, rising smoke) are *stateless*
 * functions of the simulated clock, so they cost no per-particle bookkeeping.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, darken, lighten, rgb, withAlpha } from "../../engine/math/color.ts";
import { clamp } from "../../engine/math/ease.ts";
import type { DisplayListBuilder } from "../../engine/render/draw-command.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import { silhouetteColor } from "../mood.ts";
import type { CityEnv } from "../env.ts";
import type { BuildingSpec, RoofKind } from "./kinds.ts";
import { WindowGrid } from "./window-grid.ts";

const ANTENNA_LIGHT = rgb(255, 70, 64);

/** One building in a parallax layer. Implements the engine's {@link Entity} over {@link CityEnv}. */
export class Building implements Entity<CityEnv> {
	depth: number;
	readonly bounds = { x: 0, width: 0 };
	alive = true;

	#spec!: BuildingSpec;
	#localX = 0;
	#baseline = 0.95;
	/** How far (viewport fraction) this layer's feet sit above the waterline — distant-shore stagger. */
	#shoreOffset = 0;
	#width = 0;
	#heightFrac = 0;
	#rng: Rng;
	#grid = new WindowGrid(0, 0);
	#color: Color = rgb(0, 0, 0);
	#window: Color = rgb(255, 255, 255);
	#time = 0;
	#phase = 0;
	/** Cached facade top-light strength (0 = flat); resolved from config, gated to near layers. */
	#shade = 0;

	constructor(depth: number, rng: Rng) {
		this.depth = depth;
		this.#rng = rng;
	}

	/** This building's archetype (after any per-layer substitution). */
	get kind(): BuildingSpec["kind"] {
		return this.#spec.kind;
	}

	/** (Re)configure this instance for a spec at a local-x — the pooling entry point. */
	reset(
		spec: BuildingSpec,
		localX: number,
		shoreOffset: number,
		scale: number,
		litChance: number,
	): void {
		this.#spec = spec;
		this.#localX = localX;
		this.#shoreOffset = shoreOffset;
		this.#width = spec.width * scale;
		this.#heightFrac = clamp(spec.height * scale, 0.02, 0.96);
		this.bounds.x = localX;
		this.bounds.width = this.#width;
		this.alive = true;
		this.#phase = this.#rng.next();
		this.#grid = new WindowGrid(spec.cols, spec.rows);
		this.#grid.seed(this.#rng, litChance);
	}

	/** Light interaction: pop most of this building's windows on (used by `scene.poke`). */
	flash(): void {
		this.#grid.seed(this.#rng, 0.85);
	}

	update(ctx: UpdateContext<CityEnv>): void {
		this.#time = ctx.time;
		// Feet sit on top of the shore band (above the waterline); far layers a touch higher.
		const cfg = ctx.env.config;
		this.#baseline = clamp(
			(1 - cfg.waterLevel - cfg.shoreHeight) - this.#shoreOffset,
			0.1,
			1,
		);
		const mood = ctx.env.mood;
		this.#color = silhouetteColor(mood, this.depth);
		this.#window = mood.window;
		// Facade light only earns its draw cost on the near bands; far/hazy ones stay flat.
		this.#shade = this.depth > 0.78 ? cfg.buildingShading : 0;
		this.#grid.update(ctx.dt, this.#rng, ctx.env.config);
	}

	draw(ctx: DrawContext): void {
		const sx = ctx.camera.project(this.#localX, this.depth);
		const sw = this.#width * ctx.camera.unit; // world-unit width → pixels
		if (sx + sw < -4 || sx > ctx.width + 4) return; // offscreen this frame

		const groundY = ctx.height * this.#baseline;
		const bh = this.#heightFrac * ctx.camera.unit; // height shares the world scale (zoom + aspect)
		const topY = groundY - bh;
		const out = ctx.out;
		const spec = this.#spec;

		// Body (stepped for setbacks). Returns the rect to lay windows over. The facade light is
		// drawn under the windows so lit cells stay crisp on top of it.
		const win = drawBody(
			out,
			sx,
			topY,
			sw,
			bh,
			this.#color,
			spec.setbacks,
			this.#shade,
		);

		// Windows.
		this.#grid.draw(out, win.x, win.y, win.w, win.h, this.#window, this.depth);

		// Crown / roof feature. `beaconRef` is the layer's parallax pixel-scale (= scale × unit,
		// the same for every building in this band) so the antenna light is sized by depth/zoom,
		// not by this building's width — otherwise squat-wide silhouettes get a giant red blob.
		const beaconRef = sw / spec.width;
		drawRoof(
			out,
			spec.roof,
			sx,
			topY,
			sw,
			spec.roofScale,
			this.#color,
			this.#time,
			this.#phase,
			this.depth,
			beaconRef,
		);
	}
}

/** Draw the silhouette body; returns the rect windows should fill. */
function drawBody(
	out: DisplayListBuilder,
	x: number,
	y: number,
	w: number,
	h: number,
	color: Color,
	setbacks: number,
	shade: number,
): { x: number; y: number; w: number; h: number } {
	if (setbacks <= 0) {
		out.rect(x, y, w, h, color);
		shadeSegment(out, x, y, w, h, color, shade);
		return { x, y, w, h };
	}
	const segs = setbacks + 1;
	const segH = h / segs;
	let curX = x;
	let curW = w;
	let yBottom = y + h;
	for (let i = 0; i < segs; i++) {
		const yTop = yBottom - segH;
		const sh = segH + 0.5;
		out.rect(curX, yTop, curW, sh, color);
		// Per-segment so the wash tracks the narrowing crown instead of bleeding past it.
		shadeSegment(out, curX, yTop, curW, sh, color, shade);
		curX += curW * 0.16;
		curW *= 0.68;
		yBottom = yTop;
	}
	// Windows fill the full-width bottom segment only (keeps them off the narrowed crown).
	return { x, y: y + h - segH, w, h: segH };
}

/**
 * A faint top-down rim of light washing the upper part of a body segment and fading to nothing —
 * just enough to give the flat silhouette a sense of volume without a real lighting model. Same
 * light hue at both stops (only the alpha falls) so the fade never drifts in colour.
 */
function shadeSegment(
	out: DisplayListBuilder,
	x: number,
	y: number,
	w: number,
	h: number,
	color: Color,
	shade: number,
): void {
	if (shade <= 0) return;
	const lit = lighten(color, 0.5);
	out.gradient(x, y, w, h, [
		{ at: 0, color: withAlpha(lit, shade * 0.4) },
		{ at: 0.55, color: withAlpha(lit, 0) },
	], true);
}

function drawRoof(
	out: DisplayListBuilder,
	roof: RoofKind,
	x: number,
	topY: number,
	w: number,
	scale: number,
	color: Color,
	time: number,
	phase: number,
	depth: number,
	beaconRef: number,
): void {
	const cx = x + w / 2;
	switch (roof) {
		case "flat":
			return;
		case "antenna": {
			const len = w * (0.5 + scale * 0.9);
			out.line(cx, topY, cx, topY - len, Math.max(1, w * 0.04), color);
			// A calm blinking aviation light on nearer layers. Sized from the layer's parallax
			// scale (not the building's width) so every beacon in the band is the same small
			// point — wide silhouettes no longer get an oversized red light.
			if (depth > 0.4) {
				const on = (time + phase * 1700) % 1700 < 240;
				const lightR = Math.max(0.8, beaconRef * 0.007);
				if (on) out.glow(cx, topY - len, lightR * 4, ANTENNA_LIGHT, 1);
				out.circle(
					cx,
					topY - len,
					lightR,
					on ? ANTENNA_LIGHT : darken(ANTENNA_LIGHT, 0.6),
				);
			}
			return;
		}
		case "tank": {
			const tw = w * 0.34 * scale + w * 0.18;
			const th = w * 0.22 * scale + 3;
			out.rect(cx - tw / 2, topY - th, tw, th, color);
			out.line(
				cx + tw * 0.1,
				topY - th,
				cx + tw * 0.1,
				topY - th - th * 0.7,
				Math.max(1, w * 0.03),
				color,
			);
			return;
		}
		case "spire": {
			const sh = w * (0.6 + scale * 1.1);
			const sw = Math.max(2, w * 0.16);
			out.polygon([cx - sw / 2, topY, cx + sw / 2, topY, cx, topY - sh], color);
			return;
		}
		case "dome": {
			const r = w * 0.32;
			out.circle(cx, topY, r, color);
			out.rect(x + w * 0.18, topY, w * 0.64, r, color); // hide the lower half
			return;
		}
		case "pitched": {
			const ph = w * 0.28 * (0.6 + scale);
			out.polygon([x, topY, x + w, topY, cx, topY - ph], color);
			return;
		}
		case "chimneys": {
			const count = 2;
			for (let i = 0; i < count; i++) {
				const ratio = 0.62 + i * 0.2;
				const chx = x + w * ratio;
				const chW = Math.max(2, w * 0.06);
				const chH = w * (0.3 + scale * 0.35);
				out.rect(chx, topY - chH, chW, chH, color);
				drawSmoke(out, chx + chW / 2, topY - chH, w, time, phase + i * 0.41);
			}
			return;
		}
		case "sawtooth": {
			const teeth = Math.max(3, Math.round(w / 26));
			const tw = w / teeth;
			const th = w * 0.08 * (0.6 + scale);
			for (let i = 0; i < teeth; i++) {
				const tx = x + i * tw;
				out.polygon([tx, topY, tx + tw, topY, tx + tw, topY - th], color);
			}
			return;
		}
		case "barrel": {
			// A low, wide rounded cap: a large disc pushed down so only a shallow arc shows above
			// the roofline (it never bulges past the walls — its widest point sits at the edge).
			const r = w * 0.48;
			const cap = Math.min(r, w * 0.18 * (0.5 + scale));
			out.circle(cx, topY + r - cap, r, color);
			return;
		}
		case "deco": {
			// A stepped art-deco crown: stacked, narrowing tiers topped by a finial.
			const steps = 3;
			const stepH = w * 0.14 * (0.6 + scale);
			let stepW = w * 0.62;
			let yb = topY;
			for (let i = 0; i < steps; i++) {
				out.rect(cx - stepW / 2, yb - stepH, stepW, stepH + 0.5, color);
				yb -= stepH;
				stepW *= 0.62;
			}
			out.line(cx, yb, cx, yb - stepH * 0.9, Math.max(1, w * 0.04), color);
			return;
		}
		case "watertower": {
			// The classic rooftop tank on splayed legs, with a rounded cap.
			const tw = Math.max(4, w * 0.26 * (0.7 + scale));
			const legH = w * 0.1 * (0.6 + scale);
			const tankH = tw * 0.8;
			const lw = Math.max(1, w * 0.03);
			const baseY = topY - legH; // top of the legs / bottom of the tank
			out.line(cx - tw * 0.3, topY, cx - tw * 0.3, baseY, lw, color);
			out.line(cx + tw * 0.3, topY, cx + tw * 0.3, baseY, lw, color);
			out.rect(cx - tw / 2, baseY - tankH, tw, tankH, color);
			out.circle(cx, baseY - tankH, tw / 2, color);
			return;
		}
	}
}

/** Stateless drifting smoke: three puffs rising on a slow loop derived from the clock. */
function drawSmoke(
	out: DisplayListBuilder,
	x: number,
	y: number,
	w: number,
	time: number,
	phase: number,
): void {
	const puff = rgb(46, 52, 68); // muted dark grey so it stays calm against the night
	for (let k = 0; k < 3; k++) {
		const t = ((time * 0.00006 + phase + k * 0.34) % 1 + 1) % 1;
		const py = y - t * w * 0.9;
		const px = x + Math.sin((t + phase) * 6.283) * w * 0.12;
		const r = w * (0.08 + t * 0.16);
		const a = (1 - t) * 0.2;
		out.circle(px, py, r, withAlpha(puff, a));
	}
}
