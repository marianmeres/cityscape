/**
 * Building archetypes and their procedural generators.
 *
 * A {@link BuildingSpec} is a renderer-agnostic description of one building's *shape* (no
 * colours, no screen coordinates — those come from the mood and camera at draw time). Each
 * archetype has a generator that samples a plausible spec from an {@link Rng}. Districts
 * (`../generation/district.ts`) decide *which* archetypes may appear and how often, which is how
 * the skyline "makes sense" (a factory never sits beside a skyscraper).
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import { clamp } from "../../engine/math/ease.ts";

/** The building archetypes. The last three are rural, surfaced only by the biome journey. */
export type BuildingKind =
	| "skyscraper"
	| "tower"
	| "midrise"
	| "house"
	| "factory"
	| "landmark"
	| "tree"
	| "barn"
	| "silo"
	| "hill";

/** How a silhouette body is drawn: a stacked box (default), an organic tree, or a rolling mound. */
export type BodyShape = "box" | "tree" | "mound";

/** Roof / crown features drawn atop the silhouette. */
export type RoofKind =
	| "flat"
	| "antenna"
	| "tank"
	| "spire"
	| "dome"
	| "chimneys"
	| "sawtooth"
	| "pitched"
	| "barrel"
	| "deco"
	| "watertower";

/** A renderer-agnostic description of one building's geometry. */
export interface BuildingSpec {
	kind: BuildingKind;
	/** Body silhouette shape (default `"box"` when omitted). */
	shape?: BodyShape;
	/**
	 * Width in **viewport-height units** (same scale as {@link BuildingSpec.height}), so the
	 * silhouette's aspect ratio is realistic and constant at any window size. A skyscraper ~0.12.
	 */
	width: number;
	/** Height as a fraction of viewport height (`0..1`), so the skyline scales on resize. */
	height: number;
	roof: RoofKind;
	/** Relative size of the roof feature (`0..1`). */
	roofScale: number;
	/** Window grid columns / rows (0 = no windows). */
	cols: number;
	rows: number;
	/** Number of stepped setbacks (skyscrapers) — 0 for a plain box. */
	setbacks: number;
}

// Window-grid density: windows per viewport-height unit, roughly one per ~13px at a 1000px-tall
// reference (so `width`/`height` are in the same vh-unit scale as everywhere else).
function gridFor(rng: Rng, width: number, height: number, density = 1): {
	cols: number;
	rows: number;
} {
	const cols = clamp(Math.round(width * 77 * density + rng.float(-1, 1)), 2, 8);
	const rows = clamp(Math.round(height * 46 * density + rng.float(-1, 1)), 1, 30);
	return { cols, rows };
}

