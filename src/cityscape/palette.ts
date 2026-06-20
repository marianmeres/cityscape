/**
 * Palettes — the swappable visual identity of the cityscape.
 *
 * A {@link Palette} defines two complete colour moods: a **warm** end and a **cool** end. The
 * mood engine (`./mood.ts`) interpolates between them on a slow infinite cycle, so "warmer →
 * calmer → darker → slightly-less-dark" is one coherent breath rather than three unrelated
 * fades. Swapping the whole look is swapping the palette; everything downstream (sky, building
 * tints, window glow, moon, stars) is derived.
 *
 * The shipped default is a calm deep-navy night; vaporwave, ink and dawn drop in via config.
 *
 * @module
 */

/** One end (warm or cool) of a palette: every colour the mood needs, as hex strings. */
export interface MoodColors {
	/** Sky gradient, top of the sky. */
	skyTop: string;
	/** Sky gradient, middle. */
	skyMid: string;
	/** Sky gradient, just above the skyline (often a faint glow). */
	skyBottom: string;
	/** Light-pollution glow sitting at the base of the city. */
	horizonGlow: string;
	/** Silhouette colour of the farthest buildings (hazier, lighter). */
	buildingFar: string;
	/** Silhouette colour of the nearest buildings (darkest). */
	buildingNear: string;
	/** Lit-window colour. */
	window: string;
	/** Moon disc colour. */
	moon: string;
	/** Star colour. */
	star: string;
}

/** A named visual identity: a warm end + a cool end the mood cycles between. */
export interface Palette {
	/** Stable id (used in config + URL hash). */
	name: string;
	/** Human label for the panel. */
	label: string;
	/** The warm extreme of the cycle. */
	warm: MoodColors;
	/** The cool extreme of the cycle. */
	cool: MoodColors;
}

/** Calm deep-navy night — the Batman-night default (refs: classic + dense-blue skylines). */
const navy: Palette = {
	name: "navy",
	label: "Navy night",
	warm: {
		skyTop: "#0a1030",
		skyMid: "#141d44",
		skyBottom: "#26305f",
		horizonGlow: "#3a4a86",
		buildingFar: "#2b376b",
		buildingNear: "#0a1026",
		window: "#ffd9a0",
		moon: "#eef2ff",
		star: "#dfe8ff",
	},
	cool: {
		skyTop: "#05070f",
		skyMid: "#0a1022",
		skyBottom: "#121a3c",
		horizonGlow: "#1d2a55",
		buildingFar: "#1b2450",
		buildingNear: "#060912",
		window: "#bfe0ff",
		moon: "#eaf0ff",
		star: "#cfe0ff",
	},
};

/** Vaporwave — purple/magenta neon, pink moon, grid-night energy (ref: vaporwave skyline). */
const vaporwave: Palette = {
	name: "vaporwave",
	label: "Vaporwave",
	warm: {
		skyTop: "#241544",
		skyMid: "#3c1f63",
		skyBottom: "#7a3a86",
		horizonGlow: "#ff7ab0",
		buildingFar: "#3a2a5e",
		buildingNear: "#160a26",
		window: "#ff9ad5",
		moon: "#ffb6d5",
		star: "#ffd6f0",
	},
	cool: {
		skyTop: "#160d33",
		skyMid: "#241552",
		skyBottom: "#42206e",
		horizonGlow: "#9a4ad0",
		buildingFar: "#281d4a",
		buildingNear: "#0c0618",
		window: "#7af0ff",
		moon: "#d8b6ff",
		star: "#bfe0ff",
	},
};

/** Ink — near-monochrome, the darkest and most minimal mood. */
const ink: Palette = {
	name: "ink",
	label: "Ink",
	warm: {
		skyTop: "#06080e",
		skyMid: "#0b0f1a",
		skyBottom: "#161d28",
		horizonGlow: "#27313f",
		buildingFar: "#1a212d",
		buildingNear: "#04060a",
		window: "#e8d6b4",
		moon: "#f2f5fa",
		star: "#ffffff",
	},
	cool: {
		skyTop: "#04050a",
		skyMid: "#080b13",
		skyBottom: "#10151e",
		horizonGlow: "#1c242f",
		buildingFar: "#141a24",
		buildingNear: "#020308",
		window: "#cdd8e6",
		moon: "#eef2f8",
		star: "#eaf2ff",
	},
};

/** Dawn — deep teal-blue with a warm pre-dawn band low on the horizon. */
const dawn: Palette = {
	name: "dawn",
	label: "Pre-dawn",
	warm: {
		skyTop: "#0c1a2c",
		skyMid: "#1a3450",
		skyBottom: "#b67a4e",
		horizonGlow: "#e6a35c",
		buildingFar: "#244257",
		buildingNear: "#081420",
		window: "#ffe0b0",
		moon: "#fff0d6",
		star: "#dff0ff",
	},
	cool: {
		skyTop: "#08121f",
		skyMid: "#102536",
		skyBottom: "#2a516e",
		horizonGlow: "#4f7ea0",
		buildingFar: "#1a3346",
		buildingNear: "#050d16",
		window: "#bfe0ff",
		moon: "#eaf4ff",
		star: "#cfe6ff",
	},
};

/** All bundled palettes, keyed by `name`. */
export const PALETTES: Record<string, Palette> = { navy, vaporwave, ink, dawn };

/** Palette names in display order (drives the panel's palette select). */
export const PALETTE_NAMES: readonly string[] = ["navy", "vaporwave", "ink", "dawn"];

/** Look up a palette by name, falling back to the navy default. */
export function getPalette(name: string): Palette {
	return PALETTES[name] ?? navy;
}
