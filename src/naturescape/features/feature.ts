/**
 * The {@link Feature} entity — one procedurally-shaped land feature (a tree, cabin, rock, hill…).
 *
 * It is poolable: `reset()` reconfigures an existing instance for a new spec so the infinite scroll
 * recycles a bounded set of objects rather than churning the GC (exactly like the cityscape's
 * `Building`). `update()` resolves its colours from the {@link Mood} (foliage, trunk, snow caps);
 * `draw()` is pure geometry against the camera. Time-based flourishes — wind sway, drifting chimney
 * smoke — are *stateless* functions of the simulated clock, so they cost no per-particle bookkeeping.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, lighten, mix, rgb, withAlpha } from "../../engine/math/color.ts";
import { clamp } from "../../engine/math/ease.ts";
import type { DisplayListBuilder } from "../../engine/render/draw-command.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import { foliageColor, landColor } from "../mood.ts";
import type { NatureEnv } from "../env.ts";
import type { FeatureKind, FeatureSpec } from "./kinds.ts";

/** Warm cosy cabin-window glow. */
const WINDOW = rgb(255, 198, 120);
/** Drifting wood-smoke (kept soft and pale so it stays calm). */
const SMOKE = rgb(214, 218, 224);

/** The per-feature resolved colour set, cached each tick by `update()`. */
interface FeatureColors {
	foliage: Color;
	foliageDeep: Color;
	trunk: Color;
	land: Color;
	rock: Color;
	cabinWall: Color;
	cabinRoof: Color;
	bloom: Color;
	snow: number; // 0..1 amount
	snowColor: Color;
	windowAlpha: number;
}

/** One land feature in a parallax band. Implements the engine's {@link Entity} over {@link NatureEnv}. */
export class Feature implements Entity<NatureEnv> {
	depth: number;
	readonly bounds = { x: 0, width: 0 };
	alive = true;

