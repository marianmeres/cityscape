/**
 * Rare sky crossers: a drifting hot-air balloon, a soaring eagle, or a tumbling leaf.
 *
 * One director schedules at most one crosser at a time, with a cadence that shortens as the live
 * `flyers` knob rises. Each type animates from a single normalised `progress` so there's no
 * particle bookkeeping. These are the quiet "surprise me" delights — sparse and calm by design.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, darken, hsl, mix, rgb, withAlpha } from "../../engine/math/color.ts";
import type { DisplayListBuilder } from "../../engine/render/draw-command.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

type FlyerType = "balloon" | "eagle" | "leaf";

interface Flyer {
	type: FlyerType;
	progress: number;
	speed: number; // per ms
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	hue: number; // balloon envelope hue
}

const BASKET = rgb(96, 66, 42);

/** Schedules and draws the occasional sky crosser. */
export class FlyerDirector implements Entity<NatureEnv> {
	readonly depth = 0.18;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#rng: Rng;
	#timer: number;
	#flyer: Flyer | null = null;
	#time = 0;
	#mood!: Mood;

	constructor(rng: Rng) {
		this.#rng = rng;
		this.#timer = rng.float(6000, 16000);
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
		const chance = ctx.env.config.flyers;

		if (this.#flyer) {
			this.#flyer.progress += this.#flyer.speed * ctx.dt;
			if (this.#flyer.progress > 1) this.#flyer = null;
			return;
		}
		if (chance <= 0) return;
		this.#timer -= ctx.dt * (0.25 + chance);
		if (this.#timer > 0) return;
		this.#timer = this.#rng.float(11000, 28000);
		this.#flyer = this.#spawn();
	}

	#spawn(): Flyer {
		const type = this.#rng.weighted(
			["balloon", "eagle", "leaf"] as FlyerType[],
			[2, 3, 2],
		);
		const dir = this.#rng.bool() ? 1 : -1;
		const x0 = dir > 0 ? -0.06 : 1.06;
		const x1 = dir > 0 ? 1.06 : -0.06;
		if (type === "leaf") {
			const sx = this.#rng.float(0.1, 0.9);
			return {
				type,
				progress: 0,
				speed: this.#rng.float(0.00012, 0.0002),
				x0: sx,
				y0: this.#rng.float(0.1, 0.3),
				x1: sx + this.#rng.float(-0.2, 0.2),
				y1: this.#rng.float(0.55, 0.75),
				hue: 0,
			};
		}
		const y = this.#rng.float(0.1, type === "balloon" ? 0.34 : 0.4);
		const speed = type === "balloon"
			? this.#rng.float(0.00004, 0.00008) // slow, stately
			: this.#rng.float(0.0001, 0.00018);
		return {
			type,
			progress: 0,
			speed,
			x0,
			y0: y,
			x1,
			y1: y + this.#rng.float(-0.04, 0.04),
			hue: this.#rng.float(0, 360),
		};
	}

	draw(ctx: DrawContext): void {
		const f = this.#flyer;
		if (!f) return;
		const { out, width, height } = ctx;
		const t = f.progress;
		const x = (f.x0 + (f.x1 - f.x0) * t) * width;
		const y = (f.y0 + (f.y1 - f.y0) * t) * height;
		const ref = Math.min(width, height);

		if (f.type === "balloon") {
			const bob = Math.sin(this.#time * 0.0009) * ref * 0.006;
			drawBalloon(out, x, y + bob, ref * 0.05, f.hue);
			return;
		}
		if (f.type === "eagle") {
			const glide = Math.sin(this.#time * 0.0016) * ref * 0.012;
			drawEagle(
				out,
				x,
				y + glide,
				ref * 0.022,
				this.#time,
				darken(this.#mood.landNear, 0.05),
			);
			return;
		}
		// leaf: a small tumbling leaf swaying as it falls
		const sway = Math.sin(t * 24 + this.#time * 0.004) * width * 0.02;
		const leaf = mix(this.#mood.bloom, this.#mood.foliage, 0.4);
		drawLeaf(out, x + sway, y, ref * 0.012, this.#time, leaf);
	}
}

function drawBalloon(
	out: DisplayListBuilder,
	x: number,
	y: number,
	r: number,
	hue: number,
): void {
	const envelope = hsl(hue, 0.55, 0.6);
	const stripe = hsl((hue + 30) % 360, 0.6, 0.66);
	// Envelope: a round top tapering to the burner.
	out.circle(x, y, r, envelope);
	out.circle(x - r * 0.5, y + r * 0.1, r * 0.7, stripe);
	out.circle(x + r * 0.5, y + r * 0.1, r * 0.7, stripe);
	out.circle(x, y, r * 0.62, envelope);
	// Taper to the basket.
	out.polygon([
		x - r * 0.5,
		y + r * 0.7,
		x + r * 0.5,
		y + r * 0.7,
		x + r * 0.18,
		y + r * 1.5,
		x - r * 0.18,
		y + r * 1.5,
	], envelope);
	// Lines + basket.
	out.line(
		x - r * 0.3,
		y + r * 1.5,
		x - r * 0.15,
		y + r * 1.9,
		Math.max(1, r * 0.05),
		BASKET,
	);
	out.line(
		x + r * 0.3,
		y + r * 1.5,
		x + r * 0.15,
		y + r * 1.9,
		Math.max(1, r * 0.05),
		BASKET,
	);
	out.rect(x - r * 0.22, y + r * 1.9, r * 0.44, r * 0.4, BASKET);
}

function drawEagle(
	out: DisplayListBuilder,
	x: number,
	y: number,
	size: number,
	time: number,
	color: Color,
): void {
	// Broad wings with a very slow flap; mostly gliding.
	const flap = Math.sin(time * 0.004) * 0.5;
	const lift = (0.5 + flap) * size;
	const w = Math.max(1, size * 0.3);
	out.line(x - size * 1.6, y + lift, x, y, w, color);
	out.line(x, y, x + size * 1.6, y + lift, w, color);
	// A small body + head.
	out.circle(x, y + size * 0.1, size * 0.26, color);
}

function drawLeaf(
	out: DisplayListBuilder,
	x: number,
	y: number,
	size: number,
	time: number,
	color: Color,
): void {
	// A tumbling leaf: a tiny pinched quad that "rotates" by squashing horizontally over time.
	const squash = Math.abs(Math.cos(time * 0.006));
	const w = Math.max(1, size * (0.3 + squash));
	out.polygon([x - w, y, x, y - size, x + w, y, x, y + size], withAlpha(color, 0.95));
}
