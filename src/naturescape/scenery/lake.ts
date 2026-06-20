/**
 * The lake/river — a calm, reflective water plane filling the bottom of the world.
 *
 * The land stands at a waterline `1 - waterLevel`; below it this entity paints a gently-reflective
 * water plane: a vertical gradient (sky-tinted near the bank → deeper at the bottom), an inverted
 * reflection of the sky, a warm shimmering column under the sun, and slow horizontal shimmer.
 * Everything reads from the live {@link Mood} and `waterLevel`, so it breathes and resizes with the
 * rest. Drawn front-most (after the land bands) so it sits in front of the across-the-water hills.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, darken, lighten, mix, withAlpha } from "../../engine/math/color.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import { sunPlacement } from "./sun.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

/** A calm reflective water plane occupying the bottom `waterLevel` of the viewport. */
export class Lake implements Entity<NatureEnv> {
	readonly depth = 1; // front-most: drawn after every land band
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#mood!: Mood;
	#level = 0.16;
	#time = 0;
	#shimmer: number[];

	constructor(rng: Rng) {
		// Fixed shimmer-line depths (fraction of the water band).
		this.#shimmer = Array.from({ length: 7 }, () => rng.float(0.04, 0.8));
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#mood = ctx.env.mood;
		this.#level = ctx.env.config.waterLevel;
		this.#time = ctx.time;
	}

	draw(ctx: DrawContext): void {
		if (this.#level <= 0.001) return;
		const { out, width, height } = ctx;
		const mood = this.#mood;
		const waterY = (1 - this.#level) * height;
		const waterH = height - waterY;
		if (waterH <= 0) return;

		// Body: sky/glow-tinted just below the bank, deepening toward the bottom.
		const top: Color = mix(mood.water, mood.sunGlow, 0.18);
		const bottom: Color = darken(mood.water, 0.34);
		out.gradient(0, waterY, width, waterH, [
			{ at: 0, color: top },
			{ at: 1, color: bottom },
		], true);
		// Over-draw below the viewport so panning down never reveals a gap.
		out.rect(0, height, width, height * 0.3, bottom);

		// Inverted sky reflection fading down from the bank.
		out.gradient(0, waterY, width, waterH * 0.6, [
			{ at: 0, color: withAlpha(mood.sky[2].color, 0.5) },
			{ at: 1, color: withAlpha(mood.sky[1].color, 0) },
		], true);

		// A crisp-ish bank line where the land meets the water.
		out.line(0, waterY, width, waterY, 1, withAlpha(lighten(mood.sunGlow, 0.1), 0.5));

		// The sun's reflection: a warm shimmering column directly under the sun.
		const sun = sunPlacement(mood, width, height);
		if (sun.opacity > 0.05) {
			const colW = Math.max(8, width * 0.05);
			const cols = 5;
			for (let i = 0; i < cols; i++) {
				const f = i / (cols - 1);
				const y = waterY + f * waterH * 0.9;
				const wob = Math.sin(this.#time * 0.002 + i * 1.3) * colW * 0.5;
				const a = (1 - f) * 0.3 * sun.opacity;
				out.gradient(
					sun.x - colW / 2 + wob,
					y,
					colW,
					waterH * 0.18,
					[
						{ at: 0, color: withAlpha(mood.sun, a) },
						{ at: 1, color: withAlpha(mood.sun, 0) },
					],
					true,
				);
			}
		}

		// Slow horizontal shimmer lines, brighter near the bank, gently pulsing.
		const shimmer = lighten(mood.water, 0.2);
		for (let i = 0; i < this.#shimmer.length; i++) {
			const f = this.#shimmer[i];
			const y = waterY + f * waterH;
			const pulse = 0.5 + 0.5 * Math.sin(this.#time * 0.0012 + i * 1.7);
			const a = (1 - f) * 0.09 * pulse;
			out.line(0, y, width, y, 1, withAlpha(shimmer, a));
		}
	}
}
