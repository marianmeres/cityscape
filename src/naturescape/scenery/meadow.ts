/**
 * The meadow bank — a grassy embankment grounding the land on the water's edge, so the hills don't
 * appear to float directly on the lake.
 *
 * It draws a grass band between the land's feet and the waterline, a soft water's-edge line, and a
 * scatter of grass tufts and wildflowers that scroll with the near land and cast faint reflections
 * down onto the water. Height is the live `bankHeight` knob; set it to 0 to remove the bank. Drawn
 * after the water so its reflections sit on the surface — the direct analogue of the cityscape's
 * lit shore.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, darken, lighten, mix, withAlpha } from "../../engine/math/color.ts";
import type { DisplayListBuilder } from "../../engine/render/draw-command.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

/** Parallax depth the tufts scroll at (matches the near land band). */
const TUFT_DEPTH = 0.92;
/** Tuft spacing in viewport-height (world) units. */
const TUFT_SPACING = 0.05;

/** A grassy bank separating the land from the water. */
export class Meadow implements Entity<NatureEnv> {
	readonly depth = 1; // front-most band (added after the water layer)
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#mood!: Mood;
	#water = 0.16;
	#bank = 0.02;
	#time = 0;
	#wind = 0;
	#flowerPhase: number;

	constructor(rng: Rng) {
		this.#flowerPhase = rng.float(0, 1);
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#mood = ctx.env.mood;
		this.#water = ctx.env.config.waterLevel;
		this.#bank = ctx.env.config.bankHeight;
		this.#time = ctx.time;
		this.#wind = ctx.env.config.wind;
	}

	draw(ctx: DrawContext): void {
		if (this.#bank <= 0.001) return;
		const { out, width, height } = ctx;
		const mood = this.#mood;
		const waterY = (1 - this.#water) * height; // top of the water
		const bandH = this.#bank * height;
		const bankTopY = waterY - bandH; // land feet

		// The bank: grass, slightly brighter toward the land, snow-dusted in winter.
		const grassTop = lighten(mix(mood.ground, mood.foliageDeep, 0.3), 0.04);
		const grassBot = darken(mood.ground, 0.12);
		out.gradient(0, bankTopY, width, bandH, [
			{ at: 0, color: grassTop },
			{ at: 1, color: grassBot },
		], true);
		if (mood.snow > 0.02) {
			out.gradient(0, bankTopY, width, bandH * 0.7, [
				{ at: 0, color: withAlpha(mood.snowColor, mood.snow * 0.55) },
				{ at: 1, color: withAlpha(mood.snowColor, 0) },
			], true);
		}

		// Soft water's-edge line.
		out.line(0, waterY, width, waterY, 1, withAlpha(lighten(mood.water, 0.18), 0.55));

		// Grass tufts + wildflowers, spaced and scrolling with the near land.
		const cam = ctx.camera;
		const leftWU = cam.viewLeft(TUFT_DEPTH);
		const rightWU = leftWU + width / cam.unit;
		const tuftH = Math.max(3, bandH * 1.1);
		const grass = darken(mix(mood.ground, mood.foliageDeep, 0.5), 0.05);
		const sway = Math.sin(this.#time * 0.0014) * this.#wind * tuftH * 0.25;
		let x = Math.ceil((leftWU - TUFT_SPACING) / TUFT_SPACING) * TUFT_SPACING;
		for (; x <= rightWU + TUFT_SPACING; x += TUFT_SPACING) {
			const sx = cam.project(x, TUFT_DEPTH);
			if (sx < -8 || sx > width + 8) continue;
			drawTuft(out, sx, bankTopY, tuftH, sway, grass);
			// A wildflower on roughly every third tuft (stable per world position).
			const r = pseudo(x);
			if (mood.snow < 0.5 && r < 0.34) {
				drawFlower(out, sx, bankTopY, tuftH, mood.bloom, r);
				drawReflection(
					out,
					sx,
					waterY,
					height - waterY,
					mood.bloom,
					this.#time,
					this.#flowerPhase,
				);
			}
		}
	}
}

/** A small fan of grass blades. */
function drawTuft(
	out: DisplayListBuilder,
	x: number,
	bankTopY: number,
	h: number,
	sway: number,
	color: Color,
): void {
	for (let i = -1; i <= 1; i++) {
		out.line(
			x,
			bankTopY,
			x + i * h * 0.3 + sway,
			bankTopY - h,
			Math.max(1, h * 0.14),
			color,
		);
	}
}

/** A wildflower: a short stem topped by a bright bloom. */
function drawFlower(
	out: DisplayListBuilder,
	x: number,
	bankTopY: number,
	h: number,
	bloom: Color,
	r: number,
): void {
	const stemTop = bankTopY - h * (1.1 + r * 0.5);
	out.line(x, bankTopY, x, stemTop, Math.max(1, h * 0.1), darken(bloom, 0.55));
	out.circle(x, stemTop, Math.max(1, h * 0.26), bloom);
}

function drawReflection(
	out: DisplayListBuilder,
	x: number,
	waterY: number,
	waterH: number,
	color: Color,
	time: number,
	phase: number,
): void {
	if (waterH <= 0) return;
	const reflH = waterH * 0.4;
	const wob = Math.sin(time * 0.0012 + x * 0.05 + phase * 6) * 2;
	const w = 3;
	out.gradient(x - w / 2 + wob, waterY, w, reflH, [
		{ at: 0, color: withAlpha(color, 0.28) },
		{ at: 1, color: withAlpha(color, 0) },
	], true);
}

/** A cheap, deterministic 0..1 hash of a world-x so a flower stays put as the camera scrolls. */
function pseudo(x: number): number {
	const s = Math.sin(x * 127.1) * 43758.5453;
	return s - Math.floor(s);
}
