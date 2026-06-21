/**
 * A puzzle piece's static shape data + the par math.
 *
 * A {@link PieceShape} is the immutable description of one piece: where it lives in the solved
 * figure (`home`), its canonical local shape (`base`), and — crucially — for every one of the 8
 * orientations, the minimum number of rotate/flip presses needed to bring it back to a *solving*
 * orientation ({@link PieceShape.minOps}). Because placement is guided (a piece only snaps when
 * correctly oriented over its home), that number is the exact, knowable minimum — which is what
 * makes "par" honest. The live position/orientation/selection of a piece during play is held
 * separately by the game state; this module is pure shape + graph math.
 *
 * @module
 */

import {
	applyOrientation,
	type Cell,
	cellBounds,
	flip,
	normalizeCells,
	type Orientation,
	ORIENTATION_COUNT,
	rotateCW,
	shapeKey,
} from "./grid.ts";

/** Immutable shape description of one piece. */
export interface PieceShape {
	/** Stable index within its level. */
	id: number;
	/** Index into the palette's piece colours. */
	colorIndex: number;
	/** Absolute cells occupied in the solved figure. */
	home: Cell[];
	/** The piece's canonical local shape (home, normalised to the origin). */
	base: Cell[];
	/** Canonical key of {@link PieceShape.base}. */
	baseKey: string;
	/** Top-left figure row of {@link PieceShape.home} (placement anchor). */
	anchorR: number;
	/** Top-left figure column of {@link PieceShape.home} (placement anchor). */
	anchorC: number;
	/** Bounding height of the base shape, in cells. */
	rows: number;
	/** Bounding width of the base shape, in cells. */
	cols: number;
	/** Orientations whose shape matches the solved shape (the piece's symmetry set). */
	solving: Set<Orientation>;
	/** `minOps[o]` = fewest rotate/flip presses from orientation `o` to any solving orientation. */
	minOps: number[];
}

/** Orientations of `base` whose shape equals the solved shape (always includes `0`). */
export function solvingOrientations(base: readonly Cell[]): Set<Orientation> {
	const key = shapeKey(base);
	const set = new Set<Orientation>();
	for (let o = 0; o < ORIENTATION_COUNT; o++) {
		if (shapeKey(applyOrientation(base, o)) === key) set.add(o);
	}
	return set;
}

/**
 * Fewest presses (each press is one rotate-CW or one flip) from every orientation to the nearest
 * solving orientation — a breadth-first search over the 8-node orientation graph.
 */
export function minOpsForAll(solving: Set<Orientation>): number[] {
	const out: number[] = new Array(ORIENTATION_COUNT).fill(0);
	for (let start = 0; start < ORIENTATION_COUNT; start++) {
		if (solving.has(start)) {
			out[start] = 0;
			continue;
		}
		const dist = new Array(ORIENTATION_COUNT).fill(-1);
		dist[start] = 0;
		const queue: Orientation[] = [start];
		let found = 0;
		while (queue.length) {
			const o = queue.shift()!;
			if (solving.has(o)) {
				found = dist[o];
				break;
			}
			for (const n of [rotateCW(o), flip(o)]) {
				if (dist[n] === -1) {
					dist[n] = dist[o] + 1;
					queue.push(n);
				}
			}
		}
		out[start] = found;
	}
	return out;
}

/** Build a {@link PieceShape} from its absolute home cells. */
export function makePieceShape(id: number, colorIndex: number, home: Cell[]): PieceShape {
	const base = normalizeCells(home);
	const { rows, cols } = cellBounds(base);
	let anchorR = Infinity;
	let anchorC = Infinity;
	for (const cell of home) {
		if (cell.r < anchorR) anchorR = cell.r;
		if (cell.c < anchorC) anchorC = cell.c;
	}
	const solving = solvingOrientations(base);
	return {
		id,
		colorIndex,
		home,
		base,
		baseKey: shapeKey(base),
		anchorR,
		anchorC,
		rows,
		cols,
		solving,
		minOps: minOpsForAll(solving),
	};
}

/** Whether orientation `o` solves this piece (its oriented shape matches the solved shape). */
export function isSolvingOrientation(shape: PieceShape, o: Orientation): boolean {
	return shape.solving.has(o);
}

/** A single player action on a piece. */
export type Op = "rotate" | "flip";

/**
 * A minimal sequence of rotate/flip presses that brings `shape` from orientation `from` to a
 * solving orientation (empty if already solving). Its length equals `minOps[from]` — used by the
 * hint auto-solver and to verify par.
 */
export function solvePath(shape: PieceShape, from: Orientation): Op[] {
	if (shape.solving.has(from)) return [];
	const parent = new Map<Orientation, { o: Orientation; op: Op }>();
	const visited = new Set<Orientation>([from]);
	const queue: Orientation[] = [from];
	let goal = -1;
	while (queue.length) {
		const o = queue.shift()!;
		if (shape.solving.has(o)) {
			goal = o;
			break;
		}
		for (
			const [n, op] of [
				[rotateCW(o), "rotate"] as const,
				[flip(o), "flip"] as const,
			]
		) {
			if (!visited.has(n)) {
				visited.add(n);
				parent.set(n, { o, op });
				queue.push(n);
			}
		}
	}
	if (goal === -1) return [];
	const ops: Op[] = [];
	for (let cur = goal; cur !== from;) {
		const step = parent.get(cur)!;
		ops.push(step.op);
		cur = step.o;
	}
	ops.reverse();
	return ops;
}

/** The piece's local cells at orientation `o`, normalised to the origin. */
export function orientedCells(shape: PieceShape, o: Orientation): Cell[] {
	return normalizeCells(applyOrientation(shape.base, o));
}
