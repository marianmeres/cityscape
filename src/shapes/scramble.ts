/**
 * Scrambling: pick a starting orientation for each piece. Deterministic from the supplied
 * {@link Rng}. A piece is never handed to the player already solved (when it has any unsolved
 * orientation), so every piece needs at least one move — and a fully-symmetric piece (which always
 * looks solved) simply starts at `0`.
 *
 * @module
 */

import type { Rng } from "../engine/math/rng.ts";
import { type Orientation, ORIENTATION_COUNT } from "./grid.ts";
import type { PieceShape } from "./piece.ts";

/** Options for {@link scramble}. */
export interface ScrambleOptions {
	/** Allow mirrored starting orientations, not just rotations (default `false`). */
	allowFlips?: boolean;
}

/** Choose a starting orientation for each piece (aligned to the input array). */
export function scramble(
	pieces: readonly PieceShape[],
	rng: Rng,
	opts: ScrambleOptions = {},
): Orientation[] {
	const max = opts.allowFlips ? ORIENTATION_COUNT : 4;
	return pieces.map((p) => {
		const candidates: Orientation[] = [];
		for (let o = 0; o < max; o++) {
			if (!p.solving.has(o)) candidates.push(o);
		}
		return candidates.length === 0 ? 0 : rng.pick(candidates);
	});
}
