/**
 * The {@link Figure}: the solid the puzzle is cut from and reassembled into — a `w × h` grid of
 * unit cells (square when `w === h`, otherwise a rectangle). Pure and tiny.
 *
 * @module
 */

import type { Cell } from "./grid.ts";

/** The target solid: `w` columns × `h` rows of unit cells. */
export interface Figure {
	/** Width in cells (columns). */
	w: number;
	/** Height in cells (rows). */
	h: number;
}

/** Total cell count of a figure. */
export function figureArea(fig: Figure): number {
	return fig.w * fig.h;
}

/** Every cell of a figure, row-major (`(0,0)` … `(h-1, w-1)`). */
export function figureCells(fig: Figure): Cell[] {
	const out: Cell[] = [];
	for (let r = 0; r < fig.h; r++) {
		for (let c = 0; c < fig.w; c++) out.push({ r, c });
	}
	return out;
}
