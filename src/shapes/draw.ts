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
import { darken, lighten, withAlpha } from "../engine/math/color.ts";
import type { GameState, LivePiece } from "./game.ts";
import { getPalette, pieceColor, type ShapesPalette } from "./palette.ts";
import { cellToScreen } from "./layout.ts";
import { orientedCells } from "./piece.ts";

/** Render the whole board for the current frame. */
export function drawGame(
	out: DisplayListBuilder,
	game: GameState,
	paletteName: string,
): void {
	const pal = getPalette(paletteName);
	const layout = game.layout;
	const cell = layout.cell;
	const gap = Math.max(1, cell * 0.07);

	// Background + tray panel.
	out.rect(0, 0, out.width, out.height, pal.background);
	const t = layout.trayRect;
	out.rect(t.x, t.y, t.w, t.h, pal.tray);

	// Figure outline: a uniform grid. Per-cell borders would double every inner line (each of two
	// neighbours paints `gap` on the shared edge) while leaving the perimeter single. Instead we lay
	// down outline-coloured backing tiles expanded outward by half a line, then carve the empty
	// interiors back inset by that same half-line — so every line, inner and outer, is exactly `gap`.
	const h = gap / 2;
	for (let r = 0; r < layout.figH; r++) {
		for (let c = 0; c < layout.figW; c++) {
			const { x, y } = cellToScreen(layout, r, c);
			out.rect(x - h, y - h, cell + gap, cell + gap, pal.outline);
		}
	}
	for (let r = 0; r < layout.figH; r++) {
		for (let c = 0; c < layout.figW; c++) {
			const { x, y } = cellToScreen(layout, r, c);
			out.rect(x + h, y + h, cell - gap, cell - gap, pal.cellEmpty);
		}
	}

	// Pieces in z-order. The selected/dragged piece is drawn last so it sits on top. Tray pieces
	// are drawn at their (smaller) tray scale; lifted/placed pieces at the board scale.
	const top = game.draggingId ?? game.selectedId;
	const drawOne = (p: typeof game.pieces[number], selected: boolean): void => {
		const c = p.state === "tray" ? layout.trayCell : layout.cell;
		drawPiece(out, p, pal, c, Math.max(1, c * 0.07), selected);
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
	cell: number,
	gap: number,
	selected: boolean,
): void {
	const fill = pieceColor(pal, p.shape.colorIndex);
	const body = p.state === "placed" ? lighten(fill, 0.06) : fill;
	const border = selected ? pal.select : darken(fill, 0.35);
	const cells = orientedCells(p.shape, p.orientation);
	// Two passes so the per-cell borders never double on shared edges: all backing tiles (expanded
	// outward by half a line) first, then all interiors inset by that same half-line. Every grid
	// line — between cells and around the piece — comes out exactly `gap` thick.
	const h = gap / 2;
	const s = cell - gap;
	for (const c of cells) {
		out.rect(
			p.x + c.c * cell - h,
			p.y + c.r * cell - h,
			cell + gap,
			cell + gap,
			border,
		);
	}
	for (const c of cells) {
		const x = p.x + c.c * cell + h;
		const y = p.y + c.r * cell + h;
		out.rect(x, y, s, s, body);
		// A faint top-light so cells read as little tiles rather than flat squares.
		out.rect(x, y, s, s * 0.4, withAlpha(lighten(body, 0.25), 0.5));
	}
}
