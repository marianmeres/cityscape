/**
 * Aurora — a faint, slow curtain of light high in the sky.
 *
 * A band of soft vertical light "rays" whose height and brightness wander on value noise and drift
 * sideways over time, evoking an aurora without any heavy machinery. Deliberately subtle and
 * **palette-gated**: it only appears on the cooler, more magical palettes (navy, vaporwave), where a
 * green-cyan or magenta shimmer fits — on ink/dawn it stays hidden. Drawn just in front of the sky
 * backdrop so the stars twinkle over it. Opacity is the live `aurora` knob.
 *
 * Pure and DOM-free.
 *
 * @module
 */

import { type Color, hsl, withAlpha } from "../../engine/math/color.ts";
import { createNoise1D, type Noise1D } from "../../engine/math/noise.ts";
import type { Rng } from "../../engine/math/rng.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { CityEnv } from "../env.ts";

/** Base hue per palette; palettes absent here show no aurora. */
const PALETTE_HUE: Record<string, number> = { navy: 155, vaporwave: 295 };
const RAYS = 20;

/** A drifting curtain of light, gated to the cool palettes. */
export class Aurora implements Entity<CityEnv> {
	readonly depth = 0.015; // just in front of the sky backdrop, behind the stars
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#noise: Noise1D;
	#amount = 0;
	#hue = 155;
	#active = false;
	#time = 0;

	constructor(rng: Rng) {
		this.#noise = createNoise1D((rng.seed ^ 0xa05a) >>> 0, 2);
	}

	update(ctx: UpdateContext<CityEnv>): void {
		const cfg = ctx.env.config;
		this.#amount = cfg.aurora;
		const hue = PALETTE_HUE[cfg.palette];
		this.#active = hue !== undefined && this.#amount > 0.001;
		if (hue !== undefined) this.#hue = hue;
		this.#time = ctx.time;
	}

	draw(ctx: DrawContext): void {
		if (!this.#active) return;
		const { out, width, height } = ctx;
		const bandTop = height * 0.05;
		const bandH = height * 0.3;
		const t = this.#time;
		for (let i = 0; i < RAYS; i++) {
			const fx = (i + 0.5) / RAYS;
			const n = this.#noise.at(fx * 4 + t * 0.00004);
			const drift = Math.sin(t * 0.0002 + i * 1.3) * width * 0.012;
			const x = fx * width + drift;
			const w = (width / RAYS) * 1.4;
			const h = bandH * (0.35 + n * 0.65);
			const top = bandTop + (bandH - h) * this.#noise.at(fx * 7 + 3.1);
			const a = this.#amount * 0.16 * (0.25 + n * 0.75);
			const col: Color = hsl(this.#hue + (fx - 0.5) * 40, 0.7, 0.6);
			out.gradient(x - w / 2, top, w, h, [
				{ at: 0, color: withAlpha(col, 0) },
				{ at: 0.5, color: withAlpha(col, a) },
				{ at: 1, color: withAlpha(col, 0) },
			], true);
		}
	}
}
