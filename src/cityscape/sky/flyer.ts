/**
 * Rare sky crossers: a blinking airliner, a steady satellite, or a quick shooting star.
 *
 * One director schedules at most one crosser at a time, with a cadence that shortens as the live
 * `flyerChance` knob rises. Each type animates from a single normalised `progress` so there's no
 * particle bookkeeping. These are the "surprise me" delights — sparse and quiet by design.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, rgb, withAlpha } from "../../engine/math/color.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { Mood } from "../mood.ts";
import type { CityEnv } from "../env.ts";

type FlyerType = "plane" | "satellite" | "shooting-star" | "airship";

interface Flyer {
	type: FlyerType;
	progress: number;
	speed: number; // per ms
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

const NAV_RED = rgb(255, 80, 70);
const NAV_GREEN = rgb(90, 255, 120);
const BLIMP = rgb(40, 46, 62); // dark silhouette against the night sky
const GONDOLA = rgb(255, 200, 130); // warm underside light

/** Schedules and draws the occasional sky crosser. */
export class FlyerDirector implements Entity<CityEnv> {
	readonly depth = 0.06;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#rng: Rng;
	#timer: number;
	#flyer: Flyer | null = null;
	#time = 0;
	#mood!: Mood;

	constructor(rng: Rng) {
		this.#rng = rng;
		this.#timer = rng.float(8000, 20000);
	}

	update(ctx: UpdateContext<CityEnv>): void {
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
		const chance = ctx.env.config.flyerChance;

		if (this.#flyer) {
			this.#flyer.progress += this.#flyer.speed * ctx.dt;
			if (this.#flyer.progress > 1) this.#flyer = null;
			return;
		}
		if (chance <= 0) return;
		this.#timer -= ctx.dt * (0.25 + chance);
		if (this.#timer > 0) return;
		this.#timer = this.#rng.float(12000, 32000);
		this.#flyer = this.#spawn();
	}

	#spawn(): Flyer {
		const type = this.#rng.weighted(
			["plane", "satellite", "shooting-star", "airship"] as FlyerType[],
			[3, 2, 2, 1],
		);
		const dir = this.#rng.bool() ? 1 : -1;
		const x0 = dir > 0 ? -0.05 : 1.05;
		const x1 = dir > 0 ? 1.05 : -0.05;
		if (type === "shooting-star") {
			const sx = this.#rng.float(0.1, 0.9);
			return {
				type,
				progress: 0,
				speed: this.#rng.float(0.0014, 0.0022),
				x0: sx,
				y0: this.#rng.float(0.05, 0.2),
				x1: sx + this.#rng.float(-0.25, 0.25),
				y1: this.#rng.float(0.35, 0.55),
			};
		}
		const y = this.#rng.float(
			0.08,
			type === "plane" ? 0.3 : type === "airship" ? 0.34 : 0.22,
		);
		const speed = type === "plane"
			? this.#rng.float(0.00012, 0.0002)
			: type === "airship"
			? this.#rng.float(0.00003, 0.00006) // a slow, stately drift
			: this.#rng.float(0.00008, 0.00014);
		return {
			type,
			progress: 0,
			speed,
			x0,
			y0: y,
			x1,
			y1: y + this.#rng.float(-0.03, 0.03),
		};
	}

	draw(ctx: DrawContext): void {
		const f = this.#flyer;
		if (!f) return;
		const { out, width, height } = ctx;
		const t = f.progress;
		const x = (f.x0 + (f.x1 - f.x0) * t) * width;
		const y = (f.y0 + (f.y1 - f.y0) * t) * height;
		const star: Color = this.#mood.star;

		if (f.type === "shooting-star") {
			const tailLen = 26 + 40 * Math.sin(Math.min(1, t) * Math.PI);
			const dx = (f.x1 - f.x0) * width;
			const dy = (f.y1 - f.y0) * height;
			const len = Math.hypot(dx, dy) || 1;
			const tx = x - (dx / len) * tailLen;
			const ty = y - (dy / len) * tailLen;
			const a = Math.sin(Math.min(1, t) * Math.PI);
			out.line(tx, ty, x, y, 2, withAlpha(star, 0.5 * a));
			out.circle(x, y, 1.8, withAlpha(star, a));
			return;
		}
		if (f.type === "satellite") {
			const blink = 0.55 + 0.45 * Math.sin(this.#time * 0.006);
			out.circle(x, y, 1.4, withAlpha(star, blink));
			return;
		}
		if (f.type === "airship") {
			const len = Math.max(8, width * 0.04);
			const bh = len * 0.42;
			// Elongated dark body from a few tapering discs.
			for (let i = -2; i <= 2; i++) {
				const br = bh * (1 - Math.abs(i) * 0.16);
				out.circle(x + i * len * 0.2, y, br, BLIMP);
			}
			// A tail fin, and a faint warm gondola light that blinks slowly underneath.
			const dir = f.x1 >= f.x0 ? 1 : -1;
			out.circle(x - dir * len * 0.52, y - bh * 0.45, bh * 0.5, BLIMP);
			const blink = 0.5 + 0.5 * Math.sin(this.#time * 0.004);
			out.glow(x, y + bh * 0.6, bh * 1.6, withAlpha(GONDOLA, 0.4 * blink), 0.7);
			out.circle(x, y + bh * 0.7, 1.2, withAlpha(GONDOLA, blink));
			return;
		}
		// plane: faint body + blinking red/green nav lights
		out.circle(x, y, 1.6, withAlpha(star, 0.5));
		const on = (this.#time % 1100) < 320;
		if (on) {
			out.circle(x - 4, y, 1.4, NAV_RED);
			out.circle(x + 4, y, 1.4, NAV_GREEN);
		}
	}
}
