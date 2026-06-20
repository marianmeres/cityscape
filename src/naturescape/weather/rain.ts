/**
 * Rain — drifting streaks falling across the whole frame, with little dimples pocking the water.
 *
 * A fixed pool of drops wraps vertically (each drop's y is a stateless function of the clock), so
 * the rain is effectively infinite at bounded cost. Intensity, density and the streaks' wind-tilt
 * all scale with the live `rain` and `wind` knobs. Drawn near the front so it falls over the
 * landscape; 0 rain draws nothing.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { withAlpha } from "../../engine/math/color.ts";
import { wrap } from "../../engine/math/ease.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

interface Drop {
	xFrac: number;
	yFrac: number;
	len: number; // fraction of viewport height
	speed: number; // fraction of height per ms
}

/** A wrapped field of falling rain. */
export class Rain implements Entity<NatureEnv> {
	readonly depth = 1.15;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	readonly #drops: Drop[];
	readonly #dimples: number[]; // x fractions for water dimples
	#rain = 0;
	#wind = 0;
	#water = 0.16;
	#time = 0;
	#mood!: Mood;

	constructor(rng: Rng, count = 200) {
		this.#drops = Array.from({ length: count }, () => ({
			xFrac: rng.float(0, 1),
			yFrac: rng.float(0, 1),
			len: rng.float(0.02, 0.05),
			speed: rng.float(0.0014, 0.0024),
		}));
		this.#dimples = Array.from({ length: 16 }, () => rng.float(0, 1));
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#rain = ctx.env.config.rain;
		this.#wind = ctx.env.config.wind;
		this.#water = ctx.env.config.waterLevel;
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
	}

	draw(ctx: DrawContext): void {
		if (this.#rain <= 0.001) return;
		const { out, width, height } = ctx;
		const shown = Math.floor(this.#drops.length * this.#rain);
		const tilt = this.#wind * 0.35 + 0.05;
		const streak = withAlpha(this.#mood.snowColor, 0.18 + this.#rain * 0.18);
		const waterY = (1 - this.#water) * height;

		for (let i = 0; i < shown; i++) {
			const d = this.#drops[i];
			const y = wrap(d.yFrac + this.#time * d.speed, 1) * height;
			const x = d.xFrac * width + (y / height) * tilt * width * 0.1;
			const len = d.len * height;
			out.line(x, y, x - tilt * len, y - len, 1, streak);
		}

		// Dimples pocking the water surface (tiny shimmer ticks just below the waterline).
		const dimple = withAlpha(this.#mood.snowColor, 0.22 * this.#rain);
		for (let i = 0; i < this.#dimples.length; i++) {
			const t = (this.#time * 0.003 + i * 0.37) % 1;
			const y = waterY + t * (height - waterY) * 0.5;
			const x = this.#dimples[i] * width;
			const r = 1 + t * 4;
			out.line(
				x - r,
				y,
				x + r,
				y,
				1,
				withAlpha(dimple, (1 - t) * 0.3 * this.#rain),
			);
		}
	}
}
