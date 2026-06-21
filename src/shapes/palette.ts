/**
 * Shapes colour palettes — the swappable look of the board, mirroring the other domains'
 * `palette.ts`. Pure data + a couple of helpers; a renderer turns these {@link Color}s into pixels.
 *
 * @module
 */

import { type Color, hsl, rgb } from "../engine/math/color.ts";

/** A complete colour scheme for the board. */
export interface ShapesPalette {
	/** Human label for the picker. */
	label: string;
	/** The full-page background behind everything. */
	background: Color;
	/** An unfilled figure cell (the outline's interior). */
	cellEmpty: Color;
	/** The figure outline stroke. */
	outline: Color;
	/** The tray panel background. */
	tray: Color;
	/** Primary text/icon colour (HUD on-board glyphs). */
	text: Color;
	/** A correctly-placed (locked) cell's overlay tint toward this colour. */
	placed: Color;
	/** The selection highlight. */
	select: Color;
	/** The "solved!" celebratory glow. */
	celebrate: Color;
	/** Starting hue for generated piece colours. */
	hueBase: number;
	/** Saturation of generated piece colours (`0..1`). */
	sat: number;
	/** Lightness of generated piece colours (`0..1`). */
	light: number;
}

/** The palette registry. */
export const PALETTES: Record<string, ShapesPalette> = {
	slate: {
		label: "Slate",
		background: rgb(18, 22, 30),
		cellEmpty: rgb(34, 40, 52),
		outline: rgb(70, 82, 104),
		tray: rgb(26, 31, 41),
		text: rgb(208, 218, 235),
		placed: rgb(255, 255, 255),
		select: rgb(255, 236, 150),
		celebrate: rgb(140, 230, 190),
		hueBase: 205,
		sat: 0.5,
		light: 0.6,
	},
	candy: {
		label: "Candy",
		background: rgb(28, 22, 36),
		cellEmpty: rgb(48, 38, 60),
		outline: rgb(120, 96, 150),
		tray: rgb(38, 30, 50),
		text: rgb(240, 230, 248),
		placed: rgb(255, 255, 255),
		select: rgb(255, 240, 170),
		celebrate: rgb(255, 180, 220),
		hueBase: 330,
		sat: 0.62,
		light: 0.64,
	},
	mono: {
		label: "Mono",
		background: rgb(20, 20, 22),
		cellEmpty: rgb(38, 38, 42),
		outline: rgb(96, 96, 104),
		tray: rgb(28, 28, 32),
		text: rgb(224, 224, 228),
		placed: rgb(255, 255, 255),
		select: rgb(255, 255, 255),
		celebrate: rgb(220, 220, 225),
		hueBase: 0,
		sat: 0,
		light: 0.62,
	},
	ocean: {
		label: "Ocean",
		background: rgb(10, 22, 34),
		cellEmpty: rgb(20, 38, 54),
		outline: rgb(46, 78, 102),
		tray: rgb(14, 30, 44),
		text: rgb(200, 226, 240),
		placed: rgb(222, 246, 255),
		select: rgb(120, 230, 235),
		celebrate: rgb(120, 220, 200),
		hueBase: 190,
		sat: 0.55,
		light: 0.58,
	},
	sunset: {
		label: "Sunset",
		background: rgb(28, 18, 30),
		cellEmpty: rgb(48, 30, 44),
		outline: rgb(110, 70, 92),
		tray: rgb(38, 24, 36),
		text: rgb(248, 224, 224),
		placed: rgb(255, 245, 235),
		select: rgb(255, 210, 120),
		celebrate: rgb(255, 160, 120),
		hueBase: 20,
		sat: 0.62,
		light: 0.62,
	},
	forest: {
		label: "Forest",
		background: rgb(14, 24, 18),
		cellEmpty: rgb(26, 40, 30),
		outline: rgb(56, 84, 62),
		tray: rgb(18, 30, 22),
		text: rgb(214, 232, 214),
		placed: rgb(240, 250, 235),
		select: rgb(220, 230, 130),
		celebrate: rgb(160, 220, 140),
		hueBase: 110,
		sat: 0.45,
		light: 0.55,
	},
	neon: {
		label: "Neon",
		background: rgb(8, 8, 14),
		cellEmpty: rgb(20, 18, 32),
		outline: rgb(60, 50, 96),
		tray: rgb(14, 12, 22),
		text: rgb(228, 224, 248),
		placed: rgb(255, 255, 255),
		select: rgb(120, 255, 235),
		celebrate: rgb(255, 120, 235),
		hueBase: 280,
		sat: 0.85,
		light: 0.62,
	},
};

/** Palette names in registry order (the picker's option order). */
export const PALETTE_NAMES: string[] = Object.keys(PALETTES);

/** Resolve a palette by name, falling back to `slate`. */
export function getPalette(name: string): ShapesPalette {
	return PALETTES[name] ?? PALETTES.slate;
}

/** A distinct, deterministic colour for piece `index` (golden-angle hue spread). */
export function pieceColor(palette: ShapesPalette, index: number): Color {
	const hue = (palette.hueBase + index * 137.508) % 360;
	return hsl(hue, palette.sat, palette.light);
}
