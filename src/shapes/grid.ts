/**
 * Grid + polyomino orientation math — the pure geometric heart of the shapes puzzle.
 *
 * A {@link Cell} is an integer `(row, col)`. A piece is a set of cells (a polyomino). The eight
 * orientations of a piece are the dihedral group D4 (four rotations × an optional mirror), encoded
 * as a single {@link Orientation} index `0..7` (`flip*4 + rot`). Two players' actions map onto this
 * group: {@link rotateCW} (the rotate button) and {@link flip} (the flip button). Everything here is
 * pure and integer-exact, so determinism and the par computation fall out for free.
 *
 * @module
 */

/** An integer grid coordinate: `r` = row (down), `c` = column (right). */
export interface Cell {
	r: number;
	c: number;
}

/** A piece orientation `0..7`, encoded `flip*4 + rot` (rot is quarter-turns CW). */
export type Orientation = number;

/** The number of distinct orientations in D4. */
export const ORIENTATION_COUNT = 8;

/** The mirror bit of an orientation (`0` = unflipped, `1` = mirrored). */
export function flipOf(o: Orientation): 0 | 1 {
	return o >= 4 ? 1 : 0;
}

/** The rotation quarter-turns (`0..3`, CW) of an orientation. */
export function rotOf(o: Orientation): number {
	return o & 3;
}

/** Compose an orientation index from a mirror bit and a (wrapped) rotation. */
export function orientation(flip: number, rot: number): Orientation {
	return (flip ? 4 : 0) + (((rot % 4) + 4) % 4);
}

/** Rotate one cell 90° clockwise about the origin (normalise afterwards). */
function rotateCellCW(cell: Cell): Cell {
	return { r: cell.c, c: -cell.r };
}

/** Mirror one cell across the vertical axis (normalise afterwards). */
function mirrorCell(cell: Cell): Cell {
	return { r: cell.r, c: -cell.c };
}

/**
 * Apply an orientation to a cell set: mirror (if flipped) **then** rotate. The result is **not**
 * translated back to the origin — call {@link normalizeCells} when you need a canonical placement.
 */
export function applyOrientation(cells: readonly Cell[], o: Orientation): Cell[] {
	const f = flipOf(o);
	const rot = rotOf(o);
	return cells.map((cell) => {
		let x: Cell = f ? mirrorCell(cell) : { r: cell.r, c: cell.c };
		for (let i = 0; i < rot; i++) x = rotateCellCW(x);
		return x;
	});
}

/** Translate a cell set so its minimum row and column are `0`, sorted row-major. Returns a copy. */
export function normalizeCells(cells: readonly Cell[]): Cell[] {
	let minR = Infinity;
	let minC = Infinity;
	for (const c of cells) {
		if (c.r < minR) minR = c.r;
		if (c.c < minC) minC = c.c;
	}
	const out = cells.map((c) => ({ r: c.r - minR, c: c.c - minC }));
	out.sort((a, b) => a.r - b.r || a.c - b.c);
	return out;
}

/** A canonical string key for a cell set (orientation-independent only after normalising). */
export function shapeKey(cells: readonly Cell[]): string {
	return normalizeCells(cells).map((c) => `${c.r},${c.c}`).join(";");
}

/** The bounding extent (in rows × cols) spanned by a cell set. */
export function cellBounds(cells: readonly Cell[]): { rows: number; cols: number } {
	let minR = Infinity;
	let minC = Infinity;
	let maxR = -Infinity;
	let maxC = -Infinity;
	for (const c of cells) {
		if (c.r < minR) minR = c.r;
		if (c.c < minC) minC = c.c;
		if (c.r > maxR) maxR = c.r;
		if (c.c > maxC) maxC = c.c;
	}
	return { rows: maxR - minR + 1, cols: maxC - minC + 1 };
}

/** The orientation reached by pressing **rotate** (90° CW) once. */
export function rotateCW(o: Orientation): Orientation {
	return orientation(flipOf(o), rotOf(o) + 1);
}

/** The orientation reached by rotating 90° counter-clockwise once (the inverse of {@link rotateCW}). */
export function rotateCCW(o: Orientation): Orientation {
	return orientation(flipOf(o), rotOf(o) - 1);
}

/**
 * The orientation reached by pressing **flip** (mirror) once. In D4, mirroring after a rotation is
 * the same as mirroring first then rotating the other way — hence the rotation negates.
 */
export function flip(o: Orientation): Orientation {
	return orientation(1 - flipOf(o), (4 - rotOf(o)) % 4);
}

/** A 4-neighbour key for fast membership / adjacency tests. */
export function cellKey(cell: Cell): string {
	return `${cell.r},${cell.c}`;
}

/** Whether a cell set is 4-connected (a single polyomino). Empty sets are considered connected. */
export function isConnected(cells: readonly Cell[]): boolean {
	if (cells.length <= 1) return true;
	const present = new Set(cells.map(cellKey));
	const seen = new Set<string>();
	const stack: Cell[] = [cells[0]];
	seen.add(cellKey(cells[0]));
	while (stack.length) {
		const { r, c } = stack.pop()!;
		for (
			const n of [{ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, {
				r,
				c: c + 1,
			}]
		) {
			const k = cellKey(n);
			if (present.has(k) && !seen.has(k)) {
				seen.add(k);
				stack.push(n);
			}
		}
	}
	return seen.size === cells.length;
}
