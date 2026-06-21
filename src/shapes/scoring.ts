/**
 * Scoring: moves are primary (fewest wins), time is the tiebreaker. Because par is the exact
 * minimum (see {@link "../shapes/piece.ts"}), a clean solve hits par and earns three stars.
 *
 * @module
 */

import type { ShapesConfig } from "./config.ts";

/** Star rating for a solve. */
export type Stars = 1 | 2 | 3;

/** A finished level's result. */
export interface Score {
	/** Moves taken (rotates + flips + placements + undos + hint penalties). */
	moves: number;
	/** The level's par (minimum possible moves). */
	par: number;
	/** Elapsed solve time in milliseconds. */
	timeMs: number;
	/** 3 = par, 2 = within `par × slack`, 1 = otherwise. */
	stars: Stars;
}

/** Star rating from moves vs par and the 2-star slack factor. */
export function computeStars(moves: number, par: number, slack: number): Stars {
	if (moves <= par) return 3;
	if (moves <= par * slack) return 2;
	return 1;
}

/** Build a {@link Score} for a completed level. */
export function scoreLevel(
	moves: number,
	par: number,
	timeMs: number,
	config: ShapesConfig,
): Score {
	return { moves, par, timeMs, stars: computeStars(moves, par, config.parSlack) };
}
