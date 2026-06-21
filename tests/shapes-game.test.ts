import { assert, assertEquals } from "@std/assert";
import { DEFAULT_CONFIG, normalizeConfig } from "../src/shapes/config.ts";
import { buildLevel, type Level } from "../src/shapes/level.ts";
import { GameState } from "../src/shapes/game.ts";
import { makePieceShape, orientedCells, solvePath } from "../src/shapes/piece.ts";
import { cellToScreen } from "../src/shapes/layout.ts";

const VIEW = { w: 800, h: 600 };

/** Drive the game's own pointer/op API to solve every piece with exactly minimal moves. */
function solveOptimally(game: GameState): void {
	for (const piece of game.pieces) {
		const p = game.pieces[piece.shape.id];
		if (p.state === "placed") continue;
		const tc = game.layout.trayCell;
		const first = orientedCells(p.shape, p.orientation)[0];
		const gx = p.x + (first.c + 0.5) * tc;
		const gy = p.y + (first.r + 0.5) * tc;
		assert(game.pointerDown(gx, gy), `failed to grab piece ${p.shape.id}`);
		// A press only selects; a small drag past the slop lifts + rescales the piece to board size.
		// Nudge to commit the lift, then read the live drag offset.
		game.pointerMove(gx + 20, gy + 20);
		const offx = gx + 20 - p.x;
		const offy = gy + 20 - p.y;
		for (const op of solvePath(p.shape, p.orientation)) {
			if (op === "rotate") game.rotateSelected();
			else game.flipSelected();
		}
		const home = cellToScreen(game.layout, p.shape.anchorR, p.shape.anchorC);
		game.pointerMove(home.x + offx, home.y + offy);
		game.pointerUp();
		assertEquals(
			game.pieces[p.shape.id].state,
			"placed",
			`piece ${p.shape.id} did not snap`,
		);
	}
}

Deno.test("an optimal solve hits par exactly and marks the level solved", () => {
	for (let lvl = 1; lvl <= 12; lvl++) {
		const game = new GameState(DEFAULT_CONFIG, buildLevel(DEFAULT_CONFIG, lvl), VIEW);
		solveOptimally(game);
		assert(game.solved, `level ${lvl} not solved`);
		assertEquals(game.phase, "solved");
		assertEquals(game.moves, game.level.par, `level ${lvl} moves != par`);
	}
});

Deno.test("a wrong drop springs back to the tray and costs no move", () => {
	const game = new GameState(DEFAULT_CONFIG, buildLevel(DEFAULT_CONFIG, 5), VIEW);
	const p = game.pieces[0];
	const tc = game.layout.trayCell;
	const first = orientedCells(p.shape, p.orientation)[0];
	const gx = p.x + (first.c + 0.5) * tc;
	const gy = p.y + (first.r + 0.5) * tc;
	assert(game.pointerDown(gx, gy));
	game.pointerMove(gx + 300, gy + 300); // far from home
	game.pointerUp();
	assertEquals(p.state, "tray");
	assertEquals(game.moves, 0);
	assert(!game.solved);
});

Deno.test("a bare press selects without lifting; only a drag past the slop grows the piece", () => {
	const game = new GameState(DEFAULT_CONFIG, buildLevel(DEFAULT_CONFIG, 5), VIEW);
	const p = game.pieces[0];
	const tc = game.layout.trayCell;
	const first = orientedCells(p.shape, p.orientation)[0];
	const gx = p.x + (first.c + 0.5) * tc;
	const gy = p.y + (first.r + 0.5) * tc;
	const x0 = p.x;
	const y0 = p.y;

	assert(game.pointerDown(gx, gy));
	assertEquals(
		game.selectedId,
		p.shape.id,
		"a press should select/highlight the piece",
	);
	assertEquals(p.state, "tray", "a bare press must not lift the piece");
	assertEquals(game.draggingId, null);
	assertEquals(p.x, x0, "the piece must not move/rescale on a bare press");
	assertEquals(p.y, y0);

	game.pointerMove(gx + 2, gy + 1); // jitter under the slop is still a tap
	assertEquals(p.state, "tray", "sub-slop jitter must not lift");
	assertEquals(game.draggingId, null);

	game.pointerMove(gx + 40, gy + 40); // a real drag past the slop lifts it
	assertEquals(p.state, "dragging", "a drag past the slop should lift the piece");
	assertEquals(game.draggingId, p.shape.id);

	game.pointerUp(); // released far from the figure → springs back, no move charged
	assertEquals(p.state, "tray");
	assertEquals(game.moves, 0);
});

