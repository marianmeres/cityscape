/**
 * The moon — an occasional, slowly-drifting disc with a soft halo and a chosen phase.
 *
 * Whether the moon is present is gated by the live `moonChance` knob against a fixed per-instance
 * roll, and it fades in/out smoothly when you cross that threshold (no popping). It sits very far
 * (depth ≈ 0.03) so it barely parallaxes, and drifts slowly so it's never static. The lunar phase
 * is carved by compositing a sky-coloured disc offset over the lit disc.
 *
 * @module
 */

import { type Color, mix, withAlpha } from "../../engine/math/color.ts";
import type { Rng } from "../../engine/math/rng.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

/** A slowly drifting moon high in the sky. */
export class Moon implements Entity<CityEnv> {
	readonly depth = 0.03;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#roll: number;
	#xFrac: number;
	#yFrac: number;
	#radiusFrac: number;
	#phase: number; // -1..1, 0 = full, ±1 = thin crescent
	#drift = 0;
	#opacity = 0;
	#mood!: Mood;

	constructor(rng: Rng) {
		this.#roll = rng.next();
		this.#xFrac = rng.float(0.12, 0.82);
		this.#yFrac = rng.float(0.12, 0.34);
		this.#radiusFrac = rng.float(0.04, 0.07);
		this.#phase = rng.float(-0.8, 0.8);
	}

	update(ctx: UpdateContext<CityEnv>): void {
		this.#mood = ctx.env.mood;
		this.#drift += ctx.dt * 0.000004;
		const target = this.#roll < ctx.env.config.moonChance ? 1 : 0;
		// Ease opacity toward presence/absence.
		this.#opacity += (target - this.#opacity) * Math.min(1, ctx.dt * 0.0008);
	}

	draw(ctx: DrawContext): void {
		if (this.#opacity < 0.01) return;
		const { out, width, height } = ctx;
		const moon = withAlpha(this.#mood.moon, this.#mood.moon.a * this.#opacity);
		const r = this.#radiusFrac * Math.min(width, height);
		const x = (this.#xFrac + Math.sin(this.#drift) * 0.02) * width;
		const y = this.#yFrac * height;

		// Halo.
		out.glow(x, y, r * 3.4, withAlpha(moon, 0.18 * this.#opacity), 0.7);
		// Lit disc.
		out.circle(x, y, r, moon);
		// Phase: a sky-coloured disc offset across the moon carves the shadow.
		if (Math.abs(this.#phase) > 0.06) {
			const shadow = shadowColor(this.#mood, this.#opacity);
			out.circle(x + this.#phase * r * 1.25, y, r * 1.02, shadow);
		}
	}
}

/** Approximate the sky tone behind the moon so the phase shadow reads as "cut out". */
function shadowColor(mood: Mood, opacity: number): Color {
	const sky = mix(mood.sky[0].color, mood.sky[1].color, 0.4);
	return withAlpha(sky, opacity);
}
