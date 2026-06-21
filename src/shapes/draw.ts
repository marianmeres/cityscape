/**
 * Rendering the game state into a renderer-agnostic {@link DisplayList} — pure geometry, no DOM.
 *
 * Draw order is the board's z-order: background → tray panel → figure outline → locked pieces →
 * loose tray pieces → the selected/dragged piece on top → a celebratory glow when solved. The
 * output is the same `DrawCommand` vocabulary the city and the valley emit, so every renderer
 * (Canvas, ASCII, PixelArt) draws the puzzle for free.
 *
 * @module
 */

import type { DisplayListBuilder } from "../engine/render/draw-command.ts";
import { darken, lighten, rgb, withAlpha } from "../engine/math/color.ts";
import type { GameState, LivePiece } from "./game.ts";
import { getPalette, pieceColor, type ShapesPalette } from "./palette.ts";
import type { ShapesConfig } from "./config.ts";
import { cellToScreen } from "./layout.ts";
import { orientedCells } from "./piece.ts";

/** Render the whole board for the current frame, styled live by the config's `Look` knobs. */
export function drawGame(
	out: DisplayListBuilder,
	game: GameState,
	config: ShapesConfig,
): void {
	const pal = getPalette(config.palette);
	const layout = game.layout;
	const cell = layout.cell;
	const gap = Math.max(1, cell * config.borderWidth);

	// Background: an opaque base (kept first so renderers can treat it as the clear), with an
	// optional vertical lift→shadow gradient layered on top for depth.
	out.rect(0, 0, out.width, out.height, pal.background);
	if (config.bgShade > 0) {
		const k = config.bgShade;
		out.gradient(0, 0, out.width, out.height, [
			{ at: 0, color: rgb(255, 255, 255, 0.05 * k) },
			{ at: 0.5, color: rgb(255, 255, 255, 0) },
			{ at: 1, color: rgb(0, 0, 0, 0.5 * k) },
		], true);
	}
	const t = layout.trayRect;
	out.rect(t.x, t.y, t.w, t.h, pal.tray, config.cornerRadius * layout.trayCell * 1.2);

	// Figure outline: a uniform grid. Per-cell borders would double every inner line (each of two
	// neighbours paints `gap` on the shared edge) while leaving the perimeter single. Instead we lay
	// down outline-coloured backing tiles expanded outward by half a line, then carve the empty
	// interiors back inset by that same half-line — so every line, inner and outer, is exactly `gap`.
	// The interiors round uniformly; the backing rounds only its *exterior* corners, so the board's
	// outer silhouette curves while the inner grid junctions stay flush (no gaps open up there).
	const h = gap / 2;
	const rInt = config.cornerRadius * (cell - gap);
	const rOut = rInt > 0 ? rInt + gap : 0; // border band is `gap` wide → concentric outer radius
	const figHas = (r: number, c: number): boolean =>
		r >= 0 && r < layout.figH && c >= 0 && c < layout.figW;
	for (let r = 0; r < layout.figH; r++) {
		for (let c = 0; c < layout.figW; c++) {
			const { x, y } = cellToScreen(layout, r, c);
			out.rect(
				x - h,
				y - h,
				cell + gap,
				cell + gap,
				pal.outline,
				exteriorRadii(figHas, r, c, rOut),
			);
		}
	}
	for (let r = 0; r < layout.figH; r++) {
		for (let c = 0; c < layout.figW; c++) {
			const { x, y } = cellToScreen(layout, r, c);
			out.rect(x + h, y + h, cell - gap, cell - gap, pal.cellEmpty, rInt);
		}
	}

	// Pieces in z-order. The selected/dragged piece is drawn last so it sits on top. Tray pieces
	// are drawn at their (smaller) tray scale; lifted/placed pieces at the board scale.
	const top = game.draggingId ?? game.selectedId;
	const drawOne = (p: typeof game.pieces[number], selected: boolean): void => {
		const c = p.state === "tray" ? layout.trayCell : layout.cell;
		drawPiece(out, p, pal, config, c, Math.max(1, c * config.borderWidth), selected);
	};
	for (const p of game.pieces) if (p.state === "placed") drawOne(p, false);
	for (const p of game.pieces) {
		if (p.state !== "placed" && p.shape.id !== top) drawOne(p, false);
	}
	if (top != null) drawOne(game.pieces[top], true);

	// Solved! A soft celebratory glow over the figure.
	if (game.solved) {
		const f = layout.figureRect;
		out.glow(
			layout.originX + (layout.figW * cell) / 2,
			layout.originY + (layout.figH * cell) / 2,
			Math.max(f.w, f.h) * 0.6,
			withAlpha(pal.celebrate, 0.5),
			1,
		);
	}
}

