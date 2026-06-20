/**
 * Snow — soft flakes drifting down across the frame, swaying sideways as they fall.
 *
 * Like the rain, a fixed pool of flakes wraps vertically (stateless from the clock) for an infinite
 * fall at bounded cost; each flake also sways on its own slow sine, nudged by the wind. Density and
 * fall speed scale with the live `snowfall` knob — gorgeous paired with the winter season. Drawn
 * near the front; 0 snowfall draws nothing.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { withAlpha } from "../../engine/math/color.ts";
import { wrap } from "../../engine/math/ease.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

interface Flake {
	xFrac: number;
	yFrac: number;
	r: number; // px-ish radius at a 1000px reference
	speed: number; // fraction of height per ms
	swayAmp: number;
	swayPhase: number;
}

/** A wrapped field of falling snow. */
export class Snow implements Entity<NatureEnv> {
	readonly depth = 1.16;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	readonly #flakes: Flake[];
	#snow = 0;
	#wind = 0;
	#time = 0;
	#mood!: Mood;

	constructor(rng: Rng, count = 180) {
		this.#flakes = Array.from({ length: count }, () => ({
			xFrac: rng.float(0, 1),
			yFrac: rng.float(0, 1),
			r: rng.float(0.8, 2.4),
			speed: rng.float(0.00018, 0.0004),
			swayAmp: rng.float(0.01, 0.04),
			swayPhase: rng.float(0, 6.283),
		}));
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#snow = ctx.env.config.snowfall;
		this.#wind = ctx.env.config.wind;
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
	}

	draw(ctx: DrawContext): void {
		if (this.#snow <= 0.001) return;
		const { out, width, height } = ctx;
		const shown = Math.floor(this.#flakes.length * this.#snow);
		const flake = withAlpha(this.#mood.snowColor, 0.85);
		const drift = this.#wind * 0.06;
		for (let i = 0; i < shown; i++) {
			const f = this.#flakes[i];
			const y = wrap(f.yFrac + this.#time * f.speed, 1);
			const sway = Math.sin(this.#time * 0.001 + f.swayPhase) * f.swayAmp +
				drift * y;
			const x = wrap(f.xFrac + sway, 1) * width;
			out.circle(x, y * height, f.r, withAlpha(flake, 0.6 + f.r * 0.15));
		}
	}
}
