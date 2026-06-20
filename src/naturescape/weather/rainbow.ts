/**
 * A rainbow — a soft, banded arc that brightens when it rains in the sun.
 *
 * Drawn as concentric colour bands, each a polyline of short segments along a circle whose centre
 * sits below the horizon on the side opposite the sun. Visibility scales with the `rainbow` knob
 * and is boosted by active rain and a high sun (the real-world recipe: sun + falling water). It is
 * always faint and calm — a quiet delight, never a neon stripe. 0 (with no rain) draws nothing.
 *
 * @module
 */

import { type Color, hsl, withAlpha } from "../../engine/math/color.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

/** Inner→outer band hues (red outside in a real primary bow → violet inside). */
const BAND_HUES = [0, 35, 55, 130, 210, 270];

/** A faint banded arc opposite the sun. */
export class Rainbow implements Entity<NatureEnv> {
	readonly depth = 0.05;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#knob = 0;
	#rain = 0;
	#mood!: Mood;
	#horizon = 0.82;

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#knob = ctx.env.config.rainbow;
		this.#rain = ctx.env.config.rain;
		this.#mood = ctx.env.mood;
		this.#horizon = 1 - ctx.env.config.waterLevel - ctx.env.config.bankHeight;
	}

	draw(ctx: DrawContext): void {
		const mood = this.#mood;
		// Recipe: the knob sets the ceiling; rain + a high sun bring it out.
		const vis = this.#knob * (0.45 + 0.55 * this.#rain) *
			(0.4 + 0.6 * mood.sunHeight);
		if (vis <= 0.02) return;
		const { out, width, height } = ctx;
		// Centre below the horizon, opposite the sun horizontally.
		const cx = (1 - mood.sunX) * width;
		const cy = this.#horizon * height + height * 0.12;
		const outerR = Math.min(width, height) * 0.95;
		const bandW = Math.max(2, outerR * 0.012);
		const steps = 30;
		for (let b = 0; b < BAND_HUES.length; b++) {
			const r = outerR - b * bandW;
			const col: Color = hsl(BAND_HUES[b], 0.6, 0.62);
			const c = withAlpha(col, vis * 0.32);
			let prevX = cx + Math.cos(Math.PI) * r;
			let prevY = cy + Math.sin(Math.PI) * r;
			for (let s = 1; s <= steps; s++) {
				// Sweep the upper half (π → 2π gives the top arc with y above the centre).
				const a = Math.PI + (Math.PI * s) / steps;
				const x = cx + Math.cos(a) * r;
				const y = cy + Math.sin(a) * r;
				out.line(prevX, prevY, x, y, bandW + 1, c);
				prevX = x;
				prevY = y;
			}
		}
	}
}
