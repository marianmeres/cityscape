/**
 * The distant mountain range — two wrapped ridges of peaks far behind the rolling hills.
 *
 * Each ridge is a set of overlapping triangular peaks living in a fixed-width tile; every frame
 * their x wraps against the camera's (small) parallax scroll, so the range is effectively infinite
 * at bounded cost (the same trick the cityscape's starfield uses). The back ridge sits higher,
 * hazier and slower; the front ridge a touch nearer and darker. Peaks above the snowline wear a
 * white cap whose size follows the season's snow. Prominence (and opacity) scale with the
 * `mountains` knob — 0 leaves an open horizon.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { type Color, withAlpha } from "../../engine/math/color.ts";
import { clamp, wrap } from "../../engine/math/ease.ts";
import type { DisplayListBuilder } from "../../engine/render/draw-command.ts";
import type { DrawContext, Entity, UpdateContext } from "../../engine/scene/entity.ts";
import { landColor, snowAt } from "../mood.ts";
import type { Mood } from "../mood.ts";
import type { NatureEnv } from "../env.ts";

interface Peak {
	xFrac: number; // position in the tile, 0..1
	height: number; // fraction of viewport height
	halfWidth: number; // fraction of viewport height
}

interface Ridge {
	depth: number;
	tone: number; // landColor depth used for tint (lower = hazier)
	tileW: number;
	peaks: Peak[];
}

/** A wrapped, parallaxing range of mountains. */
export class MountainRange implements Entity<NatureEnv> {
	readonly depth = 0.1;
	readonly bounds = { x: -Infinity, width: Infinity };
	alive = true;

	#ridges: Ridge[];
	#mood!: Mood;
	#prominence = 0.8;
	#horizon = 0.82;

	constructor(rng: Rng) {
		this.#ridges = [
			makeRidge(rng.fork("back"), {
				depth: 0.07,
				tone: 0.18,
				tileW: 2000,
				count: 5,
				hi: 0.42,
			}),
			makeRidge(rng.fork("front"), {
				depth: 0.15,
				tone: 0.34,
				tileW: 1500,
				count: 6,
				hi: 0.3,
			}),
		];
	}

	update(ctx: UpdateContext<NatureEnv>): void {
		this.#mood = ctx.env.mood;
		this.#prominence = ctx.env.config.mountains;
		this.#horizon = 1 - ctx.env.config.waterLevel - ctx.env.config.bankHeight;
	}

	draw(ctx: DrawContext): void {
		if (this.#prominence <= 0.001) return;
		const { out, width, height } = ctx;
		const mood = this.#mood;
		// Baseline a touch below the horizon so the near hills hide the peaks' feet.
		const baseY = this.#horizon * height + height * 0.04;
		for (const ridge of this.#ridges) {
			const tint = landColor(mood, ridge.tone);
			const snow = snowAt(mood, ridge.tone);
			const scroll = ctx.camera.scroll * ctx.camera.parallaxAt(ridge.depth) *
				ctx.camera.unit;
			for (const pk of ridge.peaks) {
				const baseX = wrap(pk.xFrac * ridge.tileW - scroll, ridge.tileW);
				for (let tx = baseX; tx < width + ridge.tileW; tx += ridge.tileW) {
					if (tx - pk.halfWidth * height > width) continue;
					drawPeak(
						out,
						tx,
						baseY,
						pk,
						height,
						this.#prominence,
						tint,
						snow,
						mood.snow,
					);
				}
			}
		}
	}
}

/** Generate one ridge's peaks. */
function makeRidge(
	rng: Rng,
	o: { depth: number; tone: number; tileW: number; count: number; hi: number },
): Ridge {
	const peaks: Peak[] = [];
	for (let i = 0; i < o.count; i++) {
		peaks.push({
			xFrac: (i + rng.float(-0.3, 0.3)) / o.count,
			height: rng.float(o.hi * 0.55, o.hi),
			halfWidth: rng.float(o.hi * 0.7, o.hi * 1.2),
		});
	}
	return { depth: o.depth, tone: o.tone, tileW: o.tileW, peaks };
}

/** Draw one snow-capped triangular peak rising from `baseY`. */
function drawPeak(
	out: DisplayListBuilder,
	cx: number,
	baseY: number,
	pk: Peak,
	vh: number,
	prominence: number,
	tint: Color,
	snowColor: Color,
	snowAmount: number,
): void {
	const h = pk.height * vh * (0.4 + prominence * 0.6);
	const hw = pk.halfWidth * vh;
	const apexY = baseY - h;
	out.polygon([cx - hw, baseY, cx + hw, baseY, cx, apexY], withAlpha(tint, 0.92));
	// A snow cap on the upper third — bigger with more seasonal snow, always a hint on tall peaks.
	const cap = clamp(0.18 + snowAmount * 0.4, 0.18, 0.55);
	const capHW = hw * cap;
	const capY = apexY + h * cap;
	out.polygon(
		[cx - capHW, capY, cx + capHW, capY, cx, apexY],
		withAlpha(snowColor, 0.5 + snowAmount * 0.45),
	);
}
