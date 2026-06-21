/**
 * The pure game-state machine — the rules of shapes, with no DOM and no renderer.
 *
 * It owns the live state of a level: each piece's orientation, screen position and whether it is in
 * the tray, being dragged, or locked into the figure; the selection; the move count and elapsed
 * time; and completion. Input arrives as abstract calls (`pointerDown/Move/Up`, `rotateSelected`,
 * `flipSelected`, `undo`, `hint`) — a runtime translates pointer/touch/keyboard into these. Snapping
 * is guided: a piece locks only where its current orientation exactly fills empty figure cells —
 * *any* valid fit, so congruent pieces are interchangeable and every valid tiling is accepted, while
 * overlaps and overhangs stay impossible. Everything is deterministic and unit-testable.
 *
 * @module
 */

import {
	cellBounds,
	flip as flipOrientation,
	type Orientation,
	rotateCCW,
	rotateCW,
} from "./grid.ts";
import type { ShapesConfig } from "./config.ts";
import type { Figure } from "./figure.ts";
import type { Level } from "./level.ts";
import { orientedCells, type PieceShape } from "./piece.ts";
import {
	type BoardLayout,
	cellToScreen,
	computeLayout,
	type PieceBounds,
} from "./layout.ts";

/** Where a piece currently is. */
export type PieceState = "tray" | "dragging" | "placed";

/** The live state of one piece during play. */
export interface LivePiece {
	shape: PieceShape;
	orientation: Orientation;
	/** Current (animated) top-left screen pixel of the piece's bounding box. */
	x: number;
	y: number;
	/** Animation target top-left (slot, home, or pointer). */
	tx: number;
	ty: number;
	state: PieceState;
	/** This piece's resting tray slot (top-left of its square slot box). */
	slotX: number;
	slotY: number;
	/** When placed: the figure cell its top-left occupies (so resize can re-derive its pixels). */
	placedR?: number;
	placedC?: number;
	/** When placed: the figure-cell keys it covers (freed on undo). */
	placedCells?: string[];
}

/**
 * How far (in screen px) the pointer must travel after pressing a tray piece before it lifts. Below
 * this a press just selects/highlights the piece where it rests (at tray scale); only a real drag
 * grows it to board scale. This stops a tap-to-highlight from flickering big-then-small.
 */
const DRAG_SLOP_PX = 5;

/** The mutable game state for one level. */
export class GameState {
	readonly config: ShapesConfig;
	readonly level: Level;
	readonly pieces: LivePiece[];

	#vw = 1;
	#vh = 1;
	#layout: BoardLayout;
	#stableBounds: PieceBounds[];

	selectedId: number | null = null;
	draggingId: number | null = null;
	/** A pressed-but-not-yet-lifted piece: the press selects, the first drag past the slop lifts it. */
	#pendingId: number | null = null;
	#downX = 0;
	#downY = 0;
	#dragOffX = 0;
	#dragOffY = 0;

	moves = 0;
	elapsedMs = 0;
	hintsUsed = 0;
	/** Monotonic count of pieces locked in (for placement feedback like a click sound). */
	placements = 0;
	phase: "playing" | "solved" = "playing";
	#placedOrder: number[] = [];
	/** Figure cells currently covered by placed pieces — the occupancy map snapping checks. */
	#occupied = new Set<string>();

