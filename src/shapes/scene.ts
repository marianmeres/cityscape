/**
 * The headless shapes scene — the top-level, renderer-agnostic, DOM-free API.
 *
 * `createShapes(config)` builds the first level and returns a {@link ShapesScene} you drive with
 * `update(dt)` and read with `collect(w, h)` → a {@link DisplayList} for any {@link Renderer}.
 * Interaction arrives as abstract calls (`pointerDown/Move/Up`, `rotate`, `flip`, `undo`, `hint`,
 * `selectNext`) and level flow as `nextLevel`/`restart`. A runtime layer turns pointer/touch/keyboard
 * events into these calls and renders the HUD; this scene knows nothing of the DOM.
 *
 * Determinism: a level is a pure function of `seed + level number + config`.
 *
 * @module
 */

import { type DisplayList, DisplayListBuilder } from "../engine/render/draw-command.ts";
import { DEFAULT_CONFIG, normalizeConfig, type ShapesConfig } from "./config.ts";
import { buildLevel } from "./level.ts";
import { GameState } from "./game.ts";
import { drawGame } from "./draw.ts";
import { type Score, scoreLevel } from "./scoring.ts";

/** The public, headless scene contract. */
export interface ShapesScene {
	/** The live, normalised configuration. */
	readonly config: ShapesConfig;
	/** The current level's game state. */
	readonly game: GameState;
	/** 1-based current level number. */
	readonly levelNumber: number;
	/** Total simulated time, ms. */
	readonly time: number;
	/** Whether the current level is solved. */
	readonly solved: boolean;
	/** Moves made this level. */
	readonly moves: number;
	/** This level's par (minimum moves). */
	readonly par: number;
	/** Elapsed solve time this level, ms. */
	readonly elapsedMs: number;

	/** Advance the simulation by `dtMs` (animations + timer). */
	update(dtMs: number): void;
	/** Produce this frame's renderer-agnostic {@link DisplayList}. */
	collect(width: number, height: number): DisplayList;
	/** Notify of a viewport resize. */
	resize(width: number, height: number): void;
	/** Apply a partial config change (rebuilds the level if generation-affecting). */
	setConfig(patch: Partial<ShapesConfig>): void;

	/** Begin a drag at a screen point; returns whether a piece was grabbed. */
	pointerDown(x: number, y: number): boolean;
	/** Continue a drag. */
	pointerMove(x: number, y: number): void;
	/** End a drag (snap or spring back). */
	pointerUp(): void;
	/** Rotate a piece 90° CW (defaults to the selected/dragged one). */
	rotate(id?: number): void;
	/** Rotate a piece 90° CCW (defaults to the selected/dragged one). */
	rotateCCW(id?: number): void;
	/** Flip (mirror) a piece (defaults to the selected/dragged one). */
	flip(id?: number): void;
	/** Undo the most recent placement. */
	undo(): void;
	/** Remove one specific placed piece from the board (the double-tap-on-board gesture). */
	removePlaced(id: number): boolean;
	/** Topmost piece (including placed) under a screen point, or `null` — for tap gestures. */
	pieceAt(x: number, y: number): number | null;
	/** Use a hint (auto-solve one piece for a move penalty). */
	hint(): void;
	/** Cycle selection to the next unplaced piece. */
	selectNext(): void;

	/** Advance to the next level. */
	nextLevel(): void;
	/** Restart the current level. */
	restart(): void;
	/** A score snapshot for the current level. */
	score(): Score;
}

/** Config keys that change level generation (and so require a rebuild). */
const STRUCTURAL: (keyof ShapesConfig)[] = [
	"seed",
	"startPieces",
	"maxPieces",
	"startSize",
	"maxSize",
	"rampLevels",
	"allowFlips",
	"minPieceCells",
];

class Shapes implements ShapesScene {
	config: ShapesConfig;
	#level = 1;
	#game!: GameState;
	#builder = new DisplayListBuilder(0, 0);
	#vw = 1;
	#vh = 1;
	#time = 0;

	constructor(config: ShapesConfig) {
		this.config = config;
		this.#build();
	}

	get game(): GameState {
		return this.#game;
	}
	get levelNumber(): number {
		return this.#level;
	}
	get time(): number {
		return this.#time;
	}
	get solved(): boolean {
		return this.#game.solved;
	}
	get moves(): number {
		return this.#game.moves;
	}
	get par(): number {
		return this.#game.level.par;
	}
	get elapsedMs(): number {
		return this.#game.elapsedMs;
	}

	#build(): void {
		const level = buildLevel(this.config, this.#level);
		this.#game = new GameState(this.config, level, { w: this.#vw, h: this.#vh });
	}

	update(dtMs: number): void {
		if (!(dtMs > 0)) return;
		this.#time += dtMs;
		this.#game.tick(dtMs);
	}

	collect(width: number, height: number): DisplayList {
		if (width !== this.#vw || height !== this.#vh) this.resize(width, height);
		const out = this.#builder.reset(width, height);
		// Pass the scene's live config (not `game.config`, which is only refreshed on a structural
		// rebuild) so the `Look` knobs restyle the board immediately.
		drawGame(out, this.#game, this.config);
		return out;
	}

	resize(width: number, height: number): void {
		this.#vw = Math.max(1, width);
		this.#vh = Math.max(1, height);
		this.#game.resize(this.#vw, this.#vh);
	}

	setConfig(patch: Partial<ShapesConfig>): void {
		const next = normalizeConfig({ ...this.config, ...patch });
		const structural = STRUCTURAL.some((k) => next[k] !== this.config[k]);
		this.config = next;
		if (structural) this.#build();
	}

	pointerDown(x: number, y: number): boolean {
		return this.#game.pointerDown(x, y);
	}
	pointerMove(x: number, y: number): void {
		this.#game.pointerMove(x, y);
	}
	pointerUp(): void {
		this.#game.pointerUp();
	}
	rotate(id?: number): void {
		this.#game.rotateSelected(id);
	}
	rotateCCW(id?: number): void {
		this.#game.rotateSelectedCCW(id);
	}
	flip(id?: number): void {
		this.#game.flipSelected(id);
	}
	undo(): void {
		this.#game.undo();
	}
	removePlaced(id: number): boolean {
		return this.#game.removePlaced(id);
	}
	pieceAt(x: number, y: number): number | null {
		return this.#game.pieceAt(x, y);
	}
	hint(): void {
		this.#game.hint();
	}
	selectNext(): void {
		this.#game.selectNext();
	}

	nextLevel(): void {
		this.#level++;
		this.#build();
	}
	restart(): void {
		this.#build();
	}

	score(): Score {
		return scoreLevel(
			this.#game.moves,
			this.#game.level.par,
			this.#game.elapsedMs,
			this.config,
		);
	}
}

/** Create a headless shapes game. Pass any subset of {@link ShapesConfig}. */
export function createShapes(config: Partial<ShapesConfig> = {}): ShapesScene {
	return new Shapes(normalizeConfig({ ...DEFAULT_CONFIG, ...config }));
}
