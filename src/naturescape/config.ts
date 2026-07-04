/**
 * The naturescape configuration: a typed schema that drives *both* the simulation and the
 * auto-generated control panel.
 *
 * {@link CONFIG_SCHEMA} is the single source of truth — an array of typed field descriptors with
 * ranges, options and grouping (the descriptor types + the `buildDefaults`/`normalizeConfig`
 * machinery live in the engine, shared with the cityscape). {@link DEFAULT_CONFIG} is derived from
 * it, the panel is rendered from it, and {@link normalizeConfig} clamps/validates arbitrary input
 * (e.g. a value decoded from the URL hash) back onto it. Adding a knob is a one-line schema edit.
 *
 * @module
 */

import {
	buildDefaults as buildSchemaDefaults,
	type ConfigField,
	normalizeConfig as normalizeBySchema,
} from "../engine/config/schema.ts";
import { PALETTE_NAMES, PALETTES } from "./palette.ts";
import { SEASON_NAMES, SEASONS } from "./season.ts";

// Re-export the (domain-agnostic) field-descriptor types for consumers of this config.
export type {
	ConfigField,
	RangeField,
	SeedField,
	SelectField,
	ToggleField,
} from "../engine/config/schema.ts";

/** UI grouping for panel layout. */
export type FieldGroup =
	| "Camera"
	| "Land"
	| "Day"
	| "Season"
	| "Weather"
	| "Wildlife"
	| "Sky"
	| "Audio"
	| "Debug";

/** Fully-resolved configuration. Keys mirror {@link CONFIG_SCHEMA} exactly. */
export interface NatureConfig {
	// Camera
	cameraSpeed: number;
	cameraDirection: "right" | "left";
	zoom: number;
	cameraHeight: number;
	verticalDrift: number;
	pointerParallax: boolean;
	// Land
	seed: string;
	parallaxLayers: number;
	spawnDensity: number;
	waterLevel: number;
	bankHeight: number;
	mountains: number;
	biomeVariety: number;
	biomeScale: number;
	// Day
	palette: string;
	dayCycleSeconds: number;
	brightness: number;
	warmth: number;
	haze: number;
	vignette: number;
	// Season
	season: string;
	seasonCycle: boolean;
	seasonCycleSeconds: number;
	// Weather
	rain: number;
	snowfall: number;
	rainbow: number;
	sunRays: number;
	wind: number;
	// Wildlife
	wildlife: number;
	// Sky
	clouds: number;
	birds: number;
	flyers: number;
	// Audio
	audioEnabled: boolean;
	audioVolume: number;
	// Debug
	showStats: boolean;
}

