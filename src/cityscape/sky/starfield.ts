/**
 * The starfield — a wrapped tile of stars with a subtle, stateless twinkle.
 *
 * Stars live in a fixed-width tile; each frame their x is wrapped against the camera's (very
 * small) parallax scroll, so the field is effectively infinite at bounded cost. Count scales with
 * the live `starDensity` knob. Twinkle is a cheap function of the clock — no per-star timers.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { withAlpha } from "../../engine/math/color.ts";
import { wrap } from "../../engine/math/ease.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

interface Star {
	x: number;
	yFrac: number;
	size: number;
	base: number; // base brightness 0..1
	tw: number; // twinkle phase
}

/** A wrapped, twinkling field of stars. */
export class Starfield implements Entity<CityEnv> {
	readonly depth = 0.02;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	readonly #tileW: number;
	readonly #stars: Star[];
	#density: number;
	#time = 0;
	#mood!: Mood;

	constructor(rng: Rng, count = 220, tileW = 1600) {
		this.#tileW = tileW;
		this.#density = 1;
		this.#stars = Array.from({ length: count }, () => ({
			x: rng.float(0, tileW),
			yFrac: rng.float(0.02, 0.62),
			size: rng.float(0.5, 1.7),
			base: rng.float(0.3, 1),
			tw: rng.float(0, 6.283),
		}));
	}

	update(ctx: UpdateContext<CityEnv>): void {
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
		this.#density = ctx.env.config.starDensity;
	}

	draw(ctx: DrawContext): void {
		const { out, width, height } = ctx;
		if (this.#density <= 0) return;
		const scroll = ctx.camera.scroll * ctx.camera.parallaxAt(this.depth) *
			ctx.camera.unit;
		const shown = Math.floor(this.#stars.length * this.#density);
		const star = this.#mood.star;
		const t = this.#time * 0.002;
		for (let i = 0; i < shown; i++) {
			const s = this.#stars[i];
			const sx = wrap(s.x - scroll, this.#tileW);
			if (sx > width) continue;
			const twinkle = 0.65 + 0.35 * Math.sin(t + s.tw);
			out.circle(sx, s.yFrac * height, s.size, withAlpha(star, s.base * twinkle));
		}
	}
}
