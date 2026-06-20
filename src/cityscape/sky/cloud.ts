/**
 * Drifting clouds — soft, low-contrast clusters that wander across the sky and can pass over the
 * moon. Count scales with the live `cloudChance` knob. Each cloud is a few overlapping
 * translucent puffs; the whole field wraps against a wide tile so it never runs out.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, mix, withAlpha } from "../../engine/math/color.ts";
import { wrap } from "../../engine/math/ease.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

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
export class CloudField implements Entity<CityEnv> {
	readonly depth = 0.12;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	readonly #tileW: number;
	readonly #clouds: Cloud[];
	#chance = 0.4;
	#time = 0;
	#mood!: Mood;

	constructor(rng: Rng, count = 7, tileW = 2200) {
		this.#tileW = tileW;
		this.#clouds = Array.from({ length: count }, () => {
			const scale = rng.float(0.6, 1.6);
			const puffCount = rng.int(3, 6);
			const puffs: Puff[] = [];
			for (let i = 0; i < puffCount; i++) {
				puffs.push({
					dx: rng.float(-1, 1) * 40 * scale,
					dy: rng.float(-1, 1) * 10 * scale,
					r: rng.float(14, 30) * scale,
				});
			}
			return {
				x: rng.float(0, tileW),
				yFrac: rng.float(0.08, 0.4),
				scale,
				drift: rng.float(-0.004, 0.004),
				alpha: rng.float(0.06, 0.16),
				puffs,
			};
		});
	}

	update(ctx: UpdateContext<CityEnv>): void {
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
		this.#chance = ctx.env.config.cloudChance;
	}

	draw(ctx: DrawContext): void {
		if (this.#chance <= 0) return;
		const { out, width, height } = ctx;
		const scroll = ctx.camera.scroll * ctx.camera.parallaxAt(this.depth) *
			ctx.camera.unit;
		const shown = Math.floor(this.#clouds.length * Math.min(1, this.#chance + 0.05));
		const tone: Color = mix(this.#mood.haze, this.#mood.horizonGlow, 0.3);

		for (let i = 0; i < shown; i++) {
			const c = this.#clouds[i];
			const cx = wrap(c.x - scroll + c.drift * this.#time, this.#tileW);
			if (cx > width + 80) continue;
			const cy = c.yFrac * height;
			const col = withAlpha(tone, c.alpha);
			for (const p of c.puffs) out.circle(cx + p.dx, cy + p.dy, p.r, col);
		}
	}
}
