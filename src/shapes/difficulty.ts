/**
 * The difficulty curve: `level → params`, read from the config so it's tunable as data. Given
 * guided placement, the only real levers are piece count, figure size/aspect, and whether flips are
 * in play — this maps the level number onto all three.
 *
 * @module
 */

import { clamp, lerp } from "../engine/math/ease.ts";
import type { ShapesConfig } from "./config.ts";
import type { Figure } from "./figure.ts";

/** Resolved generation parameters for one level. */
export interface DifficultyParams {
	/** The figure to cut. */
	figure: Figure;
	/** How many pieces to cut it into. */
	pieceCount: number;
	/** Whether the scramble may use mirrors. */
	allowFlips: boolean;
}

/** Resolve the parameters for a 1-based `level` from the config curve. */
export function difficultyParams(level: number, config: ShapesConfig): DifficultyParams {
	const t = clamp((level - 1) / Math.max(1, config.rampLevels - 1), 0, 1);
	const size = lerp(config.startSize, config.maxSize, t);
	const h = Math.max(2, Math.round(size));
	// Rectangles (wider than tall) emerge as difficulty climbs.
	const w = Math.max(2, Math.round(size + t * 2));
	const cap = Math.max(1, Math.floor((w * h) / Math.max(1, config.minPieceCells)));
	const pieceCount = clamp(
		Math.round(lerp(config.startPieces, config.maxPieces, t)),
		1,
		cap,
	);
	// Flips are introduced a few levels in, then only if the config allows them at all.
	const allowFlips = config.allowFlips && level >= 4;
	return { figure: { w, h }, pieceCount, allowFlips };
}
