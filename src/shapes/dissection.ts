/**
 * Cutting a {@link Figure} into connected polyomino pieces — deterministic seeded region-growing.
 *
 * `pieceCount` seed cells are scattered, then the regions grow outward one cell at a time (smallest
 * regions grown first so they stay balanced and meet a minimum size) until every cell of the figure
 * is claimed. Because the figure is a solid rectangle (4-connected), growth always covers it, and
 * every region is connected by construction. Any region that still falls below `minCells` (it got
 * boxed in early) is merged into an adjacent region, so the result is a clean partition of pieces
 * that each tile back into the figure exactly.
 *
 * Pure: all randomness comes from the supplied {@link Rng}, so a seed reproduces the exact cut.
 *
 * @module
 */

import type { Rng } from "../engine/math/rng.ts";
import { type Cell, cellKey, isConnected } from "./grid.ts";
import { type Figure, figureCells } from "./figure.ts";

/** Options for {@link dissect}. */
export interface DissectOptions {
	/** Minimum cells per piece (default `2` — no lonely single squares). */
	minCells?: number;
}

/** One piece of a dissected figure: its absolute (solved) cells in figure coordinates. */
export interface PieceDef {
	/** The cells this piece occupies in the assembled figure. */
	cells: Cell[];
}

/**
 * Cut `fig` into (about) `pieceCount` connected polyomino pieces. The returned count may be lower
 * than requested when the figure is too small to host that many pieces of at least `minCells`, or
 * when a merge was needed; it is never zero for a non-empty figure.
 */
export function dissect(
	fig: Figure,
	pieceCount: number,
	rng: Rng,
	opts: DissectOptions = {},
): PieceDef[] {
	const minCells = Math.max(1, opts.minCells ?? 2);
	const all = figureCells(fig);
	const total = all.length;
	if (total === 0) return [];
	const valid = new Set(all.map(cellKey)); // keys inside the figure (clamps the frontier)

	// Clamp the request to what the figure can actually hold.
	const wanted = Math.max(1, Math.min(pieceCount, Math.floor(total / minCells) || 1));
	if (wanted === 1) return [{ cells: all }];

	// Pick distinct seed cells via a deterministic shuffle.
	const order = shuffle(all, rng);
	const region = new Map<string, number>(); // cell key → region index
	const regions: Cell[][] = [];
	for (let i = 0; i < wanted; i++) {
		const seed = order[i];
		region.set(cellKey(seed), i);
		regions.push([seed]);
	}

	const claimed = new Set<string>(regions.map((r) => cellKey(r[0])));
	let remaining = total - wanted;

	// Grow until every cell is claimed. Each step: prefer the smallest region with a live frontier
	// (keeps sizes balanced and lifts under-min regions), then claim a random unclaimed neighbour.
	while (remaining > 0) {
		const grown = growStep(regions, claimed, region, rng, valid);
		if (!grown) break; // every frontier exhausted (shouldn't happen on a solid figure)
		remaining--;
	}

	// Merge any region still under the minimum into the smallest adjacent region.
	const merged = mergeUndersized(regions, region, minCells);
	return merged.map((cells) => ({ cells }));
}

/** Claim one frontier cell for the smallest-eligible region. Returns false if nothing can grow. */
function growStep(
	regions: Cell[][],
	claimed: Set<string>,
	region: Map<string, number>,
	rng: Rng,
	valid: Set<string>,
): boolean {
	// Eligible = regions whose frontier has at least one unclaimed neighbour.
	let bestIdx = -1;
	let bestSize = Infinity;
	const frontierCache: (Cell[] | null)[] = regions.map(() => null);
	for (let i = 0; i < regions.length; i++) {
		const fr = frontierOf(regions[i], claimed, valid);
		frontierCache[i] = fr;
		if (fr.length > 0 && regions[i].length < bestSize) {
			bestSize = regions[i].length;
			bestIdx = i;
		}
	}
	if (bestIdx < 0) return false;

	// A little randomness so pieces aren't perfectly blobby: usually grow the smallest, sometimes a
	// random eligible region.
	let idx = bestIdx;
	if (rng.bool(0.3)) {
		const eligible: number[] = [];
		for (let i = 0; i < regions.length; i++) {
			if (frontierCache[i] && frontierCache[i]!.length > 0) eligible.push(i);
		}
		idx = rng.pick(eligible);
	}

	const frontier = frontierCache[idx]!;
	const cell = rng.pick(frontier);
	claimed.add(cellKey(cell));
	region.set(cellKey(cell), idx);
	regions[idx].push(cell);
	return true;
}

/** The unclaimed, in-figure 4-neighbours of a region (its growth frontier). */
function frontierOf(cells: Cell[], claimed: Set<string>, valid: Set<string>): Cell[] {
	const seen = new Set<string>();
	const out: Cell[] = [];
	for (const { r, c } of cells) {
		for (
			const n of [{ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, {
				r,
				c: c + 1,
			}]
		) {
			const k = cellKey(n);
			if (valid.has(k) && !claimed.has(k) && !seen.has(k)) {
				seen.add(k);
				out.push(n);
			}
		}
	}
	return out;
}

/** Merge regions below `minCells` into the smallest 4-adjacent region. Returns surviving regions. */
function mergeUndersized(
	regions: Cell[][],
	region: Map<string, number>,
	minCells: number,
): Cell[][] {
	const alive = regions.map((cells) => cells.slice());
	const dead = new Set<number>();

	for (let i = 0; i < alive.length; i++) {
		if (dead.has(i) || alive[i].length >= minCells) continue;
		const target = smallestAdjacentRegion(alive[i], region, dead, i);
		if (target < 0) continue; // isolated (single-region figure) — leave as-is
		for (const cell of alive[i]) region.set(cellKey(cell), target);
		alive[target].push(...alive[i]);
		alive[i] = [];
		dead.add(i);
	}
	return alive.filter((cells) => cells.length > 0);
}

/** Index of the smallest live region 4-adjacent to `cells`, or `-1` if none. */
function smallestAdjacentRegion(
	cells: Cell[],
	region: Map<string, number>,
	dead: Set<number>,
	self: number,
): number {
	let best = -1;
	let bestSize = Infinity;
	const seen = new Set<number>();
	for (const { r, c } of cells) {
		for (
			const n of [{ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, {
				r,
				c: c + 1,
			}]
		) {
			const ri = region.get(cellKey(n));
			if (ri === undefined || ri === self || dead.has(ri) || seen.has(ri)) continue;
			seen.add(ri);
		}
	}
	for (const ri of seen) {
		const size = countRegion(region, ri);
		if (size < bestSize) {
			bestSize = size;
			best = ri;
		}
	}
	return best;
}

/** How many cells currently map to region `idx`. */
function countRegion(region: Map<string, number>, idx: number): number {
	let n = 0;
	for (const v of region.values()) if (v === idx) n++;
	return n;
}

/** A deterministic Fisher–Yates shuffle (copy). */
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = rng.int(0, i);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Validate a dissection: pieces are connected, disjoint, and exactly cover the figure. */
export function isValidDissection(fig: Figure, pieces: PieceDef[]): boolean {
	const want = new Set(figureCells(fig).map(cellKey));
	const seen = new Set<string>();
	for (const p of pieces) {
		if (p.cells.length === 0 || !isConnected(p.cells)) return false;
		for (const cell of p.cells) {
			const k = cellKey(cell);
			if (!want.has(k) || seen.has(k)) return false;
			seen.add(k);
		}
	}
	return seen.size === want.size;
}