/** Draw one piece's cells, with a per-cell border (the selection highlight when `selected`). */
function drawPiece(
	out: DisplayListBuilder,
	p: LivePiece,
	pal: ShapesPalette,
	config: ShapesConfig,
	cell: number,
	gap: number,
	selected: boolean,
): void {
	const fill = pieceColor(pal, p.shape.colorIndex);
	const body = p.state === "placed" ? lighten(fill, 0.06) : fill;
	// The active (selected/dragged) piece always shows its highlight; a resting piece's border fades
	// to the configured opacity (0 = invisible, so dropped pieces read as borderless tiles).
	const border = selected
		? pal.select
		: withAlpha(darken(fill, 0.35), config.borderAlpha);
	const cells = orientedCells(p.shape, p.orientation);
	const h = gap / 2;
	const s = cell - gap;
	const radius = config.cornerRadius * s;
	const rOut = radius > 0 ? radius + gap : 0; // outer silhouette radius (concentric with interiors)
	const present = new Set(cells.map((c) => `${c.r},${c.c}`));
	const has = (r: number, c: number): boolean => present.has(`${r},${c}`);

	// An optional soft coloured halo behind the whole piece (the "neon" look). Drawn first so the
	// tiles sit on top; the selected piece glows in the highlight colour and a touch brighter.
	if (config.pieceGlow > 0) {
		let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
		for (const c of cells) {
			if (c.r < minR) minR = c.r;
			if (c.r > maxR) maxR = c.r;
			if (c.c < minC) minC = c.c;
			if (c.c > maxC) maxC = c.c;
		}
		const cx = p.x + ((minC + maxC + 1) / 2) * cell;
		const cy = p.y + ((minR + maxR + 1) / 2) * cell;
		const rad = (Math.max(maxC - minC, maxR - minR) + 1) * cell * 0.7;
		out.glow(
			cx,
			cy,
			rad,
			withAlpha(selected ? pal.select : fill, 1),
			config.pieceGlow * (selected ? 1 : 0.7),
		);
	}

	// Two passes so the per-cell borders never double on shared edges: all backing tiles (expanded
	// outward by half a line) first, then all interiors inset by that same half-line. Every grid
	// line — between cells and around the piece — comes out exactly `gap` thick. Each backing tile
	// rounds only the corners on the piece's exterior silhouette, so an L/T/S piece curves around
	// its outside while staying flush along shared edges; the interior tiles round on their own.
	for (const c of cells) {
		out.rect(
			p.x + c.c * cell - h,
			p.y + c.r * cell - h,
			cell + gap,
			cell + gap,
			border,
			exteriorRadii(has, c.r, c.c, rOut),
		);
	}
	for (const c of cells) {
		const x = p.x + c.c * cell + h;
		const y = p.y + c.r * cell + h;
		out.rect(x, y, s, s, body, radius);
		// A top-light sheen so cells read as little tiles rather than flat squares (scaled by gloss).
		if (config.gloss > 0) {
			out.rect(
				x,
				y,
				s,
				s * 0.45,
				withAlpha(lighten(body, 0.25), 0.55 * config.gloss),
				radius,
			);
		}
	}
}

/**
 * Per-corner radii for one cell of a tiled shape: a corner rounds (to `radius`) only when both
 * orthogonal neighbours touching it are absent — i.e. it sits on a convex exterior corner of the
 * silhouette. Corners along a straight edge or at a concave/interior junction stay square, so the
 * backing tiles still meet flush. Returns `[tl, tr, br, bl]`.
 */
function exteriorRadii(
	has: (r: number, c: number) => boolean,
	r: number,
	c: number,
	radius: number,
): [number, number, number, number] {
	if (radius <= 0) return [0, 0, 0, 0];
	const up = has(r - 1, c);
	const down = has(r + 1, c);
	const left = has(r, c - 1);
	const right = has(r, c + 1);
	return [
		!up && !left ? radius : 0,
		!up && !right ? radius : 0,
		!down && !right ? radius : 0,
		!down && !left ? radius : 0,
	];
}