	#spec!: FeatureSpec;
	#localX = 0;
	#baseline = 0.8;
	/** Viewport fraction this band's feet sit above the waterline (distant-shore stagger). */
	#shoreOffset = 0;
	#width = 0;
	#heightFrac = 0;
	#rng: Rng;
	#time = 0;
	#phase = 0;
	#wind = 0;
	#c: FeatureColors = {
		foliage: rgb(0, 0, 0),
		foliageDeep: rgb(0, 0, 0),
		trunk: rgb(0, 0, 0),
		land: rgb(0, 0, 0),
		rock: rgb(0, 0, 0),
		cabinWall: rgb(0, 0, 0),
		cabinRoof: rgb(0, 0, 0),
		bloom: rgb(0, 0, 0),
		snow: 0,
		snowColor: rgb(255, 255, 255),
		windowAlpha: 0,
	};

	constructor(depth: number, rng: Rng) {
		this.depth = depth;
		this.#rng = rng;
	}

	/** This feature's archetype. */
	get kind(): FeatureKind {
		return this.#spec.kind;
	}

	/** (Re)configure this instance for a spec at a local-x — the pooling entry point. */
	reset(spec: FeatureSpec, localX: number, shoreOffset: number, scale: number): void {
		this.#spec = spec;
		this.#localX = localX;
		this.#shoreOffset = shoreOffset;
		this.#width = spec.width * scale;
		this.#heightFrac = clamp(spec.height * scale, 0.01, 0.7);
		this.bounds.x = localX;
		this.bounds.width = this.#width;
		this.alive = true;
		this.#phase = this.#rng.next();
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#time = ctx.time;
		const cfg = ctx.env.config;
		const mood = ctx.env.mood;
		// Feet sit on the grassy bank above the waterline; far bands a touch higher.
		this.#baseline = clamp(
			(1 - cfg.waterLevel - cfg.bankHeight) - this.#shoreOffset,
			0.1,
			1,
		);
		this.#wind = cfg.wind;
		const c = this.#c;
		c.foliage = foliageColor(mood, this.depth, true);
		c.foliageDeep = foliageColor(mood, this.depth, false);
		c.trunk = mix(mood.trunk, mood.haze, (1 - this.depth) * 0.45);
		c.land = landColor(mood, this.depth);
		c.rock = mix(
			mix(rgb(150, 146, 146), mood.landNear, 0.25),
			mood.haze,
			(1 - this.depth) * 0.5,
		);
		c.cabinWall = mix(
			mix(rgb(150, 98, 62), mood.haze, 0.15),
			mood.haze,
			(1 - this.depth) * 0.4,
		);
		c.cabinRoof = mix(
			mix(rgb(74, 66, 70), mood.landNear, 0.3),
			mood.haze,
			(1 - this.depth) * 0.4,
		);
		c.bloom = mix(mood.bloom, mood.haze, (1 - this.depth) * 0.4);
		c.snow = mood.snow;
		c.snowColor = mix(mood.snowColor, mood.haze, (1 - this.depth) * 0.4);
		// Cosy windows glow more in the dimmer golden hours, barely at bright noon.
		c.windowAlpha = clamp(0.95 - mood.daylight, 0.12, 0.75);
	}

	draw(ctx: DrawContext): void {
		const sx = ctx.camera.project(this.#localX, this.depth);
		const sw = this.#width * ctx.camera.unit;
		if (sx + sw < -8 || sx > ctx.width + 8) return; // offscreen this frame

		const groundY = ctx.height * this.#baseline;
		const h = this.#heightFrac * ctx.camera.unit;
		const out = ctx.out;
		const spec = this.#spec;
		// A gentle wind sway of the crown — taller features sway more; stateless from the clock.
		const sway = Math.sin(this.#time * 0.0012 + this.#phase * 6.283) * this.#wind *
			h * 0.05;

		switch (spec.kind) {
			case "broadleaf":
				return drawBroadleaf(out, sx, groundY, sw, h, spec, this.#c, sway);
			case "pine":
				return drawPine(out, sx, groundY, sw, h, spec, this.#c, sway);
			case "shrub":
				return drawShrub(out, sx, groundY, sw, h, spec, this.#c, sway);
			case "cabin":
				return drawCabin(
					out,
					sx,
					groundY,
					sw,
					h,
					spec,
					this.#c,
					this.#time,
					this.#phase,
				);
			case "rock":
				return drawRock(out, sx, groundY, sw, h, spec, this.#c);
			case "hill":
				return drawHill(out, sx, groundY, sw, h, this.#c);
			case "reeds":
				return drawReeds(out, sx, groundY, sw, h, this.#c, sway, this.#phase);
		}
	}
}

/* -------------------------------------------------------------------------- *
 * Per-kind drawing
 * -------------------------------------------------------------------------- */

function drawBroadleaf(
	out: DisplayListBuilder,
	x: number,
	groundY: number,
	w: number,
	h: number,
	spec: FeatureSpec,
	c: FeatureColors,
	sway: number,
): void {
	const cx = x + w / 2;
	const trunkW = Math.max(1, w * 0.16);
	const trunkH = h * 0.42;
	// A leaning trunk: top shifts by lean + wind sway.
	const topX = cx + spec.lean * w * 0.3 + sway;
	out.polygon([
		cx - trunkW / 2,
		groundY,
		cx + trunkW / 2,
		groundY,
		topX + trunkW * 0.4,
		groundY - trunkH,
		topX - trunkW * 0.4,
		groundY - trunkH,
	], c.trunk);

	// Canopy: a shaded mass under a lit mass, plus side lobes for an organic crown.
	const r = w * (0.42 + spec.roundness * 0.12);
	const cyTop = groundY - h + r * 0.85;
	const cxx = topX;
	out.circle(cxx - w * 0.18, cyTop + h * 0.14, r * 0.82, c.foliageDeep);
	out.circle(cxx + w * 0.26, cyTop + h * 0.12, r * 0.74, c.foliageDeep);
	out.circle(cxx, cyTop, r, c.foliage);
	out.circle(cxx - w * 0.28, cyTop + h * 0.06, r * 0.66, c.foliage);
	out.circle(cxx + w * 0.28, cyTop + h * 0.06, r * 0.66, c.foliage);

	// A few blossom/leaf-accent specks (subtle; the season colour carries the read).
	if (spec.variant < 0.7) {
		const dots = 3 + Math.floor(spec.variant * 6);
		for (let i = 0; i < dots; i++) {
			const a = spec.variant * 31.4 + i * 2.39;
			const dx = Math.cos(a) * r * 0.7;
			const dy = Math.sin(a) * r * 0.55;
			out.circle(
				cxx + dx,
				cyTop + dy,
				Math.max(0.8, w * 0.05),
				withAlpha(c.bloom, 0.7),
			);
		}
	}

	// Snow settling on the lit crown in winter.
	if (c.snow > 0.02) {
		out.circle(cxx, cyTop - r * 0.36, r * 0.7, withAlpha(c.snowColor, c.snow * 0.55));
	}
}

function drawPine(
	out: DisplayListBuilder,
	x: number,
	groundY: number,
	w: number,
	h: number,
	spec: FeatureSpec,
	c: FeatureColors,
	sway: number,
): void {
	const cx = x + w / 2;
	const trunkW = Math.max(1, w * 0.14);
	const trunkH = h * 0.16;
	out.rect(cx - trunkW / 2, groundY - trunkH, trunkW, trunkH, c.trunk);

	const tiers = Math.max(2, spec.tiers);
	const top = groundY - h;
	const span = h - trunkH;
	const tierH = span / tiers * 1.35; // overlap so tiers read as one tree
	for (let i = 0; i < tiers; i++) {
		const f = i / (tiers - 1); // 0 bottom .. 1 top
		const yb = groundY - trunkH - (span * i) / tiers;
		const halfW = (w / 2) * (1 - f * 0.62);
		// Higher tiers sway more.
		const sx = cx + sway * (0.3 + f);
		const lit = i % 2 === 0 ? c.foliage : c.foliageDeep;
		out.polygon([sx - halfW, yb, sx + halfW, yb, sx + sway * 0.2, yb - tierH], lit);
		if (c.snow > 0.02) {
			out.polygon(
				[
					sx - halfW * 0.5,
					yb - tierH * 0.42,
					sx + halfW * 0.5,
					yb - tierH * 0.42,
					sx,
					yb - tierH,
				],
				withAlpha(c.snowColor, c.snow * 0.7),
			);
		}
	}
	// faint apex highlight
	out.circle(
		cx,
		top,
		Math.max(0.8, w * 0.06),
		withAlpha(c.snow > 0.3 ? c.snowColor : c.foliage, 0.8),
	);
}

function drawShrub(
	out: DisplayListBuilder,
	x: number,
	groundY: number,
	w: number,
	h: number,
	spec: FeatureSpec,
	c: FeatureColors,
	sway: number,
): void {
	const cx = x + w / 2 + sway * 0.5;
	const r = h * 0.7;
	out.circle(cx - w * 0.22, groundY - r * 0.7, r * 0.85, c.foliageDeep);
	out.circle(cx + w * 0.22, groundY - r * 0.7, r * 0.85, c.foliageDeep);
	out.circle(cx, groundY - r, r, c.foliage);
	if (spec.variant < 0.5) {
		out.circle(
			cx + w * 0.1,
			groundY - r,
			Math.max(0.8, w * 0.05),
			withAlpha(c.bloom, 0.8),
		);
	}
	if (c.snow > 0.02) {
		out.circle(cx, groundY - r * 1.3, r * 0.7, withAlpha(c.snowColor, c.snow * 0.5));
	}
}

function drawCabin(
	out: DisplayListBuilder,
	x: number,
	groundY: number,
	w: number,
	h: number,
	spec: FeatureSpec,
	c: FeatureColors,
	time: number,
	phase: number,
): void {
	const bodyH = h * 0.62;
	const bodyY = groundY - bodyH;
	out.rect(x, bodyY, w, bodyH, c.cabinWall);

	// Pitched roof overhanging the walls a touch.
	const eave = w * 0.1;
	const ridge = groundY - h;
	out.polygon([x - eave, bodyY, x + w + eave, bodyY, x + w / 2, ridge], c.cabinRoof);
	if (c.snow > 0.02) {
		out.polygon(
			[x - eave, bodyY, x + w + eave, bodyY, x + w / 2, ridge],
			withAlpha(c.snowColor, c.snow * 0.6),
		);
	}

	// A warm window (side chosen by the per-instance variant), with a soft glow.
	const winW = w * 0.24;
	const winH = bodyH * 0.42;
	const winX = x + (spec.variant < 0.5 ? w * 0.18 : w * 0.58);
	const winY = bodyY + bodyH * 0.3;
	out.glow(
		winX + winW / 2,
		winY + winH / 2,
		winW * 1.8,
		withAlpha(WINDOW, c.windowAlpha * 0.7),
		0.8,
	);
	out.rect(winX, winY, winW, winH, withAlpha(WINDOW, 0.55 + c.windowAlpha * 0.45));

	// Chimney + drifting smoke.
	if (spec.hasChimney) {
		const chW = w * 0.12;
		const chX = x + w * 0.7;
		const chTop = ridge + h * 0.16;
		out.rect(chX, chTop, chW, groundY - chTop - bodyH * 0.55, c.cabinRoof);
		drawSmoke(out, chX + chW / 2, chTop, w, time, phase);
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
	for (let k = 0; k < 3; k++) {
		const t = ((time * 0.00007 + phase + k * 0.34) % 1 + 1) % 1;
		const py = y - t * w * 1.1;
		const px = x + Math.sin((t + phase) * 6.283) * w * 0.18;
		const r = w * (0.1 + t * 0.18);
		out.circle(px, py, r, withAlpha(SMOKE, (1 - t) * 0.22));
	}
}

function drawRock(
	out: DisplayListBuilder,
	x: number,
	groundY: number,
	w: number,
	h: number,
	spec: FeatureSpec,
	c: FeatureColors,
): void {
	const cx = x + w / 2;
	const top = groundY - h;
	// A lumpy boulder as a closed polygon.
	out.polygon([
		x,
		groundY,
		x + w * 0.12,
		groundY - h * 0.55,
		cx - w * 0.1,
		top,
		cx + w * (0.1 + spec.roundness * 0.1),
		top + h * 0.08,
		x + w * 0.9,
		groundY - h * 0.5,
		x + w,
		groundY,
	], c.rock);
	// A lit cap + optional snow.
	out.polygon(
		[cx - w * 0.1, top, cx + w * 0.18, top + h * 0.1, cx, top + h * 0.3],
		lighten(c.rock, 0.12),
	);
	if (c.snow > 0.02) {
		out.polygon(
			[cx - w * 0.12, top, cx + w * 0.2, top + h * 0.1, cx, top + h * 0.34],
			withAlpha(c.snowColor, c.snow * 0.7),
		);
	}
}

/** A low rolling hill: a shallow circular-arc cap traced as a polygon, clipped to its baseline. */
function drawHill(
	out: DisplayListBuilder,
	x: number,
	groundY: number,
	w: number,
	h: number,
	c: FeatureColors,
): void {
	const cx = x + w / 2;
	const top = groundY - h;
	// Circle through the chord ends (width w at groundY) peaking h above: r = (w²/4 + h²) / 2h.
	const r = (w * w / 4 + h * h) / (2 * h);
	const cyc = top + r; // centre below the peak
	const steps = 16;
	const pts: number[] = [];
	for (let i = 0; i <= steps; i++) {
		const px = x + (w * i) / steps;
		const dx = px - cx;
		pts.push(px, cyc - Math.sqrt(Math.max(0, r * r - dx * dx)));
	}
	pts.push(x + w, groundY, x, groundY); // close along the baseline
	// The hill body uses the grassy land tone (foliage-tinted), with a snow dusting in winter.
	out.polygon(pts, mix(c.land, c.foliageDeep, 0.45));
	if (c.snow > 0.02) {
		// A second, shallower cap of snow on the crown.
		const snowPts: number[] = [];
		for (let i = 0; i <= steps; i++) {
			const px = x + (w * i) / steps;
			const dx = px - cx;
			const y = cyc - Math.sqrt(Math.max(0, r * r - dx * dx));
			snowPts.push(px, y);
		}
		const capY = top + h * 0.5;
		snowPts.push(x + w * 0.78, capY, x + w * 0.22, capY);
		out.polygon(snowPts, withAlpha(c.snowColor, c.snow * 0.6));
	}
}

function drawReeds(
	out: DisplayListBuilder,
	x: number,
	groundY: number,
	w: number,
	h: number,
	c: FeatureColors,
	sway: number,
	phase: number,
): void {
	const blades = 4;
	const col = mix(c.foliageDeep, c.foliage, 0.4);
	for (let i = 0; i < blades; i++) {
		const bx = x + (w * (i + 0.5)) / blades;
		const bend = sway * 1.6 + Math.sin(phase * 6 + i) * w * 0.1;
		out.line(bx, groundY, bx + bend, groundY - h, Math.max(1, w * 0.12), col);
	}
}