/** Per-archetype spec generators. Each returns the *base* spec; the spawner scales it per layer. */
export const BUILDING_GENERATORS: Record<BuildingKind, (rng: Rng) => BuildingSpec> = {
	skyscraper(rng) {
		const height = rng.float(0.42, 0.74);
		const width = height * rng.float(0.18, 0.32); // ~3–5.5 : 1
		const { cols, rows } = gridFor(rng, width, height);
		return {
			kind: "skyscraper",
			width,
			height,
			roof: rng.weighted(
				["antenna", "flat", "spire", "tank", "deco"] as RoofKind[],
				[4, 3, 2, 1, 2],
			),
			roofScale: rng.float(0.5, 1),
			cols,
			rows,
			setbacks: rng.weighted([0, 1, 2], [3, 3, 2]),
		};
	},
	tower(rng) {
		const height = rng.float(0.32, 0.56);
		const width = height * rng.float(0.3, 0.52); // ~1.9–3.3 : 1
		const { cols, rows } = gridFor(rng, width, height);
		return {
			kind: "tower",
			width,
			height,
			roof: rng.weighted(
				["flat", "tank", "dome", "antenna", "barrel"] as RoofKind[],
				[4, 2, 2, 2, 2],
			),
			roofScale: rng.float(0.5, 1),
			cols,
			rows,
			setbacks: 0,
		};
	},
	midrise(rng) {
		const height = rng.float(0.16, 0.34);
		const width = height * rng.float(0.85, 1.8); // squat: ~0.55–1.2 : 1
		const { cols, rows } = gridFor(rng, width, height);
		return {
			kind: "midrise",
			width,
			height,
			roof: rng.weighted(
				["flat", "antenna", "tank", "watertower"] as RoofKind[],
				[5, 2, 2, 2],
			),
			roofScale: rng.float(0.4, 0.8),
			cols,
			rows,
			setbacks: 0,
		};
	},
	house(rng) {
		const height = rng.float(0.06, 0.13);
		const width = height * rng.float(1.3, 2.4); // wider than tall
		return {
			kind: "house",
			width,
			height,
			roof: rng.weighted(["pitched", "flat"] as RoofKind[], [3, 2]),
			roofScale: rng.float(0.5, 1),
			cols: rng.int(2, 5),
			rows: rng.int(1, 2),
			setbacks: 0,
		};
	},
	factory(rng) {
		const height = rng.float(0.12, 0.22);
		const width = height * rng.float(2.2, 4.2); // long & low
		return {
			kind: "factory",
			width,
			height,
			roof: rng.weighted(["chimneys", "sawtooth"] as RoofKind[], [3, 2]),
			roofScale: rng.float(0.6, 1),
			cols: rng.int(4, 9),
			rows: rng.int(1, 2),
			setbacks: 0,
		};
	},
	landmark(rng) {
		const height = rng.float(0.56, 0.88);
		const width = height * rng.float(0.16, 0.28); // thin & tall
		const { cols, rows } = gridFor(rng, width, height, 0.8);
		return {
			kind: "landmark",
			width,
			height,
			roof: rng.weighted(["spire", "dome", "deco"] as RoofKind[], [3, 2, 2]),
			roofScale: rng.float(0.7, 1),
			cols,
			rows,
			setbacks: rng.weighted([0, 1], [2, 3]),
		};
	},
	// ── Rural archetypes (biome journey only) ──────────────────────────
	tree(rng) {
		const height = rng.float(0.05, 0.13);
		const width = height * rng.float(0.7, 1.1);
		return {
			kind: "tree",
			shape: "tree",
			width,
			height,
			roof: "flat",
			roofScale: 0,
			cols: 0,
			rows: 0,
			setbacks: 0,
		};
	},
	barn(rng) {
		const height = rng.float(0.06, 0.11);
		const width = height * rng.float(1.6, 2.6); // long & low
		return {
			kind: "barn",
			width,
			height,
			roof: "pitched",
			roofScale: rng.float(0.7, 1),
			cols: rng.int(0, 3),
			rows: rng.int(0, 2),
			setbacks: 0,
		};
	},
	silo(rng) {
		const height = rng.float(0.1, 0.18);
		const width = height * rng.float(0.28, 0.42); // tall & narrow
		return {
			kind: "silo",
			width,
			height,
			roof: rng.weighted(["dome", "barrel"] as RoofKind[], [3, 2]),
			roofScale: rng.float(0.6, 1),
			cols: 0,
			rows: 0,
			setbacks: 0,
		};
	},
	hill(rng) {
		const height = rng.float(0.05, 0.13);
		const width = height * rng.float(2.5, 5); // wide & low rolling mound
		return {
			kind: "hill",
			shape: "mound",
			width,
			height,
			roof: "flat",
			roofScale: 0,
			cols: 0,
			rows: 0,
			setbacks: 0,
		};
	},
};

/** Generate a base {@link BuildingSpec} for an archetype. */
export function generateBuilding(kind: BuildingKind, rng: Rng): BuildingSpec {
	return BUILDING_GENERATORS[kind](rng);
}
