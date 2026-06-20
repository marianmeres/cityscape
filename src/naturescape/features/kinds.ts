/**
 * Land-feature archetypes and their procedural generators.
 *
 * A {@link FeatureSpec} is a renderer-agnostic description of one feature's *shape* (no colours, no
 * screen coordinates — those come from the mood and camera at draw time). Each archetype has a
 * generator that samples a plausible spec from an {@link Rng}. Zones (`../generation/zone.ts`)
 * decide *which* archetypes appear and how often, which is how the landscape "makes sense" (pines
 * and rocks gather in the foothills, reeds hug the water, cabins dot the meadow).
 *
 * This mirrors the cityscape's `buildings/kinds.ts` — the land's "buildings" are its trees.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";

/** The land-feature archetypes. `hill` is wide and low (far bands); the rest stand on the ground. */
export type FeatureKind =
	| "broadleaf"
	| "pine"
	| "shrub"
	| "cabin"
	| "rock"
	| "hill"
	| "reeds";

/** A renderer-agnostic description of one feature's geometry. */
export interface FeatureSpec {
	kind: FeatureKind;
	/**
	 * Width in **viewport-height units** (same scale as {@link FeatureSpec.height}) so the
	 * silhouette's aspect ratio is realistic and constant at any window size.
	 */
	width: number;
	/** Height as a fraction of viewport height (`0..1`), so the landscape scales on resize. */
	height: number;
	/** Conifer tiers (pine only). */
	tiers: number;
	/** Sideways lean `-1..1` (trees), for a non-uniform, organic stand. */
	lean: number;
	/** Canopy lumpiness `0..1` (broadleaf/shrub) — how irregular the crown reads. */
	roundness: number;
	/** Cabin carries a chimney (with drifting smoke). */
	hasChimney: boolean;
	/** Stable per-instance roll `0..1` — small variations (bloom amount, window side, …). */
	variant: number;
}

/** Per-archetype spec generators. Each returns the *base* spec; the spawner scales it per layer. */
export const FEATURE_GENERATORS: Record<FeatureKind, (rng: Rng) => FeatureSpec> = {
	broadleaf(rng) {
		const height = rng.float(0.07, 0.16);
		const width = height * rng.float(0.72, 1.08);
		return base("broadleaf", width, height, rng, {
			lean: rng.float(-0.18, 0.18),
			roundness: rng.float(0.4, 1),
		});
	},
	pine(rng) {
		const height = rng.float(0.09, 0.2);
		const width = height * rng.float(0.42, 0.64);
		return base("pine", width, height, rng, {
			tiers: rng.int(3, 5),
			lean: rng.float(-0.08, 0.08),
		});
	},
	shrub(rng) {
		const height = rng.float(0.025, 0.05);
		const width = height * rng.float(1.4, 2.3);
		return base("shrub", width, height, rng, { roundness: rng.float(0.5, 1) });
	},
	cabin(rng) {
		const height = rng.float(0.05, 0.085);
		const width = height * rng.float(1.4, 2.1);
		return base("cabin", width, height, rng, { hasChimney: rng.bool(0.8) });
	},
	rock(rng) {
		const height = rng.float(0.02, 0.05);
		const width = height * rng.float(1.2, 2.1);
		return base("rock", width, height, rng, { roundness: rng.float(0.3, 0.8) });
	},
	hill(rng) {
		const height = rng.float(0.05, 0.14);
		const width = height * rng.float(2.6, 5.2); // wide & low rolling mound
		return base("hill", width, height, rng, {});
	},
	reeds(rng) {
		const height = rng.float(0.02, 0.045);
		const width = height * rng.float(0.5, 0.9);
		return base("reeds", width, height, rng, {});
	},
};

/** Fill a spec with sensible defaults plus the per-kind overrides. */
function base(
	kind: FeatureKind,
	width: number,
	height: number,
	rng: Rng,
	over: Partial<FeatureSpec>,
): FeatureSpec {
	return {
		kind,
		width,
		height,
		tiers: 4,
		lean: 0,
		roundness: 0.7,
		hasChimney: false,
		variant: rng.next(),
		...over,
	};
}

/** Generate a base {@link FeatureSpec} for an archetype. */
export function generateFeature(kind: FeatureKind, rng: Rng): FeatureSpec {
	return FEATURE_GENERATORS[kind](rng);
}
