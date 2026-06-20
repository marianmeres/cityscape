/**
 * Seasons — the second axis of the naturescape's look, orthogonal to the {@link Palette}.
 *
 * Where the palette is the *light* (the time-of-day atmosphere a {@link MoodEngine} breathes
 * through), a {@link Season} is the *land*: the colour of foliage, grass, blossom and how much
 * snow lies on the ground and peaks. The mood engine blends between two adjacent seasons by a
 * `seasonT` so a slow auto-cycle drifts spring → summer → autumn → winter → spring without a hard
 * cut, and every tree, hill and meadow band derives its colour from the blended result — one
 * coherent change, not a dozen independent ones.
 *
 * @module
 */

/** Every land colour a season defines, as hex strings (parsed once by the mood engine). */
export interface SeasonColors {
	/** Lit side of a tree canopy / leafy mass. */
	foliage: string;
	/** Shaded side of the canopy (the volume cue). */
	foliageDeep: string;
	/** Tree trunks and bare branches. */
	trunk: string;
	/** Near grass / meadow band. */
	ground: string;
	/** Distant rolling-hill grass (hazier, lighter). */
	groundFar: string;
	/** Blossom / wildflower / turning-leaf accent dotted through the foliage. */
	bloom: string;
	/** How much snow lies on peaks, roofs and the ground (`0`=none, `1`=deep winter). */
	snow: number;
}

/** A named time of year. */
export interface Season {
	/** Stable id (used in config + URL hash). */
	name: string;
	/** Human label for the panel. */
	label: string;
	/** The season's land colours. */
	colors: SeasonColors;
}

const spring: Season = {
	name: "spring",
	label: "Spring",
	colors: {
		foliage: "#8ace6b",
		foliageDeep: "#4f9a52",
		trunk: "#6b4f3a",
		ground: "#8fd172",
		groundFar: "#a9d8a0",
		bloom: "#ffd1e8",
		snow: 0,
	},
};

const summer: Season = {
	name: "summer",
	label: "Summer",
	colors: {
		foliage: "#54b25a",
		foliageDeep: "#2f7d3e",
		trunk: "#5e463a",
		ground: "#6cbf57",
		groundFar: "#93c489",
		bloom: "#ffe27a",
		snow: 0,
	},
};

const autumn: Season = {
	name: "autumn",
	label: "Autumn",
	colors: {
		foliage: "#e0953e",
		foliageDeep: "#a85a2a",
		trunk: "#5a4032",
		ground: "#c9a85f",
		groundFar: "#bda874",
		bloom: "#e8543a",
		snow: 0,
	},
};

const winter: Season = {
	name: "winter",
	label: "Winter",
	colors: {
		foliage: "#7f9b91",
		foliageDeep: "#4a665f",
		trunk: "#4e463f",
		ground: "#e2ecf0",
		groundFar: "#cad8df",
		bloom: "#eaf4ff",
		snow: 1,
	},
};

/** All seasons keyed by `name`. */
export const SEASONS: Record<string, Season> = { spring, summer, autumn, winter };

/** Seasons in calendar order — drives the select *and* the auto-cycle order. */
export const SEASON_NAMES: readonly string[] = ["spring", "summer", "autumn", "winter"];

/** Look up a season by name, falling back to summer. */
export function getSeason(name: string): Season {
	return SEASONS[name] ?? summer;
}
