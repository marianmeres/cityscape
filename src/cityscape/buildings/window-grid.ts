/**
 * The window-occupancy model — what makes the city feel alive without distracting.
 *
 * Each building owns a grid of windows, each lit or dark. Rather than per-cell timers (costly
 * across hundreds of buildings), one calm countdown flips a single random cell when it fires,
 * setting it lit with probability `windowLightChance`. That does double duty: it animates the
 * city *and* makes the lit fraction drift toward the live target when you move the panel slider.
 * The countdown scales inversely with `windowToggleRate`, so "Flicker = 0" means a still city.
 *
 * Pure and DOM-free: drawing emits {@link DrawCommand}s; toggling consumes an injected {@link Rng}.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import {
	type Color,
	fadeAlpha,
	hsl,
	mix,
	rgb,
	withAlpha,
} from "../../engine/math/color.ts";
import type { DisplayListBuilder } from "../../engine/render/draw-command.ts";
import type { CityscapeConfig } from "../config.ts";

// Per-window tint endpoints: some windows read warmer (incandescent), some cooler (fluorescent).
const WARM_TINT = rgb(255, 196, 120);
const COOL_TINT = rgb(196, 220, 255);

/** Stable pseudo-random in [0,1) from an integer — gives each window a fixed character. */
function cellHash(n: number): number {
	const x = Math.sin(n * 12.9898) * 43758.5453;
	return x - Math.floor(x);
}

/** Geometry + lit-state of a building's windows. */
export class WindowGrid {
	readonly cols: number;
	readonly rows: number;
	/** Lit flags, row-major, `0|1`. */
	readonly lit: Uint8Array;

	/** Inset of the grid from the building edges, as a fraction of building size. */
	#padX: number;
	#padY: number;
	/** Window cell fill ratio (rest is gap). */
	#fill: number;
	#toggle = 0;
	/** Per-building offset so two buildings don't share the same window-variation pattern. */
	#salt = 0;
	/** A stable always-lit "office working late" row (`-1` = none). */
	#litFloor = -1;
	/** A stable always-on illuminated sign cell (`-1` = none) and its hue. */
	#signIdx = -1;
	#signHue = 0;

	constructor(cols: number, rows: number, opts: {
		padX?: number;
		padY?: number;
		fill?: number;
	} = {}) {
		this.cols = Math.max(0, Math.floor(cols));
		this.rows = Math.max(0, Math.floor(rows));
		this.lit = new Uint8Array(this.cols * this.rows);
		this.#padX = opts.padX ?? 0.14;
		this.#padY = opts.padY ?? 0.08;
		this.#fill = opts.fill ?? 0.62;
	}

	/** Seed the initial lit pattern from the target fraction. */
	seed(rng: Rng, litChance: number): void {
		for (let i = 0; i < this.lit.length; i++) {
			this.lit[i] = rng.next() < litChance ? 1 : 0;
		}
		this.#toggle = rng.float(400, 2600);
		this.#salt = Math.floor(rng.next() * 9973);
		// Stable "character" overlays, drawn on top of the occupancy model so the calm toggling and
		// the lit-fraction target stay untouched: a rare fully-lit floor (an office working late)
		// and a rare always-on illuminated sign in a saturated hue.
		this.#litFloor = this.rows >= 4 && rng.next() < 0.2
			? rng.int(1, this.rows - 2)
			: -1;
		if (this.cols > 0 && this.rows > 0 && rng.next() < 0.12) {
			const col = rng.int(0, this.cols - 1);
			const row = rng.int(0, Math.max(0, Math.ceil(this.rows / 2) - 1));
			this.#signIdx = row * this.cols + col;
			this.#signHue = rng.float(0, 360);
		} else {
			this.#signIdx = -1;
		}
	}

	/** Advance the calm toggling. `dt` ms; uses the building's own `rng` for determinism. */
	update(dt: number, rng: Rng, config: CityscapeConfig): void {
		if (this.lit.length === 0 || config.windowToggleRate <= 0) return;
		this.#toggle -= dt * config.windowToggleRate;
		if (this.#toggle > 0) return;
		// Reschedule (slower when the rate is low) and flip one cell toward the target.
		this.#toggle = rng.float(500, 3200);
		const i = rng.int(0, this.lit.length - 1);
		this.lit[i] = rng.next() < config.windowLightChance ? 1 : 0;
	}

	/**
	 * Draw lit windows inside the building's *screen* rect. Each window gets a stable per-cell
	 * tint and brightness around `color` (so the grid never looks uniform), plus a soft halo on
	 * nearer layers (skipped when `depth` is small to keep distant lights crisp and cheap).
	 */
	draw(
		out: DisplayListBuilder,
		x: number,
		y: number,
		w: number,
		h: number,
		color: Color,
		depth: number,
	): void {
		if (this.lit.length === 0 || w <= 0 || h <= 0) return;
		const ix = x + w * this.#padX;
		const iy = y + h * this.#padY;
		const iw = w * (1 - this.#padX * 2);
		const ih = h * (1 - this.#padY * 2);
		const cellW = iw / this.cols;
		const cellH = ih / this.rows;
		const winW = Math.max(0.6, cellW * this.#fill);
		const winH = Math.max(0.6, cellH * this.#fill);
		const offX = (cellW - winW) / 2;
		const offY = (cellH - winH) / 2;
		const glow = depth > 0.55 && winW > 1.4;
		const detail = winW > 1.6; // signs/blinds only read once cells are big enough
		// How far an individual window may stray in tint from the mood's window colour.
		const tintRange = 0.28;

		for (let r = 0; r < this.rows; r++) {
			for (let c = 0; c < this.cols; c++) {
				const idx = r * this.cols + c;
				const isSign = idx === this.#signIdx;
				// Lit if occupied, on the always-lit floor, or the always-on sign.
				if (this.lit[idx] === 0 && r !== this.#litFloor && !isSign) continue;
				const wx = ix + c * cellW + offX;
				let wy = iy + r * cellH + offY;
				let wh = winH;

				let cell: Color;
				if (isSign && detail) {
					// A saturated, always-on illuminated sign.
					cell = withAlpha(hsl(this.#signHue, 0.55, 0.62), color.a);
				} else {
					// Stable per-window character: a tint toward warm/cool and a brightness.
					const hTint = cellHash(idx + this.#salt);
					const hBright = cellHash(idx * 2 + this.#salt + 7);
					let toward = hTint < 0.5 ? WARM_TINT : COOL_TINT;
					let amt = Math.abs(hTint - 0.5) * 2 * tintRange;
					let bright = 0.6 + hBright * 0.4;
					// Penthouse: the top floors of a tall grid read warmer and a touch brighter.
					if (this.rows >= 4 && r <= 1) {
						toward = WARM_TINT;
						amt = Math.max(amt, tintRange * 0.8);
						bright = Math.min(1, bright + 0.15);
					}
					cell = withAlpha(mix(color, toward, amt), color.a * bright);
					// Blinds: some windows are half-shuttered (a lit strip at the bottom).
					if (detail && cellHash(idx * 3 + this.#salt + 11) < 0.22) {
						wh = winH * 0.55;
						wy += winH - wh;
					}
				}

				if (glow) {
					out.glow(
						wx + winW / 2,
						wy + wh / 2,
						winW * 1.7,
						fadeAlpha(cell, 0.45),
						0.55,
					);
				}
				out.rect(wx, wy, winW, wh, cell);
			}
		}
	}
}
