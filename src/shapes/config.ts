/**
 * The shapes configuration: a schema-driven config that feeds both the simulation and the
 * (optional) control panel, exactly like the other domains. The difficulty curve and the scoring
 * constants live here as data — so tuning the game is a config edit, not a code change.
 *
 * @module
 */

import {
	buildDefaults as buildSchemaDefaults,
	type ConfigField,
	normalizeConfig as normalizeBySchema,
} from "../engine/config/schema.ts";
import { PALETTE_NAMES, PALETTES } from "./palette.ts";

export type {
	ConfigField,
	RangeField,
	SeedField,
	SelectField,
	ToggleField,
} from "../engine/config/schema.ts";

/** Panel grouping. */
export type FieldGroup = "Game" | "Look" | "Popup" | "Difficulty" | "Scoring";

/** Fully-resolved configuration. Keys mirror {@link CONFIG_SCHEMA} exactly. */
export interface ShapesConfig {
	// Game
	seed: string;
	palette: string;
	// Look (live styling — read each frame by `draw.ts`; `vignette` is a renderer post-pass)
	vignette: number;
	cornerRadius: number;
	borderWidth: number;
	borderAlpha: number;
	gloss: number;
	pieceGlow: number;
	bgShade: number;
	// Popup (the start/solved cards — DOM chrome; colours follow the palette, these tune the rest)
	panelRadius: number;
	panelShadow: number;
	panelBlur: number;
	panelOpacity: number;
	// Difficulty (the curve — `difficulty.ts` reads these)
	startPieces: number;
	maxPieces: number;
	startSize: number;
	maxSize: number;
	rampLevels: number;
	allowFlips: boolean;
	minPieceCells: number;
	// Scoring
	hintPenalty: number;
	parSlack: number;
}