/** The schema: order here is the order the panel renders. */
export const CONFIG_SCHEMA: ConfigField[] = [
	// ── Camera ─────────────────────────────────────────────────────────
	{
		key: "cameraSpeed",
		label: "Speed",
		group: "Camera",
		type: "range",
		min: 0,
		max: 120,
		step: 1,
		default: 30,
		unit: "u/s",
		help: "Scroll speed. 0 holds the landscape still.",
	},
	{
		key: "cameraDirection",
		label: "Direction",
		group: "Camera",
		type: "select",
		default: "right",
		options: [
			{ value: "right", label: "→ right" },
			{ value: "left", label: "← left" },
		],
	},
	{
		key: "zoom",
		label: "Zoom",
		group: "Camera",
		type: "range",
		min: 0.5,
		max: 2,
		step: 0.05,
		default: 0.85,
		help: "Camera distance. Higher zooms in (bigger trees, fewer on screen).",
	},
	{
		key: "cameraHeight",
		label: "Vertical aim",
		group: "Camera",
		type: "range",
		min: -0.25,
		max: 0.25,
		step: 0.01,
		default: -0.04,
		help: "Pan the camera up (more sky) or down (more water).",
	},
	{
		key: "verticalDrift",
		label: "Vertical drift",
		group: "Camera",
		type: "range",
		min: 0,
		max: 0.1,
		step: 0.005,
		default: 0.015,
		help: "Amount of slow automatic up/down float. 0 holds still.",
	},
	{
		key: "pointerParallax",
		label: "Pointer parallax",
		group: "Camera",
		type: "toggle",
		default: false,
		help: "Layers sway slightly toward the pointer (horizontally and vertically).",
	},
	// ── Land ───────────────────────────────────────────────────────────
	{
		key: "seed",
		label: "Seed",
		group: "Land",
		type: "seed",
		default: "sunny meadow",
		help: "Same seed + settings reproduces the exact landscape.",
	},
	{
		key: "parallaxLayers",
		label: "Depth layers",
		group: "Land",
		type: "range",
		min: 2,
		max: 6,
		step: 1,
		default: 4,
		help: "Number of parallax land bands (rolling hills front to back).",
	},
	{
		key: "spawnDensity",
		label: "Density",
		group: "Land",
		type: "range",
		min: 0.4,
		max: 1.8,
		step: 0.05,
		default: 0.75,
		help: "How tightly trees, cabins and rocks pack in.",
	},
	{
		key: "waterLevel",
		label: "Water",
		group: "Land",
		type: "range",
		min: 0,
		max: 0.5,
		step: 0.02,
		default: 0.16,
		help: "Fraction of the bottom that is calm water (lake/river). 0 = no water.",
	},
	{
		key: "bankHeight",
		label: "Bank",
		group: "Land",
		type: "range",
		min: 0,
		max: 0.07,
		step: 0.005,
		default: 0.02,
		help: "Grassy bank between the land and the water.",
	},
	{
		key: "mountains",
		label: "Mountains",
		group: "Land",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.8,
		help: "Prominence of the distant mountain range. 0 = open horizon.",
	},
	{
		key: "biomeVariety",
		label: "Biome journey",
		group: "Land",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.4,
		help:
			"Drift between meadow, forest and alpine as you scroll. 0 = uniform landscape.",
	},
	{
		key: "biomeScale",
		label: "Region length",
		group: "Land",
		type: "range",
		min: 1,
		max: 12,
		step: 0.5,
		default: 5,
		help: "How long each meadow/forest stretch lasts (world units). Higher = longer.",
	},
	// ── Day ────────────────────────────────────────────────────────────
	{
		key: "palette",
		label: "Light",
		group: "Day",
		type: "select",
		default: "day",
		options: PALETTE_NAMES.map((n) => ({
			value: n,
			label: PALETTES[n].label,
		})),
	},
	{
		key: "dayCycleSeconds",
		label: "Day length",
		group: "Day",
		type: "range",
		min: 15,
		max: 600,
		step: 5,
		default: 120,
		unit: "s",
		help: "Seconds for one sunrise → midday → golden dusk → sunrise breath.",
	},
	{
		key: "brightness",
		label: "Brightness",
		group: "Day",
		type: "range",
		min: 0.3,
		max: 1,
		step: 0.02,
		default: 0.82,
		help: "Overall daylight. Stays bright — this is a day scene.",
	},
	{
		key: "warmth",
		label: "Warmth",
		group: "Day",
		type: "range",
		min: 0,
		max: 1,
		step: 0.02,
		default: 0.5,
		help: "Bias the day toward warm/golden (1) or cool/midday (0).",
	},
	{
		key: "haze",
		label: "Haze",
		group: "Day",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.4,
		help: "Atmospheric haze softening the distant mountains. 0 = crystal clear.",
	},
	{
		key: "vignette",
		label: "Vignette",
		group: "Day",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 1,
		help: "Darken the frame toward the corners (+ faint grain). 0 = off.",
	},
	// ── Season ─────────────────────────────────────────────────────────
	{
		key: "season",
		label: "Season",
		group: "Season",
		type: "select",
		default: "summer",
		options: SEASON_NAMES.map((n) => ({
			value: n,
			label: SEASONS[n].label,
		})),
	},
	{
		key: "seasonCycle",
		label: "Cycle seasons",
		group: "Season",
		type: "toggle",
		default: false,
		help: "Slowly drift spring → summer → autumn → winter and round again.",
	},
	{
		key: "seasonCycleSeconds",
		label: "Year length",
		group: "Season",
		type: "range",
		min: 30,
		max: 1200,
		step: 10,
		default: 300,
		unit: "s",
		help: "Seconds for one full year when 'Cycle seasons' is on.",
	},
	// ── Weather ────────────────────────────────────────────────────────
	{
		key: "rain",
		label: "Rain",
		group: "Weather",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0,
		help: "Drifting rain + ripples on the water. Clouds thicken with it.",
	},
	{
		key: "snowfall",
		label: "Snowfall",
		group: "Weather",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0,
		help: "Falling snow. Lovely with the winter season.",
	},
	{
		key: "rainbow",
		label: "Rainbow",
		group: "Weather",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0,
		help: "A soft arc, brightest while it's raining in the sun.",
	},
	{
		key: "sunRays",
		label: "Sun rays",
		group: "Weather",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.4,
		help: "God-rays fanning down from the sun through the clouds.",
	},
	{
		key: "wind",
		label: "Wind",
		group: "Weather",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.3,
		help: "Sways the trees, tilts the rain, hurries the clouds.",
	},
	// ── Wildlife ───────────────────────────────────────────────────────
	{
		key: "wildlife",
		label: "Wildlife",
		group: "Wildlife",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.6,
		help: "Deer grazing the hills, fish rising in the water, butterflies.",
	},
	// ── Sky ────────────────────────────────────────────────────────────
	{
		key: "clouds",
		label: "Clouds",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.6,
	},
	{
		key: "birds",
		label: "Birds",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.7,
	},
	{
		key: "flyers",
		label: "Balloons & co.",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.6,
		help: "Rare crossers: a hot-air balloon, a soaring eagle, a drifting leaf.",
	},
	// ── Audio ──────────────────────────────────────────────────────────
	{
		key: "audioEnabled",
		label: "Ambient sound",
		group: "Audio",
		type: "toggle",
		default: false,
		help: "Synthesised breeze + sparse birdsong & water. Off by default.",
	},
	{
		key: "audioVolume",
		label: "Volume",
		group: "Audio",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.3,
	},
	// ── Debug ──────────────────────────────────────────────────────────
	{
		key: "showStats",
		label: "Show stats",
		group: "Debug",
		type: "toggle",
		default: false,
	},
];

/** Build the default config object from the schema's `default`s. */
export function buildDefaults(
	schema: ConfigField[] = CONFIG_SCHEMA,
): NatureConfig {
	return buildSchemaDefaults<NatureConfig>(schema);
}

/** The default configuration (a sunny summer meadow). */
export const DEFAULT_CONFIG: NatureConfig = buildDefaults();

/** Group order for the panel. */
export const GROUP_ORDER: FieldGroup[] = [
	"Camera",
	"Land",
	"Day",
	"Season",
	"Weather",
	"Wildlife",
	"Sky",
	"Audio",
	"Debug",
];

/**
 * Coerce and clamp arbitrary input onto a valid {@link NatureConfig}, field by field. Unknown keys
 * are dropped; out-of-range numbers clamp; invalid selects fall back to their default; anything
 * missing inherits {@link DEFAULT_CONFIG}.
 */
export function normalizeConfig(input: unknown): NatureConfig {
	return normalizeBySchema<NatureConfig>(CONFIG_SCHEMA, input);
}
