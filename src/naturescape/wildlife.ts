/**
 * Wildlife — the valley's quiet signs of life: deer grazing the far bank, fish rising in the
 * water, and butterflies bobbing over the meadow.
 *
 * One director manages all three from simple countdowns whose cadence scales with the live
 * `wildlife` knob. A deer is anchored to a world-x on the near band and projected at that depth, so
 * it scrolls naturally with the land (the same parallax trick the meadow's tufts use); fish ripples
 * are stateless expanding rings on the water; butterflies trace looping paths near the foreground.
 * Deterministic from its {@link Rng}; pure and DOM-free.
 *
 * @module
 */

import type { Rng } from "../engine/math/rng.ts";
import { type Color, darken, hsl, mix, withAlpha } from "../engine/math/color.ts";
import { clamp } from "../engine/math/ease.ts";
import type { DisplayListBuilder } from "../engine/render/draw-command.ts";
import type { DrawContext, Entity, UpdateContext } from "../engine/scene/entity.ts";
import type { Mood } from "./mood.ts";
import type { NatureEnv } from "./env.ts";

/** Parallax depth a grazing deer scrolls at (matches the near land band). */
const DEER_DEPTH = 0.9;

interface Deer {
	localX: number;
	age: number; // ms alive (drives fade-in)
	stag: boolean;
	grazePhase: number;
}

interface Ripple {
	xFrac: number;
	yFrac: number; // within the water band
	age: number; // 0..1
	active: boolean;
}

interface Butterfly {
	t: number; // path param
	xFrac: number;
	yFrac: number;
	speed: number;
	hue: number;
	active: boolean;
}

/** Spawns and draws sparse wildlife across the scene. */
export class WildlifeDirector implements Entity<NatureEnv> {
	readonly depth = 1.06; // front-most, after the meadow
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#rng: Rng;
	#deer: Deer | null = null;
	#deerTimer: number;
	#ripples: Ripple[];
	#rippleTimer: number;
	#butterflies: Butterfly[];
	#bflyTimer = 0;
	#time = 0;
	#mood!: Mood;
	#water = 0.16;
	#bank = 0.02;
	#wildlife = 0.6;