Deno.test("undo returns the last placed piece to the tray and counts a move", () => {
	const game = new GameState(DEFAULT_CONFIG, buildLevel(DEFAULT_CONFIG, 3), VIEW);
	solveOptimally(game);
	assert(game.solved);
	const movesAtSolve = game.moves;
	game.undo();
	assert(!game.solved, "undo should un-solve");
	assertEquals(game.moves, movesAtSolve + 1);
	assertEquals(
		game.pieces.filter((p) => p.state === "placed").length,
		game.pieces.length - 1,
	);
});

Deno.test("hint auto-solves a piece and charges the penalty", () => {
	const config = normalizeConfig({ ...DEFAULT_CONFIG, hintPenalty: 4 });
	const game = new GameState(config, buildLevel(config, 6), VIEW);
	const n = game.pieces.length;
	for (let i = 0; i < n; i++) game.hint();
	assert(game.solved);
	assertEquals(game.hintsUsed, n);
	assertEquals(game.moves, n * 4);
});

Deno.test("rotate and flip each count one move", () => {
	const game = new GameState(DEFAULT_CONFIG, buildLevel(DEFAULT_CONFIG, 4), VIEW);
	game.selectedId = 0;
	game.rotateSelected();
	game.flipSelected();
	assertEquals(game.moves, 2);
});

Deno.test("placed pieces cannot be picked up (only undo removes them)", () => {
	const game = new GameState(DEFAULT_CONFIG, buildLevel(DEFAULT_CONFIG, 2), VIEW);
	solveOptimally(game);
	const home = cellToScreen(
		game.layout,
		game.pieces[0].shape.anchorR,
		game.pieces[0].shape.anchorC,
	);
	assertEquals(game.pickAt(home.x + 1, home.y + 1), null);
});

/** A 2×2 figure cut into two horizontal dominoes (top + bottom row) — congruent and swappable. */
function congruentLevel(): Level {
	const top = makePieceShape(0, 0, [{ r: 0, c: 0 }, { r: 0, c: 1 }]);
	const bottom = makePieceShape(1, 1, [{ r: 1, c: 0 }, { r: 1, c: 1 }]);
	return {
		level: 1,
		figure: { w: 2, h: 2 },
		pieces: [top, bottom],
		starts: [0, 0],
		par: 2,
	};
}

/** Grab piece `id` and drop it so its top-left lands on figure cell `(targetR, targetC)`. */
function dropOn(game: GameState, id: number, targetR: number, targetC: number): void {
	const p = game.pieces[id];
	const tc = game.layout.trayCell;
	const first = orientedCells(p.shape, p.orientation)[0];
	const gx = p.x + (first.c + 0.5) * tc;
	const gy = p.y + (first.r + 0.5) * tc;
	game.pointerDown(gx, gy);
	game.pointerMove(gx + 20, gy + 20); // nudge past the slop to lift + rescale
	const offx = gx + 20 - p.x;
	const offy = gy + 20 - p.y;
	const t = cellToScreen(game.layout, targetR, targetC);
	game.pointerMove(t.x + offx, t.y + offy);
	game.pointerUp();
}

Deno.test("congruent pieces are interchangeable — a swapped arrangement still solves (the bug)", () => {
	const game = new GameState(DEFAULT_CONFIG, congruentLevel(), { w: 600, h: 600 });
	dropOn(game, 0, 1, 0); // top piece into the BOTTOM row
	assertEquals(game.pieces[0].state, "placed");
	dropOn(game, 1, 0, 0); // bottom piece into the TOP row
	assertEquals(game.pieces[1].state, "placed");
	assert(game.solved);
});

Deno.test("a piece cannot be dropped overlapping another (snaps only to empty cells)", () => {
	const game = new GameState(DEFAULT_CONFIG, congruentLevel(), { w: 600, h: 600 });
	dropOn(game, 0, 0, 0); // top piece → top row
	dropOn(game, 1, 0, 0); // bottom piece → top row too → overlap → rejected
	assertEquals(game.pieces[1].state, "tray");
	assert(!game.solved);
});
