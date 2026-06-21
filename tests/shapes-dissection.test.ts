import { assert, assertEquals } from "@std/assert";
import { createRng } from "../src/engine/math/rng.ts";
import {
	applyOrientation,
	type Cell,
	flip,
	isConnected,
	normalizeCells,
	ORIENTATION_COUNT,
	rotateCW,
	shapeKey,
} from "../src/shapes/grid.ts";
import { dissect, isValidDissection } from "../src/shapes/dissection.ts";
import type { Figure } from "../src/shapes/figure.ts";

const L_TROMINO: Cell[] = [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }];
const geoRotateCW = (cells: Cell[]) => cells.map((c) => ({ r: c.c, c: -c.r }));
const geoMirror = (cells: Cell[]) => cells.map((c) => ({ r: c.r, c: -c.c }));

Deno.test("orientation identity leaves the shape unchanged", () => {
	assertEquals(shapeKey(applyOrientation(L_TROMINO, 0)), shapeKey(L_TROMINO));
});

Deno.test("rotateCW index op matches a geometric 90° CW turn for all orientations", () => {
	for (let o = 0; o < ORIENTATION_COUNT; o++) {
		const here = applyOrientation(L_TROMINO, o);
		assertEquals(
			shapeKey(applyOrientation(L_TROMINO, rotateCW(o))),
			shapeKey(geoRotateCW(here)),
		);
	}
});

Deno.test("flip index op matches a geometric mirror for all orientations", () => {
	for (let o = 0; o < ORIENTATION_COUNT; o++) {
		const here = applyOrientation(L_TROMINO, o);
		assertEquals(
			shapeKey(applyOrientation(L_TROMINO, flip(o))),
			shapeKey(geoMirror(here)),
		);
	}
});

Deno.test("four rotates and two flips are identities on the index", () => {
	for (let o = 0; o < ORIENTATION_COUNT; o++) {
		assertEquals(rotateCW(rotateCW(rotateCW(rotateCW(o)))), o);
		assertEquals(flip(flip(o)), o);
	}
});

Deno.test("a 2×2 square has one shape across all 8 orientations; a tromino has fewer than 8", () => {
	const square: Cell[] = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, {
		r: 1,
		c: 1,
	}];
	const squareKeys = new Set(
		Array.from({ length: 8 }, (_, o) => shapeKey(applyOrientation(square, o))),
	);
	assertEquals(squareKeys.size, 1);
	const lKeys = new Set(
		Array.from({ length: 8 }, (_, o) => shapeKey(applyOrientation(L_TROMINO, o))),
	);
	assert(lKeys.size > 1 && lKeys.size <= 8);
});

Deno.test("isConnected distinguishes a polyomino from a split set", () => {
	assert(isConnected(L_TROMINO));
	assert(!isConnected([{ r: 0, c: 0 }, { r: 0, c: 2 }]));
	assert(isConnected(normalizeCells(L_TROMINO)));
});

Deno.test("dissect produces a valid partition across many seeds and shapes", () => {
	const figs: Figure[] = [{ w: 3, h: 3 }, { w: 5, h: 4 }, { w: 6, h: 6 }, {
		w: 8,
		h: 5,
	}];
	for (const fig of figs) {
		for (let s = 0; s < 25; s++) {
			for (const count of [2, 3, 5]) {
				const pieces = dissect(
					fig,
					count,
					createRng(`${fig.w}x${fig.h}-${s}-${count}`),
				);
				assert(
					isValidDissection(fig, pieces),
					`invalid cut for ${fig.w}x${fig.h} seed ${s} count ${count}`,
				);
				assert(pieces.length >= 1 && pieces.length <= count);
				for (const p of pieces) {
					assert(p.cells.length >= 2 || pieces.length === 1);
				}
			}
		}
	}
});

Deno.test("dissect is deterministic for a given seed", () => {
	const fig: Figure = { w: 6, h: 5 };
	const a = dissect(fig, 4, createRng("repro"));
	const b = dissect(fig, 4, createRng("repro"));
	assertEquals(a, b);
});

Deno.test("different seeds generally produce different cuts", () => {
	const fig: Figure = { w: 6, h: 5 };
	const a = JSON.stringify(dissect(fig, 4, createRng("alpha")));
	const b = JSON.stringify(dissect(fig, 4, createRng("beta")));
	assert(a !== b);
});
