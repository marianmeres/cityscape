/**
 * Drifting clouds — soft, sunlit puffs that wander across the sky. Count scales with the live
 * `clouds` knob, and rain thickens and greys them (and pulls them lower). Each cloud is a few
 * overlapping translucent puffs; the field wraps against a wide tile so it never runs out.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, mix, withAlpha } from "../../engine/math/color.ts";
import { clamp, wrap } from "../../engine/math/ease.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

interface Puff {
	dx: number;
	dy: number;
	r: number;
}
interface Cloud {
	x: number;
	yFrac: number;
	scale: number;
	drift: number; // own slow horizontal drift (px/ms)
	alpha: number;
	puffs: Puff[];
}

/** A wrapped field of soft drifting clouds. */
export class CloudField implements Entity<NatureEnv> {
	readonly depth = 0.12;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	readonly #tileW: number;
	readonly #clouds: Cloud[];
	#chance = 0.6;
	#rain = 0;
	#wind = 0;
	#time = 0;
	#mood!: Mood;

	constructor(rng: Rng, count = 8, tileW = 2400) {
		this.#tileW = tileW;
		this.#clouds = Array.from({ length: count }, () => {
			const scale = rng.float(0.7, 1.8);
			const puffCount = rng.int(4, 7);
			const puffs: Puff[] = [];
			for (let i = 0; i < puffCount; i++) {
				puffs.push({
					dx: rng.float(-1, 1) * 46 * scale,
					dy: rng.float(-1, 1) * 12 * scale,
					r: rng.float(16, 34) * scale,
				});
			}
			return {
				x: rng.float(0, tileW),
				yFrac: rng.float(0.06, 0.42),
				scale,
				drift: rng.float(-0.005, 0.005),
				alpha: rng.float(0.5, 0.85),
				puffs,
			};
		});
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
		this.#chance = ctx.env.config.clouds;
		this.#rain = ctx.env.config.rain;
		this.#wind = ctx.env.config.wind;
	}

	draw(ctx: DrawContext): void {
		// Rain forces full overcast even if the clouds knob is low.
		const cover = clamp(this.#chance + this.#rain * 0.6, 0, 1);
		if (cover <= 0.001) return;
		const { out, width, height } = ctx;
		const scroll = ctx.camera.scroll * ctx.camera.parallaxAt(this.depth) *
			ctx.camera.unit;
		const shown = Math.max(
			1,
			Math.floor(this.#clouds.length * Math.min(1, cover + 0.05)),
		);
		// Sunlit white, greying down as it rains.
		const lit: Color = mix(this.#mood.snowColor, this.#mood.sky[1].color, 0.18);
		const grey: Color = mix(lit, this.#mood.landNear, 0.4);
		const tone = mix(lit, grey, this.#rain);
		const windDrift = this.#wind * 0.004;

		for (let i = 0; i < shown; i++) {
			const c = this.#clouds[i];
			const cx = wrap(
				c.x - scroll + (c.drift + windDrift) * this.#time,
				this.#tileW,
			);
			if (cx > width + 120) continue;
			// Rain pulls the deck a little lower.
			const cy = (c.yFrac + this.#rain * 0.05) * height;
			const col = withAlpha(tone, c.alpha * clamp(cover + 0.2, 0, 1));
			for (const p of c.puffs) out.circle(cx + p.dx, cy + p.dy, p.r, col);
		}
	}
}
