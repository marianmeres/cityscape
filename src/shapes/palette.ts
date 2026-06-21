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
