/**
 * Foreground traffic — sparse head/tail-light streaks gliding along the lit waterfront embankment.
 *
 * The chosen "sign of life" (over literal cars/people, which break the calm at skyline zoom): a few
 * warm headlights and red taillights crossing the shore band, each a single-`progress` screen-space
 * crosser (no per-vehicle bookkeeping beyond a small bounded pool), in the spirit of the
 * {@link ../sky/flyer.ts | FlyerDirector}. They ride the same embankment the streetlamps light
 * ({@link ../sky/shore.ts}) and cast the same wavy reflection onto the water. Gated by the live
 * `trafficChance` knob, and present only when there is a shore to drive on.
 *
 * Pure and DOM-free: scheduling consumes an injected {@link Rng}; drawing emits {@link DrawCommand}s.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { rgb, withAlpha } from "../../engine/math/color.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import type { CityEnv } from "../env.ts";

/** Warm (incandescent/halogen) and cool (xenon) headlight tints, and the red taillight. */
const HEAD_WARM = rgb(255, 214, 150);
const HEAD_COOL = rgb(206, 224, 255);
const TAIL = rgb(255, 72, 60);
const MAX_VEHICLES = 6;

interface Vehicle {
	progress: number; // 0..1 across the screen
	speed: number; // per ms
	dir: number; // +1 → right, -1 → left
	yJit: number; // -1..1 lane offset within the band
	size: number;
	warm: boolean;
}

/** Schedules and draws the occasional headlight/taillight crossing the waterfront. */
export class TrafficDirector implements Entity<CityEnv> {
	readonly depth = 1.12; // in front of the shore (1.1) so its reflection sits on the water
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#rng: Rng;
	#vehicles: Vehicle[] = [];
	#timer: number;
	#time = 0;
	#water = 0.33;
	#shore = 0.025;

	constructor(rng: Rng) {
		this.#rng = rng;
		this.#timer = rng.float(1500, 5000);
	}

	update(ctx: UpdateContext<CityEnv>): void {
		this.#time = ctx.time;
		this.#water = ctx.env.config.waterLevel;
		this.#shore = ctx.env.config.shoreHeight;
		const chance = ctx.env.config.trafficChance;

		// Advance and retire (order-preserving in-place compaction — no per-frame allocation).
		if (this.#vehicles.length > 0) {
			let w = 0;
			for (const v of this.#vehicles) {
				v.progress += v.speed * ctx.dt;
				if (v.progress <= 1) this.#vehicles[w++] = v;
			}
			this.#vehicles.length = w;
		}

		// Spawn only when there is a road (a shore) and the knob allows it.
		if (this.#shore <= 0.001 || chance <= 0) return;
		this.#timer -= ctx.dt * (0.2 + chance);
		if (this.#timer > 0) return;
		this.#timer = this.#rng.float(1400, 4200) / (0.3 + chance);
		if (this.#vehicles.length < MAX_VEHICLES) this.#vehicles.push(this.#spawn());
	}

	#spawn(): Vehicle {
		return {
			progress: 0,
			speed: this.#rng.float(0.00009, 0.0002),
			dir: this.#rng.bool() ? 1 : -1,
			yJit: this.#rng.float(-1, 1),
			size: this.#rng.float(0.85, 1.35),
			warm: this.#rng.bool(0.72),
		};
	}

	draw(ctx: DrawContext): void {
		if (this.#vehicles.length === 0 || this.#shore <= 0.001) return;
		const { out, width, height } = ctx;
		const waterY = (1 - this.#water) * height;
		const bandH = this.#shore * height;
		const roadY = waterY - bandH * 0.45; // a little above the waterline, on the embankment
		const carH = Math.max(1.2, bandH * 0.4);
		const waterH = height - waterY;

		for (const v of this.#vehicles) {
			const sx = (v.dir > 0 ? -0.05 + v.progress * 1.1 : 1.05 - v.progress * 1.1) *
				width;
			const y = roadY + v.yJit * bandH * 0.22;
			const s = carH * v.size;
			const head = v.warm ? HEAD_WARM : HEAD_COOL;
			const headX = sx + v.dir * s * 0.7;
			const tailX = sx - v.dir * s * 0.7;

			// Headlight (a soft additive bloom + a crisp point) leading, red taillight trailing.
			out.glow(headX, y, s * 2.4, withAlpha(head, 0.5), 0.9);
			out.circle(headX, y, s * 0.5, head);
			out.circle(tailX, y, s * 0.42, TAIL);

			// A short wavy smear of the headlight reflected down onto the water.
			if (waterH > 0) {
				const wob = Math.sin(this.#time * 0.0012 + sx * 0.05) * s * 0.7;
				out.gradient(headX - s * 0.6 + wob, waterY, s * 1.2, waterH * 0.5, [
					{ at: 0, color: withAlpha(head, 0.22) },
					{ at: 1, color: withAlpha(head, 0) },
				], true);
			}
		}
	}
}
