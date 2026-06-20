/**
 * Occasional bird flocks — a small V of silhouettes crossing the sky now and then, wings flapping
 * (a stateless function of the clock). A director holds a countdown whose interval shortens with
 * the live `birdChance` knob; when it fires it launches one flock that crosses and then idles.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, darken, withAlpha } from "../../engine/math/color.ts";
import { clamp } from "../../engine/math/ease.ts";
import type { DisplayListBuilder } from "../../engine/render/draw-command.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

interface Flock {
	yFrac: number;
	dir: number; // +1 →, -1 ←
	speed: number; // fraction of width per ms
	progress: number; // 0..~1.2
	size: number;
	count: number;
}

/** Launches and animates sparse bird flocks. */
export class BirdDirector implements Entity<CityEnv> {
	readonly depth = 0.5;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#rng: Rng;
	#timer: number;
	#flock: Flock | null = null;
	#time = 0;
	#mood!: Mood;

	constructor(rng: Rng) {
		this.#rng = rng;
		this.#timer = rng.float(3000, 12000);
	}

	update(ctx: UpdateContext<CityEnv>): void {
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
		const chance = ctx.env.config.birdChance;

		if (this.#flock) {
			this.#flock.progress += this.#flock.speed * ctx.dt;
			if (this.#flock.progress > 1.2) this.#flock = null;
			return;
		}
		if (chance <= 0) return;
		this.#timer -= ctx.dt * (0.3 + chance);
		if (this.#timer > 0) return;
		this.#timer = this.#rng.float(6000, 20000);
		const dir = this.#rng.bool() ? 1 : -1;
		this.#flock = {
			yFrac: this.#rng.float(0.18, 0.5),
			dir,
			speed: this.#rng.float(0.00018, 0.0003),
			progress: 0,
			size: this.#rng.float(5, 9),
			count: this.#rng.int(3, 7),
		};
	}

	draw(ctx: DrawContext): void {
		const f = this.#flock;
		if (!f) return;
		const { out, width, height } = ctx;
		const color = withAlpha(darken(this.#mood.buildingNear, 0.1), 0.8);
		const flap = Math.sin(this.#time * 0.012);
		const headX = f.dir > 0
			? f.progress * (width + 200) - 100
			: width + 100 - f.progress * (width + 200);
		for (let i = 0; i < f.count; i++) {
			// V formation: each bird trails back and down from the leader.
			const off = i * f.size * 2.4;
			const bx = headX - f.dir * off;
			const by = f.yFrac * height + Math.abs(i - (f.count - 1) / 2) * f.size * 0.9;
			drawBird(out, bx, by, f.size, flap, color);
		}
	}
}

function drawBird(
	out: DisplayListBuilder,
	x: number,
	y: number,
	size: number,
	flap: number,
	color: Color,
): void {
	const wing = clamp(0.4 + flap * 0.5, 0.1, 0.9) * size;
	out.line(x - size, y + wing, x, y, Math.max(1, size * 0.18), color);
	out.line(x, y, x + size, y + wing, Math.max(1, size * 0.18), color);
}
