/**
 * The shore — a distinct lit embankment that grounds the city on land, so the skyline doesn't
 * appear to float directly on the water.
 *
 * It draws a flat band between the buildings' feet and the waterline (a quay/promenade), a crisp
 * quay edge where it meets the water, and a row of warm streetlights that scroll with the near
 * city and cast soft reflections down onto the water. Height is the live `shoreHeight` knob; set
 * it to 0 to remove the shore. Drawn after the water so its lamp reflections sit on the surface.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { darken, lighten, mix, rgb, withAlpha } from "../../engine/math/color.ts";
import type { DisplayListBuilder } from "../../engine/render/draw-command.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

/** Parallax depth the streetlights scroll at (matches the near building band). */
const LIGHT_DEPTH = 0.92;
/** Streetlight spacing in viewport-height (world) units. */
const LIGHT_SPACING = 0.16;
/** Warm streetlight colour. */
const LAMP = rgb(255, 198, 120);

/** A lit shore/embankment separating the city from the water. */
export class Shore implements Entity<CityEnv> {
	readonly depth = 1; // front-most band (added after the water layer)
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#mood!: Mood;
	#water = 0.33;
	#shore = 0.025;
	#time = 0;
	#lampPhase: number;

	constructor(rng: Rng) {
		this.#lampPhase = rng.float(0, 1);
	}

	update(ctx: UpdateContext<CityEnv>): void {
		this.#mood = ctx.env.mood;
		this.#water = ctx.env.config.waterLevel;
		this.#shore = ctx.env.config.shoreHeight;
		this.#time = ctx.time;
	}

	draw(ctx: DrawContext): void {
		if (this.#shore <= 0.001) return;
		const { out, width, height } = ctx;
		const mood = this.#mood;
		const waterY = (1 - this.#water) * height; // top of the water
		const bandH = this.#shore * height;
		const shoreTopY = waterY - bandH; // building feet

		// The embankment: a glow-tinted dark land, slightly brighter toward the buildings.
		const landTop = darken(mix(mood.buildingNear, mood.horizonGlow, 0.32), 0.05);
		const landBot = darken(mood.buildingNear, 0.12);
		out.gradient(0, shoreTopY, width, bandH, [
			{ at: 0, color: landTop },
			{ at: 1, color: landBot },
		], true);

		// Crisp quay edge where the land meets the water.
		out.line(
			0,
			waterY,
			width,
			waterY,
			1,
			withAlpha(lighten(mood.horizonGlow, 0.12), 0.6),
		);

		// Streetlights, spaced and scrolling with the near city.
		const cam = ctx.camera;
		const leftWU = cam.viewLeft(LIGHT_DEPTH);
		const rightWU = leftWU + width / cam.unit;
		const lampH = Math.max(4, bandH * 1.1);
		const r = Math.max(1, bandH * 0.18);
		let x = Math.ceil((leftWU - LIGHT_SPACING) / LIGHT_SPACING) * LIGHT_SPACING;
		for (; x <= rightWU + LIGHT_SPACING; x += LIGHT_SPACING) {
			const sx = cam.project(x, LIGHT_DEPTH);
			if (sx < -8 || sx > width + 8) continue;
			drawLamp(out, sx, shoreTopY, bandH, lampH, r);
			drawLampReflection(
				out,
				sx,
				waterY,
				height - waterY,
				r,
				this.#time,
				this.#lampPhase,
			);
		}
	}
}

function drawLamp(
	out: DisplayListBuilder,
	x: number,
	shoreTopY: number,
	bandH: number,
	lampH: number,
	r: number,
): void {
	const bulbY = shoreTopY - lampH;
	// Post.
	out.line(
		x,
		shoreTopY + bandH * 0.2,
		x,
		bulbY,
		Math.max(1, r * 0.4),
		darken(LAMP, 0.6),
	);
	// Bulb + halo.
	out.glow(x, bulbY, r * 4, withAlpha(LAMP, 0.5), 0.8);
	out.circle(x, bulbY, r, LAMP);
}

function drawLampReflection(
	out: DisplayListBuilder,
	x: number,
	waterY: number,
	waterH: number,
	r: number,
	time: number,
	phase: number,
): void {
	if (waterH <= 0) return;
	const reflH = waterH * 0.6;
	const wob = Math.sin(time * 0.0011 + x * 0.05 + phase * 6) * r * 0.8;
	const w = r * 1.6;
	out.gradient(x - w / 2 + wob, waterY, w, reflH, [
		{ at: 0, color: withAlpha(LAMP, 0.32) },
		{ at: 1, color: withAlpha(LAMP, 0) },
	], true);
}