	constructor(rng: Rng) {
		this.#rng = rng;
		this.#deerTimer = rng.float(2000, 8000);
		this.#rippleTimer = rng.float(1500, 5000);
		this.#ripples = Array.from({ length: 6 }, () => ({
			xFrac: 0,
			yFrac: 0,
			age: 0,
			active: false,
		}));
		this.#butterflies = Array.from({ length: 3 }, () => ({
			t: 0,
			xFrac: 0,
			yFrac: 0,
			speed: 0,
			hue: 0,
			active: false,
		}));
	}

	/**
	 * Light interaction: drop a ripple on the water at a fraction of the width / water band (used by
	 * `scene.poke`). No-op if there's no water or every ripple slot is busy.
	 */
	splash(xFrac: number, yFrac: number): void {
		const slot = this.#ripples.find((r) => !r.active);
		if (!slot) return;
		slot.xFrac = clamp(xFrac, 0, 1);
		slot.yFrac = clamp(yFrac, 0, 1);
		slot.age = 0;
		slot.active = true;
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#time = ctx.time;
		this.#mood = ctx.env.mood;
		const cfg = ctx.env.config;
		this.#water = cfg.waterLevel;
		this.#bank = cfg.bankHeight;
		this.#wildlife = cfg.wildlife;
		const dt = ctx.dt;

		this.#updateDeer(dt);
		this.#updateRipples(dt);
		this.#updateButterflies(dt);
	}

	#updateDeer(dt: number): void {
		if (this.#deer) {
			this.#deer.age += dt;
			this.#deer.grazePhase += dt * 0.001;
			return;
		}
		if (this.#wildlife <= 0) return;
		this.#deerTimer -= dt * (0.3 + this.#wildlife);
		if (this.#deerTimer > 0) return;
		this.#deerTimer = this.#rng.float(9000, 24000);
		this.#deer = {
			localX: 0, // resolved at draw time against the live camera
			age: 0,
			stag: this.#rng.bool(0.5),
			grazePhase: this.#rng.float(0, 6.283),
		};
		this.#deerSpawnX = null;
	}

	// The deer's world-x, lazily fixed on first draw so it lands just inside the leading edge.
	#deerSpawnX: number | null = null;

	#updateRipples(dt: number): void {
		for (const r of this.#ripples) {
			if (r.active) {
				r.age += dt * 0.0009;
				if (r.age >= 1) r.active = false;
			}
		}
		if (this.#water <= 0.001 || this.#wildlife <= 0) return;
		this.#rippleTimer -= dt * (0.3 + this.#wildlife);
		if (this.#rippleTimer > 0) return;
		this.#rippleTimer = this.#rng.float(2500, 7000);
		const slot = this.#ripples.find((r) => !r.active);
		if (slot) {
			slot.xFrac = this.#rng.float(0.05, 0.95);
			slot.yFrac = this.#rng.float(0.1, 0.7);
			slot.age = 0;
			slot.active = true;
		}
	}

	#updateButterflies(dt: number): void {
		// Butterflies only in the warmer, snow-free seasons.
		const want = this.#mood.snow < 0.4 && this.#wildlife > 0
			? Math.round(this.#wildlife * 2)
			: 0;
		let live = 0;
		for (const b of this.#butterflies) {
			if (!b.active) continue;
			b.t += dt * b.speed;
			if (b.t > 1) b.active = false;
			else live++;
		}
		if (live >= want) return;
		this.#bflyTimer -= dt;
		if (this.#bflyTimer > 0) return;
		this.#bflyTimer = this.#rng.float(1500, 5000);
		const slot = this.#butterflies.find((b) => !b.active);
		if (slot) {
			slot.active = true;
			slot.t = 0;
			slot.xFrac = this.#rng.float(0.1, 0.9);
			slot.yFrac = this.#rng.float(0.55, 0.78);
			slot.speed = this.#rng.float(0.00006, 0.00012);
			slot.hue = this.#rng.float(0, 360);
		}
	}

	draw(ctx: DrawContext): void {
		const { out, width, height } = ctx;
		const mood = this.#mood;
		const waterY = (1 - this.#water) * height;
		const bankTopY = waterY - this.#bank * height;

		// ── Deer on the bank ──────────────────────────────────────────────
		if (this.#deer) {
			const cam = ctx.camera;
			if (this.#deerSpawnX === null) {
				// Fix the deer just inside the leading edge for the current scroll direction.
				const enterRight = cam.speed >= 0;
				this.#deerSpawnX = enterRight
					? cam.viewRight(DEER_DEPTH) + 0.05
					: cam.viewLeft(DEER_DEPTH) - 0.05;
				this.#deer.localX = this.#deerSpawnX;
			}
			const sx = cam.project(this.#deer.localX, DEER_DEPTH);
			const size = height * 0.05 * (0.8 + cam.zoom * 0.2);
			if (sx < -size * 4 || sx > width + size * 4) {
				this.#deer = null; // scrolled fully away — retire it
			} else {
				const fade = clamp(this.#deer.age * 0.001, 0, 1);
				const col = withAlpha(darken(mood.landNear, 0.15), 0.85 * fade);
				drawDeer(out, sx, bankTopY, size, this.#deer, col);
			}
		}

		// ── Fish ripples on the water ─────────────────────────────────────
		if (this.#water > 0.001) {
			const waterH = height - waterY;
			const ring = mix(mood.snowColor, mood.water, 0.4);
			for (const r of this.#ripples) {
				if (!r.active) continue;
				const x = r.xFrac * width;
				const y = waterY + r.yFrac * waterH;
				const rad = r.age * Math.min(width, height) * 0.05;
				const a = (1 - r.age) * 0.4;
				out.line(x - rad, y, x + rad, y, 1, withAlpha(ring, a));
				out.line(
					x - rad * 0.6,
					y + rad * 0.18,
					x + rad * 0.6,
					y + rad * 0.18,
					1,
					withAlpha(ring, a * 0.6),
				);
			}
		}

		// ── Butterflies over the meadow ───────────────────────────────────
		for (const b of this.#butterflies) {
			if (!b.active) continue;
			const x = (b.xFrac + Math.sin(b.t * 18) * 0.04) * width;
			const y = (b.yFrac + Math.sin(b.t * 30) * 0.03) * height;
			const fade = Math.sin(Math.min(1, b.t) * Math.PI);
			drawButterfly(out, x, y, height * 0.012, this.#time, b.hue, fade, mood);
		}
	}
}

/** A small standing deer (or antlered stag) silhouette. */
function drawDeer(
	out: DisplayListBuilder,
	x: number,
	groundY: number,
	size: number,
	deer: Deer,
	col: Color,
): void {
	const bodyW = size * 1.5;
	const bodyH = size * 0.7;
	const bodyY = groundY - size * 1.05;
	// Body: two circles + a connecting bar.
	out.rect(x - bodyW / 2, bodyY, bodyW, bodyH, col);
	out.circle(x - bodyW / 2, bodyY + bodyH / 2, bodyH / 2, col);
	out.circle(x + bodyW / 2, bodyY + bodyH / 2, bodyH / 2, col);
	// Legs.
	const legW = Math.max(1, size * 0.12);
	for (const lx of [-0.42, -0.2, 0.2, 0.42]) {
		out.rect(
			x + bodyW * lx,
			bodyY + bodyH * 0.6,
			legW,
			size * 1.05 - bodyH * 0.6,
			col,
		);
	}
	// Neck + head — dips while grazing.
	const graze = (Math.sin(deer.grazePhase) * 0.5 + 0.5) * size * 0.5;
	const neckTopX = x + bodyW * 0.5;
	const headX = neckTopX + size * 0.5;
	const headY = bodyY - size * 0.4 + graze;
	out.line(neckTopX, bodyY + bodyH * 0.2, headX, headY, Math.max(1, size * 0.18), col);
	out.circle(headX, headY, size * 0.22, col);
	if (deer.stag) {
		// A pair of simple branched antlers.
		out.line(
			headX,
			headY - size * 0.1,
			headX - size * 0.18,
			headY - size * 0.5,
			Math.max(1, size * 0.08),
			col,
		);
		out.line(
			headX,
			headY - size * 0.1,
			headX + size * 0.18,
			headY - size * 0.5,
			Math.max(1, size * 0.08),
			col,
		);
		out.line(
			headX - size * 0.1,
			headY - size * 0.3,
			headX - size * 0.3,
			headY - size * 0.42,
			Math.max(1, size * 0.06),
			col,
		);
	}
}

/** A tiny fluttering butterfly: two wings opening and closing on the clock. */
function drawButterfly(
	out: DisplayListBuilder,
	x: number,
	y: number,
	size: number,
	time: number,
	hue: number,
	fade: number,
	mood: Mood,
): void {
	const open = (Math.sin(time * 0.02) * 0.5 + 0.5) * size + size * 0.3;
	// A bright wing keyed to the butterfly's own hue, warmed slightly toward the bloom colour.
	const wing = withAlpha(mix(hsl(hue, 0.7, 0.62), mood.bloom, 0.3), 0.85 * fade);
	out.circle(x - open * 0.5, y, size * 0.7, wing);
	out.circle(x + open * 0.5, y, size * 0.7, wing);
	out.line(
		x,
		y - size * 0.5,
		x,
		y + size * 0.5,
		Math.max(1, size * 0.3),
		withAlpha(darken(wing, 0.5), fade),
	);
}
