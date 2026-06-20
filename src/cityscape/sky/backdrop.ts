/**
 * The sky backdrop — the farthest entity: a full-viewport vertical gradient plus a soft
 * light-pollution glow band sitting where the skyline meets the sky.
 *
 * It reads the live {@link Mood} (resolved each tick) so the whole sky breathes warm→cool with
 * everything else. Being depth ~0 it is added to the backmost layer and drawn first.
 *
 * @module
 */

import { rgb, withAlpha } from "../../engine/math/color.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

/** Full-screen sky gradient + horizon glow. */
export class SkyBackdrop implements Entity<CityEnv> {
	readonly depth = 0;
	// Never cull: it spans the whole world.
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#mood!: Mood;
	#horizon = 0.72;

	update(ctx: UpdateContext<CityEnv>): void {
		this.#mood = ctx.env.mood;
		// The horizon sits at the city's feet (the shore, just above the water).
		this.#horizon = 1 - ctx.env.config.waterLevel - ctx.env.config.shoreHeight;
	}

	draw(ctx: DrawContext): void {
		const { out, width, height } = ctx;
		const mood = this.#mood;
		// Sky gradient, top → horizon. (Kept first so renderers can treat it as the frame's base.)
		out.gradient(0, 0, width, height, mood.sky, true);
		// Over-draw the sky above the viewport (disjoint strip) so a vertical pan reveals no gap.
		out.rect(0, -height * 0.3, width, height * 0.3, mood.sky[0].color);
		// Light-pollution glow: a soft band fading up and down from the horizon line.
		const glow = mood.horizonGlow;
		const band = height * 0.5;
		out.gradient(
			0,
			height * this.#horizon - band * 0.6,
			width,
			band,
			[
				{ at: 0, color: withAlpha(glow, 0) },
				{ at: 0.6, color: withAlpha(glow, 0.45) },
				{ at: 1, color: withAlpha(rgb(glow.r, glow.g, glow.b), 0) },
			],
			true,
		);
	}
}
