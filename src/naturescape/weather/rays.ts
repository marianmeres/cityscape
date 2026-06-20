/**
 * God-rays — soft shafts of light fanning down from the sun.
 *
 * Each shaft is a long, faint triangle emanating from the live sun position (so the rays always
 * key off the same point as the sun and its water reflection), with a slow per-shaft brightness
 * shimmer. Strength scales with the `sunRays` knob and fades with the sun toward the horizon. Sits
 * in front of the clouds so the light reads as breaking through; 0 draws nothing.
 *
 * @module
 */

import { withAlpha } from "../../engine/math/color.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import { sunPlacement } from "../scenery/sun.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

const RAYS = 7;

/** Light shafts fanning down from the sun. */
export class SunRays implements Entity<NatureEnv> {
	readonly depth = 0.14;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#strength = 0.4;
	#time = 0;
	#mood!: Mood;

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#strength = ctx.env.config.sunRays;
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
	}

	draw(ctx: DrawContext): void {
		if (this.#strength <= 0.001) return;
		const { out, width, height } = ctx;
		const sun = sunPlacement(this.#mood, width, height);
		if (sun.opacity < 0.05) return;
		const reach = height * 1.1;
		const base = this.#strength * sun.opacity;
		for (let i = 0; i < RAYS; i++) {
			// Fan the shafts around straight-down, biased toward the side away from screen edges.
			const spread = (i / (RAYS - 1) - 0.5) * 1.3; // radians, -0.65..0.65
			const angle = Math.PI / 2 + spread;
			const dx = Math.cos(angle);
			const dy = Math.sin(angle);
			const fx = sun.x + dx * reach;
			const fy = sun.y + dy * reach;
			// Perpendicular half-width at the far end.
			const halfW = width * 0.018 * (0.6 + Math.abs(spread));
			const px = -dy * halfW;
			const py = dx * halfW;
			const shimmer = 0.55 + 0.45 * Math.sin(this.#time * 0.0008 + i * 1.7);
			const a = base * 0.1 * shimmer;
			out.polygon(
				[sun.x, sun.y, fx + px, fy + py, fx - px, fy - py],
				withAlpha(this.#mood.sun, a),
			);
		}
	}
}