	constructor(config: ShapesConfig, level: Level, viewport: { w: number; h: number }) {
		this.config = config;
		this.level = level;
		// A tray slot is sized to the piece's largest orientation (a square of its max dimension),
		// so rotating never changes the cell size or the board layout.
		this.#stableBounds = level.pieces.map((p) => {
			const m = Math.max(p.rows, p.cols);
			return { rows: m, cols: m };
		});
		this.pieces = level.pieces.map((shape, i) => ({
			shape,
			orientation: level.starts[i],
			x: 0,
			y: 0,
			tx: 0,
			ty: 0,
			state: "tray" as PieceState,
			slotX: 0,
			slotY: 0,
		}));
		this.#layout = computeLayout(viewport, level.figure, this.#stableBounds);
		this.resize(viewport.w, viewport.h);
	}

	/** The figure being assembled. */
	get figure(): Figure {
		return this.level.figure;
	}

	/** The current board layout (recomputed on resize). */
	get layout(): BoardLayout {
		return this.#layout;
	}

	/** Whether every piece is locked in (the level is solved). */
	get solved(): boolean {
		return this.#placedOrder.length === this.pieces.length;
	}

	/** Recompute layout for a new viewport and reposition every piece. */
	resize(w: number, h: number): void {
		this.#vw = Math.max(1, w);
		this.#vh = Math.max(1, h);
		this.#layout = computeLayout(
			{ w: this.#vw, h: this.#vh },
			this.level.figure,
			this.#stableBounds,
		);
		for (let i = 0; i < this.pieces.length; i++) {
			const p = this.pieces[i];
			p.slotX = this.#layout.slots[i].x;
			p.slotY = this.#layout.slots[i].y;
			if (p.state === "placed") {
				const s = cellToScreen(
					this.#layout,
					p.placedR ?? p.shape.anchorR,
					p.placedC ?? p.shape.anchorC,
				);
				p.x = p.tx = s.x;
				p.y = p.ty = s.y;
			} else {
				const rest = this.#trayRest(p);
				p.x = p.tx = rest.x;
				p.y = p.ty = rest.y;
			}
		}
	}

	/** Advance time + ease non-dragged pieces toward their targets. */
	tick(dt: number): void {
		if (dt <= 0) return;
		if (this.phase === "playing") this.elapsedMs += dt;
		// A quick spring (placements snap instantly; this only eases tray spring-back / re-centring).
		const k = 1 - Math.exp(-dt / 20);
		for (const p of this.pieces) {
			if (p.state === "dragging") continue;
			p.x += (p.tx - p.x) * k;
			p.y += (p.ty - p.y) * k;
		}
	}

	/** Topmost draggable (tray) piece under a screen point, or `null`. */
	pickAt(x: number, y: number): number | null {
		for (let i = this.pieces.length - 1; i >= 0; i--) {
			const p = this.pieces[i];
			if (p.state === "placed") continue;
			if (this.#hit(p, x, y)) return p.shape.id;
		}
		return null;
	}

	/**
	 * Topmost piece under a screen point, **including placed pieces** — the hit-test the runtime's
	 * tap/double-tap gestures use (a tap on a placed piece must be detectable so a double-tap can
	 * pull it back off the board). {@link pickAt}, used for dragging, deliberately skips placed.
	 */
	pieceAt(x: number, y: number): number | null {
		for (let i = this.pieces.length - 1; i >= 0; i--) {
			if (this.#hit(this.pieces[i], x, y)) return this.pieces[i].shape.id;
		}
		return null;
	}

	/**
	 * Press on the piece at `(x, y)`, if any: it becomes selected/highlighted but stays put at tray
	 * scale. It only lifts (and grows to board scale) once the pointer drags past {@link DRAG_SLOP_PX}
	 * — see {@link pointerMove} — so a tap-to-highlight no longer flickers big-then-small. Returns
	 * whether a piece was picked.
	 */
	pointerDown(x: number, y: number): boolean {
		const id = this.pickAt(x, y);
		if (id == null) {
			this.selectedId = null;
			this.#pendingId = null;
			return false;
		}
		this.selectedId = id;
		this.#pendingId = id;
		this.#downX = x;
		this.#downY = y;
		return true;
	}

	/**
	 * Lift the pending piece: grow it from tray scale to board scale around the press point so the
	 * grabbed cell stays under the pointer, then begin dragging. Called on the first qualifying move.
	 */
	#beginDrag(id: number): void {
		const p = this.pieces[id];
		const tc = this.#layout.trayCell;
		const bc = this.#layout.cell;
		if (tc > 0 && tc !== bc) {
			const { rows, cols } = cellBounds(orientedCells(p.shape, p.orientation));
			const fx = cols > 0 ? (this.#downX - p.x) / (cols * tc) : 0.5;
			const fy = rows > 0 ? (this.#downY - p.y) / (rows * tc) : 0.5;
			p.x = this.#downX - fx * cols * bc;
			p.y = this.#downY - fy * rows * bc;
		}
		this.#pendingId = null;
		this.draggingId = id;
		p.state = "dragging";
		this.#dragOffX = this.#downX - p.x;
		this.#dragOffY = this.#downY - p.y;
	}

	/** Follow the pointer; the first move past the slop lifts a pressed-but-not-yet-lifted piece. */
	pointerMove(x: number, y: number): void {
		let id = this.draggingId;
		if (id == null) {
			if (this.#pendingId == null) return;
			// A placed piece can't be lifted (e.g. a hint locked it in after the press).
			if (this.pieces[this.#pendingId].state === "placed") {
				this.#pendingId = null;
				return;
			}
			const dx = x - this.#downX;
			const dy = y - this.#downY;
			if (dx * dx + dy * dy < DRAG_SLOP_PX * DRAG_SLOP_PX) return; // still a tap
			id = this.#pendingId;
			this.#beginDrag(id);
		}
		const p = this.pieces[id];
		p.x = p.tx = x - this.#dragOffX;
		p.y = p.ty = y - this.#dragOffY;
	}

	/** Release the dragged piece: lock it home if correctly placed, else spring back to the tray. */
	pointerUp(): void {
		this.#pendingId = null; // a press that never crossed the slop was only a selection
		if (this.draggingId == null) return;
		const p = this.pieces[this.draggingId];
		this.draggingId = null;
		if (this.#tryPlace(p)) return;
		// Spring back to the tray (no move charged for a failed drop).
		p.state = "tray";
		const rest = this.#trayRest(p);
		p.tx = rest.x;
		p.ty = rest.y;
	}

	/** Rotate a piece 90° CW (defaults to the selected/dragged one). Counts as one move. */
	rotateSelected(id?: number): void {
		this.#reorient((o) => rotateCW(o), id);
	}

	/** Rotate a piece 90° CCW (defaults to the selected/dragged one). Counts as one move. */
	rotateSelectedCCW(id?: number): void {
		this.#reorient((o) => rotateCCW(o), id);
	}

	/** Mirror a piece (defaults to the selected/dragged one). Counts as one move. */
	flipSelected(id?: number): void {
		this.#reorient((o) => flipOrientation(o), id);
	}

	/** Cycle the selection to the next unplaced piece (keyboard helper). */
	selectNext(): void {
		const order = this.pieces.filter((p) => p.state !== "placed").map((p) =>
			p.shape.id
		);
		if (order.length === 0) {
			this.selectedId = null;
			return;
		}
		const at = this.selectedId == null ? -1 : order.indexOf(this.selectedId);
		this.selectedId = order[(at + 1) % order.length];
	}

	/** Undo the most recent placement, returning that piece to the tray. Counts as one move. */
	undo(): void {
		const id = this.#placedOrder[this.#placedOrder.length - 1];
		if (id != null) this.removePlaced(id);
	}

	/**
	 * Return one specific placed piece to the tray — the double-tap-on-board gesture. Unlike
	 * {@link undo} (which always pops the last placement) this targets the piece you tapped. Counts
	 * as one move. Returns whether anything was removed.
	 */
	removePlaced(id: number): boolean {
		const p = this.pieces[id];
		if (p.state !== "placed") return false;
		if (p.placedCells) { for (const k of p.placedCells) this.#occupied.delete(k); }
		p.placedCells = undefined;
		p.placedR = undefined;
		p.placedC = undefined;
		p.state = "tray";
		this.selectedId = id;
		const rest = this.#trayRest(p);
		p.tx = rest.x;
		p.ty = rest.y;
		const i = this.#placedOrder.indexOf(id);
		if (i >= 0) this.#placedOrder.splice(i, 1);
		this.moves++;
		this.phase = "playing";
		return true;
	}

	/** Auto-solve one unplaced piece by dropping it into its (still-empty) home, charging the penalty. */
	hint(): void {
		for (const p of this.pieces) {
			if (p.state === "placed") continue;
			const keys = p.shape.home.map((c) => `${c.r},${c.c}`);
			if (keys.some((k) => this.#occupied.has(k))) continue; // its home is taken by another fit
			if (this.draggingId === p.shape.id) this.draggingId = null;
			p.orientation = 0; // orientation 0 lays the piece exactly over its home cells
			this.#placeAt(p, p.shape.anchorR, p.shape.anchorC, keys);
			this.moves += this.config.hintPenalty;
			this.hintsUsed++;
			return;
		}
	}

	// ── internals ──────────────────────────────────────────────────────

	#reorient(
		fn: (o: Orientation) => Orientation,
		id: number | null = this.draggingId ?? this.selectedId,
	): void {
		if (id == null) return;
		const p = this.pieces[id];
		if (!p || p.state === "placed") return;
		p.orientation = fn(p.orientation);
		this.selectedId = id; // acting on a piece selects it (so it highlights as the active one)
		this.moves++;
		if (p.state === "tray") {
			const rest = this.#trayRest(p);
			p.tx = rest.x;
			p.ty = rest.y;
		}
	}

	/**
	 * Try to lock `p` into the figure wherever its current orientation exactly fills empty cells —
	 * *any* valid fit, not just its original home. This is what makes congruent pieces
	 * interchangeable and every valid tiling acceptable (you still can't overlap or overhang, so a
	 * wrong placement remains impossible). Returns whether it snapped.
	 */
	#tryPlace(p: LivePiece): boolean {
		const layout = this.#layout;
		const cell = layout.cell;
		// Snap the dragged top-left to the nearest figure cell, then test the exact footprint.
		const r0 = Math.round((p.y - layout.originY) / cell);
		const c0 = Math.round((p.x - layout.originX) / cell);
		const keys: string[] = [];
		for (const o of orientedCells(p.shape, p.orientation)) {
			const r = r0 + o.r;
			const c = c0 + o.c;
			if (r < 0 || c < 0 || r >= layout.figH || c >= layout.figW) return false; // overhang
			const k = `${r},${c}`;
			if (this.#occupied.has(k)) return false; // overlap
			keys.push(k);
		}
		this.#placeAt(p, r0, c0, keys);
		this.moves++;
		return true;
	}

	/** Lock `p` covering figure cells `keys`, its top-left at cell `(r0, c0)`. */
	#placeAt(p: LivePiece, r0: number, c0: number, keys: string[]): void {
		p.state = "placed";
		p.placedR = r0;
		p.placedC = c0;
		p.placedCells = keys;
		for (const k of keys) this.#occupied.add(k);
		const s = cellToScreen(this.#layout, r0, c0);
		// Snap instantly (the drop is already within half a cell of here) — no slow slide.
		p.tx = p.x = s.x;
		p.ty = p.y = s.y;
		this.placements++;
		if (this.selectedId === p.shape.id) this.selectedId = null;
		this.#placedOrder.push(p.shape.id);
		if (this.solved) this.phase = "solved";
	}

	/** Resting tray position for a piece (tray scale), re-centred for its current orientation. */
	#trayRest(p: LivePiece): { x: number; y: number } {
		const m = Math.max(p.shape.rows, p.shape.cols);
		const { rows, cols } = cellBounds(orientedCells(p.shape, p.orientation));
		const cell = this.#layout.trayCell;
		return {
			x: p.slotX + ((m - cols) * cell) / 2,
			y: p.slotY + ((m - rows) * cell) / 2,
		};
	}

	/** Whether screen `(x, y)` lands on one of a piece's cells (at its current display scale). */
	#hit(p: LivePiece, x: number, y: number): boolean {
		const cell = p.state === "tray" ? this.#layout.trayCell : this.#layout.cell;
		for (const c of orientedCells(p.shape, p.orientation)) {
			const cx = p.x + c.c * cell;
			const cy = p.y + c.r * cell;
			if (x >= cx && x < cx + cell && y >= cy && y < cy + cell) return true;
		}
		return false;
	}
}
