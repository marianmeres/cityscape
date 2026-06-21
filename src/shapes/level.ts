/**
 * Assembling one playable level from `seed + level number + config`: cut the figure, build the
 * piece shapes, scramble their orientations, and compute par. Fully deterministic.
 *
 * @module
 */

import { createRng } from "../engine/math/rng.ts";
import type { ShapesConfig } from "./config.ts";
import type { Figure } from "./figure.ts";
import type { Orientation } from "./grid.ts";
import { difficultyParams } from "./difficulty.ts";
import { dissect } from "./dissection.ts";
import { makePieceShape, type PieceShape } from "./piece.ts";
import { scramble } from "./scramble.ts";

/** Everything needed to play (and score) one level. */
export interface Level {
	/** 1-based level number. */
	level: number;
	/** The target figure. */
	figure: Figure;
	/** The piece shapes, in stable id order. */
	pieces: PieceShape[];
	/** Scrambled starting orientation per piece (aligned to {@link Level.pieces}). */
	starts: Orientation[];
	/** Minimum moves to solve (Σ pieces of min rotate/flip presses + 1 placement each). */
	par: number;
}

/** Build the `level`-th level for a config (1-based). */
export function buildLevel(config: ShapesConfig, level: number): Level {
	const rng = createRng(config.seed).fork(`level-${level}`);
	const { figure, pieceCount, allowFlips } = difficultyParams(level, config);
	const defs = dissect(figure, pieceCount, rng.fork("cut"), {
		minCells: config.minPieceCells,
	});
	const pieces = defs.map((d, i) => makePieceShape(i, i, d.cells));
	const starts = scramble(pieces, rng.fork("scramble"), { allowFlips });
	let par = 0;
	for (let i = 0; i < pieces.length; i++) par += pieces[i].minOps[starts[i]] + 1;
	return { level, figure, pieces, starts, par };
}
