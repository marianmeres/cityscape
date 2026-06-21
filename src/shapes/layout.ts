/**
 * Board layout — the pure fit-to-viewport projector for the shapes board.
 *
 * Given the viewport, the figure size, and each piece's bounding box (in its current orientation),
 * this computes the figure's board cell size (filling its region) plus a separate, usually smaller
 * tray cell — so a cramped tray never shrinks the board; pieces grow to board scale when lifted. It
 * also returns the figure's on-screen rectangle and a resting slot for every piece in the tray. It
 * is the domain's own world→screen transform — no scrolling camera, no pan/zoom — and being pure it
 * is fully unit-testable.
 *
 * @module
 */

import type { Figure } from "./figure.ts";

/** A screen-space rectangle in CSS pixels. */
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A piece's cell extent (used to size its tray slot). */
export interface PieceBounds {
	rows: number;
	cols: number;
}

/** The resolved on-screen layout for one frame. */
export interface BoardLayout {
	/** Pixels per cell on the figure/board (sized to fill the figure region). */
	cell: number;
	/** Pixels per cell for pieces resting in the tray (≤ {@link cell}; pieces grow when lifted). */
	trayCell: number;
	/** Figure width/height in cells (echoed for convenience). */
	figW: number;
	figH: number;
	/** Screen pixel of the figure's `(0,0)` cell, top-left. */
	originX: number;
	originY: number;
	/** The region reserved for the figure. */
	figureRect: Rect;
	/** The region reserved for the tray. */
	trayRect: Rect;
	/** Resting top-left screen pixel for each piece in the tray (aligned to the piece array). */
	slots: { x: number; y: number }[];
}

/** Compute the board layout. `pieceBounds` is each piece's extent in its current orientation. */
export function computeLayout(
	viewport: { w: number; h: number },
	figure: Figure,
	pieceBounds: readonly PieceBounds[],
): BoardLayout {
	const vw = Math.max(1, viewport.w);
	const vh = Math.max(1, viewport.h);
	const pad = Math.round(Math.min(vw, vh) * 0.04);
	const gap = pad;

	// Portrait → figure on top, tray below. Landscape → figure left, tray right.
	const portrait = vh >= vw * 0.85;
	let figureRect: Rect;
	let trayRect: Rect;
	if (portrait) {
		const usableH = vh - 2 * pad - gap;
		const figH = usableH * 0.7;
		figureRect = { x: pad, y: pad, w: vw - 2 * pad, h: figH };
		trayRect = { x: pad, y: pad + figH + gap, w: vw - 2 * pad, h: usableH - figH };
	} else {
		const usableW = vw - 2 * pad - gap;
		const figW = usableW * 0.7;
		figureRect = { x: pad, y: pad, w: figW, h: vh - 2 * pad };
		trayRect = { x: pad + figW + gap, y: pad, w: usableW - figW, h: vh - 2 * pad };
	}

	const count = Math.max(1, pieceBounds.length);
	// Choose a tray grid whose aspect roughly matches the tray rect.
	const cols = clampInt(
		Math.round(Math.sqrt((count * trayRect.w) / Math.max(1, trayRect.h))),
		1,
		count,
	);
	const rows = Math.ceil(count / cols);
	const slotW = trayRect.w / cols;
	const slotH = trayRect.h / rows;

	let maxCols = 1;
	let maxRows = 1;
	for (const b of pieceBounds) {
		if (b.cols > maxCols) maxCols = b.cols;
		if (b.rows > maxRows) maxRows = b.rows;
	}

	// The figure fills its region; the tray uses its own (usually smaller) cell so a cramped tray
	// never shrinks the board. Tray pieces are capped at the board cell (never larger).
	const cell = Math.max(
		2,
		Math.min(figureRect.w / figure.w, figureRect.h / figure.h) * 0.98,
	);
	const trayCellRaw = Math.min((slotW * 0.9) / maxCols, (slotH * 0.9) / maxRows);
	const trayCell = Math.max(2, Math.min(trayCellRaw, cell));

	const originX = figureRect.x + (figureRect.w - figure.w * cell) / 2;
	const originY = figureRect.y + (figureRect.h - figure.h * cell) / 2;

	const slots: { x: number; y: number }[] = [];
	for (let i = 0; i < pieceBounds.length; i++) {
		const gr = Math.floor(i / cols);
		const gc = i % cols;
		const gx = trayRect.x + gc * slotW;
		const gy = trayRect.y + gr * slotH;
		slots.push({
			x: gx + (slotW - pieceBounds[i].cols * trayCell) / 2,
			y: gy + (slotH - pieceBounds[i].rows * trayCell) / 2,
		});
	}

	return {
		cell,
		trayCell,
		figW: figure.w,
		figH: figure.h,
		originX,
		originY,
		figureRect,
		trayRect,
		slots,
	};
}

/** Top-left screen pixel of figure cell `(r, c)`. */
export function cellToScreen(
	layout: BoardLayout,
	r: number,
	c: number,
): { x: number; y: number } {
	return { x: layout.originX + c * layout.cell, y: layout.originY + r * layout.cell };
}

/** The nearest figure cell to a screen point (may lie outside the figure bounds). */
export function screenToCell(
	layout: BoardLayout,
	x: number,
	y: number,
): { r: number; c: number } {
	return {
		r: Math.round((y - layout.originY) / layout.cell),
		c: Math.round((x - layout.originX) / layout.cell),
	};
}

function clampInt(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.round(v)));
}
