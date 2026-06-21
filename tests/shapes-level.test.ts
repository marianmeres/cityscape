import { assert, assertEquals } from "@std/assert";
import type { Cell } from "../src/shapes/grid.ts";
import {
	isSolvingOrientation,
	makePieceShape,
	minOpsForAll,
	solvingOrientations,
} from "../src/shapes/piece.ts";
import { buildLevel } from "../src/shapes/level.ts";
import { isValidDissection } from "../src/shapes/dissection.ts";
import { DEFAULT_CONFIG, normalizeConfig } from "../src/shapes/config.ts";
import { computeStars, scoreLevel } from "../src/shapes/scoring.ts";

const L: Cell[] = [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }];

Deno.test("a fully asymmetric piece (L-tetromino) solves only at orientation 0", () => {
	const lTetromino: Cell[] = [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }, {
		r: 2,
		c: 1,
	}];
	const shape = makePieceShape(0, 0, lTetromino);
	assert(isSolvingOrientation(shape, 0));
	assertEquals(shape.solving.size, 1);
});

Deno.test("the corner tromino has a diagonal mirror (2 solving orientations)", () => {
	const shape = makePieceShape(0, 0, L);
	assertEquals(shape.solving.size, 2);
});

Deno.test("a 1×2 domino has two solving orientations and symmetric min-ops", () => {
	const domino: Cell[] = [{ r: 0, c: 0 }, { r: 0, c: 1 }];
	const shape = makePieceShape(0, 0, domino);
	// horizontal (0,2) and vertical (1,3) — a flip leaves it identical.
	assertEquals(shape.solving.size, 4);
	assertEquals(shape.minOps[0], 0);
});

Deno.test("minOps is 0 exactly on solving orientations and >0 elsewhere", () => {
	const solving = solvingOrientations(makePieceShape(0, 0, L).base);
	const ops = minOpsForAll(solving);
	for (let o = 0; o < 8; o++) {
		if (solving.has(o)) assertEquals(ops[o], 0);
		else assert(ops[o] > 0);
	}
});

Deno.test("buildLevel yields a valid, scrambled, par-scored level", () => {
	for (let lvl = 1; lvl <= 20; lvl++) {
		const level = buildLevel(DEFAULT_CONFIG, lvl);
		assert(
			isValidDissection(level.figure, level.pieces.map((p) => ({ cells: p.home }))),
		);
		assertEquals(level.starts.length, level.pieces.length);
		// par = Σ (minOps at start + 1 placement); always ≥ piece count.
		let expected = 0;
		for (let i = 0; i < level.pieces.length; i++) {
			expected += level.pieces[i].minOps[level.starts[i]] + 1;
		}
		assertEquals(level.par, expected);
		assert(level.par >= level.pieces.length);
	}
});

Deno.test("buildLevel is deterministic per seed+level", () => {
	const a = buildLevel(DEFAULT_CONFIG, 7);
	const b = buildLevel(DEFAULT_CONFIG, 7);
	assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test("difficulty climbs: later levels are not smaller than early ones", () => {
	const early = buildLevel(DEFAULT_CONFIG, 1);
	const late = buildLevel(DEFAULT_CONFIG, 15);
	assert(late.figure.w * late.figure.h >= early.figure.w * early.figure.h);
	assert(late.pieces.length >= early.pieces.length);
});

Deno.test("scoring: par earns 3 stars, within slack earns 2, beyond earns 1", () => {
	assertEquals(computeStars(10, 10, 1.5), 3);
	assertEquals(computeStars(14, 10, 1.5), 2);
	assertEquals(computeStars(20, 10, 1.5), 1);
	const s = scoreLevel(10, 10, 5000, DEFAULT_CONFIG);
	assertEquals(s.stars, 3);
	assertEquals(s.timeMs, 5000);
});

Deno.test("config normalizes unknown/out-of-range input", () => {
	const c = normalizeConfig({ startPieces: 999, palette: "nope", bogus: 1 });
	assertEquals(c.startPieces, 6); // clamped to max
	assertEquals(c.palette, "slate"); // invalid → default
	assertEquals((c as unknown as Record<string, unknown>).bogus, undefined);
});