/** The schema (also the panel's render order). */
export const CONFIG_SCHEMA: ConfigField[] = [
	// ── Game ───────────────────────────────────────────────────────────
	{
		key: "seed",
		label: "Seed",
		group: "Game",
		type: "seed",
		default: "shapes",
		help: "Same seed + settings reproduces the exact sequence of levels.",
	},
	{
		key: "palette",
		label: "Palette",
		group: "Game",
		type: "select",
		default: "slate",
		options: PALETTE_NAMES.map((n) => ({ value: n, label: PALETTES[n].label })),
	},
	// ── Look ───────────────────────────────────────────────────────────
	{
		key: "vignette",
		label: "Vignette",
		group: "Look",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.35,
		help: "Darken the frame toward the corners (+ faint grain). 0 = off.",
	},
	{
		key: "bgShade",
		label: "Backdrop shade",
		group: "Look",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.3,
		help: "Vertical lift→shadow gradient over the background, for depth. 0 = flat.",
	},
	{
		key: "cornerRadius",
		label: "Corner round",
		group: "Look",
		type: "range",
		min: 0,
		max: 0.5,
		step: 0.02,
		default: 0.18,
		help: "Round the cells, tiles and tray (fraction of a cell). 0 = sharp squares.",
	},
	{
		key: "borderWidth",
		label: "Border weight",
		group: "Look",
		type: "range",
		min: 0.02,
		max: 0.2,
		step: 0.01,
		default: 0.07,
		help: "Grid-line and tile-border thickness (fraction of a cell).",
	},
	{
		key: "borderAlpha",
		label: "Border opacity",
		group: "Look",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0,
		help:
			"Opacity of a resting piece's border. 0 = invisible; the active (selected/dragged) " +
			"piece always shows its highlight.",
	},
	{
		key: "gloss",
		label: "Tile gloss",
		group: "Look",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.5,
		help: "Strength of the top-light sheen on each tile. 0 = flat matte.",
	},
	{
		key: "pieceGlow",
		label: "Piece glow",
		group: "Look",
		type: "range",
		min: 0,
		max: 0.8,
		step: 0.05,
		default: 0,
		help: "A soft coloured halo behind each piece (neon look). 0 = off.",
	},
	// ── Popup (start / solved cards) ────────────────────────────────────
	{
		key: "panelRadius",
		label: "Popup round",
		group: "Popup",
		type: "range",
		min: 0,
		max: 40,
		step: 1,
		default: 18,
		help: "Corner radius of the start/solved cards, in pixels.",
	},
	{
		key: "panelShadow",
		label: "Popup shadow",
		group: "Popup",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.7,
		help: "Drop-shadow strength under the cards. 0 = flat.",
	},
	{
		key: "panelBlur",
		label: "Popup blur",
		group: "Popup",
		type: "range",
		min: 0,
		max: 24,
		step: 1,
		default: 4,
		help: "Backdrop blur of the dimmed area behind a card, in pixels.",
	},
	{
		key: "panelOpacity",
		label: "Dim strength",
		group: "Popup",
		type: "range",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.6,
		help: "How strongly the board is dimmed behind a card.",
	},
	// ── Difficulty ─────────────────────────────────────────────────────
	{
		key: "startPieces",
		label: "Start pieces",
		group: "Difficulty",
		type: "range",
		min: 2,
		max: 6,
		step: 1,
		default: 2,
		help: "How many pieces level 1 is cut into.",
	},
	{
		key: "maxPieces",
		label: "Max pieces",
		group: "Difficulty",
		type: "range",
		min: 3,
		max: 12,
		step: 1,
		default: 7,
		help: "Piece count at the top of the difficulty ramp.",
	},
	{
		key: "startSize",
		label: "Start size",
		group: "Difficulty",
		type: "range",
		min: 2,
		max: 6,
		step: 1,
		default: 3,
		help: "Figure side (cells) at level 1.",
	},
	{
		key: "maxSize",
		label: "Max size",
		group: "Difficulty",
		type: "range",
		min: 4,
		max: 10,
		step: 1,
		default: 7,
		help: "Figure side (cells) at the top of the ramp.",
	},
	{
		key: "rampLevels",
		label: "Ramp length",
		group: "Difficulty",
		type: "range",
		min: 4,
		max: 30,
		step: 1,
		default: 12,
		help: "Levels taken to climb from start to max difficulty.",
	},
	{
		key: "allowFlips",
		label: "Allow flips",
		group: "Difficulty",
		type: "toggle",
		default: true,
		help: "Let later levels scramble pieces with a mirror, not just rotations.",
	},
	{
		key: "minPieceCells",
		label: "Min piece size",
		group: "Difficulty",
		type: "range",
		min: 1,
		max: 4,
		step: 1,
		default: 2,
		help: "Smallest allowed piece, in cells.",
	},
	// ── Scoring ─────────────────────────────────────────────────────────
	{
		key: "hintPenalty",
		label: "Hint penalty",
		group: "Scoring",
		type: "range",
		min: 0,
		max: 8,
		step: 1,
		default: 3,
		help: "Moves added each time you use a hint.",
	},
	{
		key: "parSlack",
		label: "2-star slack",
		group: "Scoring",
		type: "range",
		min: 1,
		max: 3,
		step: 0.1,
		default: 1.5,
		help: "Solve within par × this for two stars (par itself earns three).",
	},
];

/** Build the default config object from the schema's `default`s. */
export function buildDefaults(schema: ConfigField[] = CONFIG_SCHEMA): ShapesConfig {
	return buildSchemaDefaults<ShapesConfig>(schema);
}

/** The default configuration. */
export const DEFAULT_CONFIG: ShapesConfig = buildDefaults();

/** Group order for the panel. */
export const GROUP_ORDER: FieldGroup[] = [
	"Game",
	"Look",
	"Popup",
	"Difficulty",
	"Scoring",
];

/** Coerce and clamp arbitrary input onto a valid {@link ShapesConfig}. */
export function normalizeConfig(input: unknown): ShapesConfig {
	return normalizeBySchema<ShapesConfig>(CONFIG_SCHEMA, input);
}
