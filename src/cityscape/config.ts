/**
 * The cityscape configuration: a typed schema that drives *both* the simulation and the
 * auto-generated control panel.
 *
 * {@link CONFIG_SCHEMA} is the single source of truth — an array of typed field descriptors with
 * ranges, options and grouping. {@link DEFAULT_CONFIG} is derived from it, the panel (`../ui`) is
 * rendered from it, and {@link normalizeConfig} clamps/validates arbitrary input (e.g. a value
 * decoded from the URL hash) back onto it. Adding a knob is a one-line schema edit.
 *
 * @module
 */

import {
	buildDefaults as buildSchemaDefaults,
	type ConfigField,
	normalizeConfig as normalizeBySchema,
} from "../engine/config/schema.ts";
import { PALETTE_NAMES, PALETTES } from "./palette.ts";

// The field-descriptor types live in the engine (the schema system is domain-agnostic); re-export
// them here so existing `@marianmeres/cityscape` consumers keep importing them from the config.
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
	| "World"
	| "Mood"
	| "Lights"
	| "Sky"
	| "Audio"
	| "Debug";

/** Fully-resolved configuration. Keys mirror {@link CONFIG_SCHEMA} exactly. */
export interface CityscapeConfig {
	// Camera
	cameraSpeed: number;
	cameraDirection: "right" | "left";
	zoom: number;
	cameraHeight: number;
	verticalDrift: number;
	pointerParallax: boolean;
	// World
	seed: string;
	parallaxLayers: number;
	spawnDensity: number;
	waterLevel: number;
	shoreHeight: number;
	buildingShading: number;
	neon: number;
	biomeVariety: number;
	biomeScale: number;
	// Mood
	palette: string;
	moodCycleSeconds: number;
	darkness: number;
	colorTemperature: number;
	vignette: number;
	// Lights
	windowLightChance: number;
	windowToggleRate: number;
	// Sky
	moonChance: number;
	starDensity: number;
	cloudChance: number;
	birdChance: number;
	flyerChance: number;
	trafficChance: number;
	fog: number;
	aurora: number;
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
		help: "Scroll speed. 0 holds the city still.",
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
		default: 0.5,
		help: "Camera distance. Higher zooms in (bigger buildings, fewer on screen).",
	},
	{
		key: "cameraHeight",
		label: "Vertical aim",
		group: "Camera",
		type: "range",
		min: -0.25,
		max: 0.25,
		step: 0.01,
		default: -0.08,
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
		default: 0,
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
	// ── World ──────────────────────────────────────────────────────────
	{
		key: "seed",
		label: "Seed",
		group: "World",
		type: "seed",
		default: "hey ho lets go",
		help: "Same seed + settings reproduces the exact city.",
	},
	{
		key: "parallaxLayers",
		label: "Depth layers",
		group: "World",
		type: "range",
		min: 2,
		max: 6,
		step: 1,
		default: 4,
		help: "Number of parallax building bands.",
	},
	{
		key: "spawnDensity",
		label: "Density",
		group: "World",
		type: "range",
		min: 0.4,
		max: 1.8,
		step: 0.05,
		default: 0.5,
		help: "How tightly buildings pack in.",
	},
	{
		key: "waterLevel",
		label: "Water",
		group: "World",
		type: "range",
		min: 0,
		max: 0.5,
		step: 0.02,
		default: 0.1,
		help: "Fraction of the bottom that is calm water (sea/river). 0 = no water.",
	},
	{
		key: "shoreHeight",
		label: "Shore",
		group: "World",
		type: "range",
		min: 0,
		max: 0.07,
		step: 0.005,
		default: 0.025,
		help: "Lit shore/embankment band between the city and the water.",
	},
	{
		key: "buildingShading",
		label: "Facade light",
		group: "World",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.5,
		help:
			"Soft top-light on near buildings so silhouettes read as volumes. 0 = flat.",
	},
	{
		key: "neon",
		label: "Neon signs",
		group: "World",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.4,
		help: "Rare hue-cycling rooftop signs on near city buildings. 0 = none.",
	},
	{
		key: "biomeVariety",
		label: "Biome journey",
		group: "World",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.3,
		help:
			"Drift between dense city and open outskirts as you scroll. 0 = uniform city.",
	},
	{
		key: "biomeScale",
		label: "Region length",
		group: "World",
		type: "range",
		min: 1,
		max: 12,
		step: 0.5,
		default: 4.5,
		help:
			"How long each city/outskirts stretch lasts (world units). Higher = longer.",
	},
	// ── Mood ───────────────────────────────────────────────────────────
	{
		key: "palette",
		label: "Palette",
		group: "Mood",
		type: "select",
		default: "dawn",
		options: PALETTE_NAMES.map((n) => ({
			value: n,
			label: PALETTES[n].label,
		})),
	},
	{
		key: "moodCycleSeconds",
		label: "Mood cycle",
		group: "Mood",
		type: "range",
		min: 15,
		max: 600,
		step: 5,
		default: 90,
		unit: "s",
		help: "Seconds for one warm→cool→warm breath.",
	},
	{
		key: "darkness",
		label: "Darkness",
		group: "Mood",
		type: "range",
		min: 0,
		max: 1,
		step: 0.02,
		default: 0.76,
	},
	{
		key: "colorTemperature",
		label: "Temperature",
		group: "Mood",
		type: "range",
		min: 0,
		max: 1,
		step: 0.02,
		default: 0.48,
		help: "Bias the cycle toward warm (0) or cool (1).",
	},
	{
		key: "vignette",
		label: "Vignette",
		group: "Mood",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 1,
		help: "Darken the frame toward the corners (+ faint grain). 0 = off.",
	},
	// ── Lights ─────────────────────────────────────────────────────────
	{
		key: "windowLightChance",
		label: "Lit windows",
		group: "Lights",
		type: "range",
		min: 0,
		max: 1,
		step: 0.02,
		default: 0.08,
	},
	{
		key: "windowToggleRate",
		label: "Flicker",
		group: "Lights",
		type: "range",
		min: 0,
		max: 1,
		step: 0.02,
		default: 0.48,
		help: "How often windows switch. Low stays calm.",
	},
	// ── Sky ────────────────────────────────────────────────────────────
	{
		key: "moonChance",
		label: "Moon",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.1,
	},
	{
		key: "starDensity",
		label: "Stars",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 1,
	},
	{
		key: "cloudChance",
		label: "Clouds",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.9,
	},
	{
		key: "birdChance",
		label: "Birds",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.95,
	},
	{
		key: "flyerChance",
		label: "Planes & co.",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.95,
		help: "Rare crossers: planes, satellites, shooting stars.",
	},
	{
		key: "trafficChance",
		label: "Traffic",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.1,
		help: "Sparse headlights crossing the waterfront. Needs a shore to drive on.",
	},
	{
		key: "fog",
		label: "Ground fog",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0,
		help: "Low mist hazing the base of the skyline. 0 = clear.",
	},
	{
		key: "aurora",
		label: "Aurora",
		group: "Sky",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0,
		help: "Faint sky shimmer (navy & vaporwave palettes only). 0 = off.",
	},
	// ── Audio ──────────────────────────────────────────────────────────
	{
		key: "audioEnabled",
		label: "Ambient sound",
		group: "Audio",
		type: "toggle",
		default: false,
		help: "Synthesised drone + sparse city sounds. Off by default.",
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
): CityscapeConfig {
	return buildSchemaDefaults<CityscapeConfig>(schema);
}

/** The default configuration (the calm navy night). */
export const DEFAULT_CONFIG: CityscapeConfig = buildDefaults();

/** Group order for the panel. */
export const GROUP_ORDER: FieldGroup[] = [
	"Camera",
	"World",
	"Mood",
	"Lights",
	"Sky",
	"Audio",
	"Debug",
];

/**
 * Coerce and clamp arbitrary input onto a valid {@link CityscapeConfig}, field by field. Unknown
 * keys are dropped; out-of-range numbers clamp; invalid selects fall back to their default.
 * Anything missing inherits {@link DEFAULT_CONFIG}.
 */
export function normalizeConfig(input: unknown): CityscapeConfig {
	return normalizeBySchema<CityscapeConfig>(CONFIG_SCHEMA, input);
}
