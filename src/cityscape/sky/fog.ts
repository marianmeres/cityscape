/**
 * Ground fog — a calm mist hugging the base of the skyline.
 *
 * A single soft horizontal band sitting at the building feet / waterline: transparent at the top,
 * thickening toward the feet, gently breathing in opacity. It hazes the base of the city (drawn in
 * front of the building bands) while the shore lamps and traffic — drawn after it — punch through,
 * which is what gives a night waterfront its depth. Colour is read live from the {@link Mood}'s
 * haze/horizon tones, so it warms and cools with everything else.
 *
 * Pure and DOM-free: appearance is resolved in `update()` and cached; `draw()` is geometry only.
 *
 * @module
 */

import { mix, withAlpha } from "../../engine/math/color.ts";
import { clamp } from "../../engine/math/ease.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

/** A low mist band over the waterline; opacity is the live `fog` knob. */
export class GroundFog implements Entity<CityEnv> {
	readonly depth = 1.05; // in front of the buildings + water, behind the shore lamps & traffic
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#mood!: Mood;
	#amount = 0;
	#water = 0.33;
	#shore = 0.025;
	#time = 0;

	update(ctx: UpdateContext<CityEnv>): void {
		this.#mood = ctx.env.mood;
		this.#amount = ctx.env.config.fog;
		this.#water = ctx.env.config.waterLevel;
		this.#shore = ctx.env.config.shoreHeight;
		this.#time = ctx.time;
	}

	draw(ctx: DrawContext): void {
		if (this.#amount <= 0.001) return;
		const { out, width, height } = ctx;
		const waterY = (1 - this.#water) * height;
		const feetY = (1 - this.#water - this.#shore) * height;
		const top = feetY - height * 0.16;
		const bandH = waterY - top;
		if (bandH <= 0) return;

		// A slow opacity breath so the mist never reads as a static gradient.
		const breath = 0.85 + 0.15 * Math.sin(this.#time * 0.0004);
		const a = clamp(this.#amount * 0.34 * breath, 0, 1);
		const c = mix(this.#mood.haze, this.#mood.horizonGlow, 0.4);
		out.gradient(0, top, width, bandH, [
			{ at: 0, color: withAlpha(c, 0) },
			{ at: 0.65, color: withAlpha(c, a) },
			{ at: 1, color: withAlpha(c, a * 0.6) },
		], true);
	}
}
