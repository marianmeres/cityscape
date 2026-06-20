/**
 * The sun — a soft, glowing disc that rides an arc across the sky as the day cycle turns.
 *
 * Its position comes entirely from the {@link Mood} (`sunX` east→west, `sunHeight` low→high), so it
 * is perfectly in step with the sky's warm→cool breathing and with the god-rays and rainbow that
 * key off the same `sunX`. It fades toward the horizon at the dawn/dusk ends so the once-a-cycle
 * wrap from west back to east is never a visible jump. It sits very far (depth ≈ 0.02) so it barely
 * parallaxes against the scrolling land.
 *
 * @module
 */

import { lighten, withAlpha } from "../../engine/math/color.ts";
import { clamp, lerp, smoothstep } from "../../engine/math/ease.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

/** Where the sun sits and how big — shared with the god-rays so they emit from the same point. */
export interface SunPlacement {
	x: number;
	y: number;
	r: number;
	opacity: number;
}

/** Resolve the sun's screen placement for the current mood + viewport (pure; no DOM). */
export function sunPlacement(mood: Mood, width: number, height: number): SunPlacement {
	const horizonY = (1 - 0.18) * height;
	const x = mood.sunX * width;
	const y = lerp(horizonY * 0.96, height * 0.12, mood.sunHeight);
	const r = Math.min(width, height) * 0.05;
	// Fade out as it nears the horizon (hides the once-a-day east↔west wrap).
	const opacity = smoothstep(0.04, 0.22, mood.sunHeight);
	return { x, y, r, opacity };
}

/** A glowing sun that arcs across the sky with the day. */
export class Sun implements Entity<NatureEnv> {
	readonly depth = 0.02;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#mood!: Mood;

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#mood = ctx.env.mood;
	}

	draw(ctx: DrawContext): void {
		const { out, width, height } = ctx;
		const mood = this.#mood;
		const p = sunPlacement(mood, width, height);
		if (p.opacity < 0.01) return;
		const sun = mood.sun;
		// Wide soft halo, a tighter inner bloom, then the disc.
		out.glow(p.x, p.y, p.r * 5.5, withAlpha(mood.sunGlow, 0.22 * p.opacity), 0.6);
		out.glow(p.x, p.y, p.r * 2.6, withAlpha(sun, 0.5 * p.opacity), 0.85);
		out.circle(p.x, p.y, p.r, withAlpha(lighten(sun, 0.1), clamp(p.opacity, 0, 1)));
	}
}
