/**
 * Palettes — the swappable *atmosphere* of the naturescape (the light, not the land).
 *
 * A {@link Palette} defines two complete light moods: a **warm** end (golden hour — low sun, peach
 * horizon) and a **cool** end (midday — high sun, bright blue). The mood engine (`./mood.ts`)
 * breathes between them on the slow day cycle, so the whole sky, the sun, the distant haze and the
 * water all shift warm→cool→warm together as one coherent day. Foliage and ground colour come from
 * the orthogonal {@link Season}; a palette only carries the sky/sun/haze/land-tone identity.
 *
 * The shipped default is a clear, cheerful blue day; golden, misty and alpine drop in via config.
 *
 * @module
 */

/** One end (warm/golden or cool/midday) of a palette — every light colour the mood needs. */
export interface MoodColors {
	/** Sky gradient, top of the sky. */
	skyTop: string;
	/** Sky gradient, middle. */
	skyMid: string;
	/** Sky gradient, just above the horizon (often a warm or pale band). */
	skyBottom: string;
	/** Warm light pooling along the horizon (the sun's glow on the air). */
	sunGlow: string;
	/** The sun disc. */
	sun: string;
	/** Silhouette tone of the farthest mountains/hills (hazier, lighter). */
	landFar: string;
	/** Body tone of the nearest hills (under the season's foliage; earthy, darker). */
	landNear: string;
	/** Calm lake/river water tone. */
	water: string;
	/** Atmospheric haze colour distant land fades toward (≈ sky near the horizon). */
	haze: string;
}

/** A named light identity: a warm (golden-hour) end + a cool (midday) end the mood cycles between. */
export interface Palette {
	/** Stable id (used in config + URL hash). */
	name: string;
	/** Human label for the panel. */
	label: string;
	/** The warm (golden-hour) extreme of the day cycle. */
	warm: MoodColors;
	/** The cool (midday) extreme of the day cycle. */
	cool: MoodColors;
}

/** Clear day — a cheerful blue sky with warm golden hours. The default. */
const day: Palette = {
	name: "day",
	label: "Clear day",
	warm: {
		skyTop: "#3f6cb0",
		skyMid: "#8aabd8",
		skyBottom: "#ffd2a0",
		sunGlow: "#ffbd72",
		sun: "#fff1cc",
		landFar: "#93b0bd",
		landNear: "#435a44",
		water: "#7196bc",
		haze: "#c2d6e6",
	},
	cool: {
		skyTop: "#2f74c8",
		skyMid: "#7cb2e8",
		skyBottom: "#d6efff",
		sunGlow: "#fff3d2",
		sun: "#fffdf4",
		landFar: "#a3c2d0",
		landNear: "#48643f",
		water: "#5fa1d2",
		haze: "#d4e8f6",
	},
};

/** Golden valley — warmer, hazier light; a soft sun-drenched afternoon all day. */
const golden: Palette = {
	name: "golden",
	label: "Golden valley",
	warm: {
		skyTop: "#5a73a8",
		skyMid: "#c2a98f",
		skyBottom: "#ffd49a",
		sunGlow: "#ffb15a",
		sun: "#ffeec0",
		landFar: "#b3a98f",
		landNear: "#5a5536",
		water: "#9a9a86",
		haze: "#e6cfa6",
	},
	cool: {
		skyTop: "#4f86bf",
		skyMid: "#a8c0cf",
		skyBottom: "#ffe7bd",
		sunGlow: "#ffd486",
		sun: "#fff6dc",
		landFar: "#aebca6",
		landNear: "#5a6238",
		water: "#86a8ad",
		haze: "#e2dcb8",
	},
};

/** Soft mist — low-contrast pastels, a dreamy hazed morning. */
const misty: Palette = {
	name: "misty",
	label: "Soft mist",
	warm: {
		skyTop: "#9fb0c8",
		skyMid: "#c8d2dd",
		skyBottom: "#f3e2d6",
		sunGlow: "#f6d9bd",
		sun: "#fff4ea",
		landFar: "#bcc7cf",
		landNear: "#5e7064",
		water: "#aebecb",
		haze: "#dfe6ec",
	},
	cool: {
		skyTop: "#8fa9c2",
		skyMid: "#c2d2df",
		skyBottom: "#e8f1f5",
		sunGlow: "#f2ecde",
		sun: "#fdfbf6",
		landFar: "#c0ccd2",
		landNear: "#5f7468",
		water: "#a8c0cd",
		haze: "#e4edf1",
	},
};

/** Alpine air — crisp, clean, slightly cool and desaturated; high-altitude clarity. */
const alpine: Palette = {
	name: "alpine",
	label: "Alpine air",
	warm: {
		skyTop: "#2f63a8",
		skyMid: "#7ba6cf",
		skyBottom: "#ecd8c0",
		sunGlow: "#ffd29a",
		sun: "#fff4dc",
		landFar: "#9fb6c2",
		landNear: "#3e5a4e",
		water: "#6fa0c0",
		haze: "#cfdfe8",
	},
	cool: {
		skyTop: "#1f5fb8",
		skyMid: "#6fa8e0",
		skyBottom: "#dceff8",
		sunGlow: "#f4f4ec",
		sun: "#ffffff",
		landFar: "#a8c2cc",
		landNear: "#42604f",
		water: "#5a9fd6",
		haze: "#d6ebf4",
	},
};

/** All bundled palettes, keyed by `name`. */
export const PALETTES: Record<string, Palette> = { day, golden, misty, alpine };

/** Palette names in display order (drives the panel's palette select). */
export const PALETTE_NAMES: readonly string[] = ["day", "golden", "misty", "alpine"];

/** Look up a palette by name, falling back to the clear-day default. */
export function getPalette(name: string): Palette {
	return PALETTES[name] ?? day;
}
