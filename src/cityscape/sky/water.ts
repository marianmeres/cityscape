/**
 * The waterfront — a calm sea/river filling the bottom of the world.
 *
 * The skyline stands at a waterline `1 - waterLevel`; below it this entity paints a dark,
 * gently-reflective water plane: a vertical gradient (glow-tinted near the shore → dark at the
 * bottom), a soft waterline reflection of the light-pollution glow, a few faint vertical
 * light-reflection smears, and slow horizontal shimmer. Everything reads from the live {@link Mood}
 * and `waterLevel`, so it breathes and resizes with the rest. Drawn last (front-most) so it sits
 * in front of the across-the-water city.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, darken, lighten, mix, withAlpha } from "../../engine/math/color.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

interface Reflection {
	xFrac: number;
	width: number;
}

/** A calm reflective water plane occupying the bottom `waterLevel` of the viewport. */
export class Water implements Entity<CityEnv> {
	readonly depth = 1; // front-most: drawn after every building
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#mood!: Mood;
	#level = 0.33;
	#time = 0;
	#shimmer: number[];
	#reflections: Reflection[];

	constructor(rng: Rng) {
		// Fixed shimmer-line depths (fraction of the water band) and a few light smears.
		this.#shimmer = Array.from({ length: 6 }, () => rng.float(0.04, 0.7));
		this.#reflections = Array.from({ length: 5 }, () => ({
			xFrac: rng.float(0.05, 0.95),
			width: rng.float(0.01, 0.04),
		}));
	}

	update(ctx: UpdateContext<CityEnv>): void {
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

		// Body: glow-tinted just below the shore, fading to near-black at the bottom.
		const top: Color = darken(mix(mood.horizonGlow, mood.buildingNear, 0.5), 0.1);
		const bottom: Color = darken(mood.buildingNear, 0.35);
		out.gradient(0, waterY, width, waterH, [
			{ at: 0, color: top },
			{ at: 1, color: bottom },
		], true);
		// Over-draw below the viewport so panning down never reveals a gap.
		out.rect(0, height, width, height * 0.3, bottom);

		// A crisp-ish line where the city meets the water.
		out.line(0, waterY, width, waterY, 1, withAlpha(mood.horizonGlow, 0.5));

		// Reflected light-pollution glow fading down from the shore.
		out.gradient(0, waterY, width, waterH * 0.55, [
			{ at: 0, color: withAlpha(mood.horizonGlow, 0.32) },
			{ at: 1, color: withAlpha(mood.horizonGlow, 0) },
		], true);

		// Faint vertical light reflections (city lights smeared on the surface).
		const reflTone = lighten(mood.window, 0.05);
		for (const r of this.#reflections) {
			const x = r.xFrac * width;
			const w = Math.max(1, r.width * width);
			const wob = Math.sin(this.#time * 0.0008 + r.xFrac * 7) * w * 0.4;
			out.gradient(x + wob, waterY, w, waterH * 0.7, [
				{ at: 0, color: withAlpha(reflTone, 0.16) },
				{ at: 1, color: withAlpha(reflTone, 0) },
			], true);
		}

		// Slow horizontal shimmer lines, brighter near the shore, gently pulsing.
		const shimmer = lighten(mood.horizonGlow, 0.15);
		for (let i = 0; i < this.#shimmer.length; i++) {
			const f = this.#shimmer[i];
			const y = waterY + f * waterH;
			const pulse = 0.5 + 0.5 * Math.sin(this.#time * 0.0012 + i * 1.7);
			const a = (1 - f) * 0.08 * pulse;
			out.line(0, y, width, y, 1, withAlpha(shimmer, a));
		}
	}
}
