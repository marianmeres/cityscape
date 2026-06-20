/**
 * The zoning state machine — why the landscape "makes sense".
 *
 * A real walk through nature is a sequence of zones (an open meadow, a leafy grove, a dense forest,
 * a stony foothill, a lakeshore…) with sensible transitions between them. This models that as a
 * small Markov-ish FSM: each zone permits certain feature archetypes and only certain *next* zones,
 * so reeds gather by the water, pines and rocks climb into the foothills, and a clearing buffers
 * dense forest from open meadow. Pure and deterministic from its {@link Rng} — the direct analogue
 * of the cityscape's District FSM.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import type { FeatureKind } from "../features/kinds.ts";

/** The zones. `foothills`, `alpine` and `lakeside` are biome-only (reached only via the journey). */
export type Zone =
	| "meadow"
	| "grove"
	| "forest"
	| "clearing"
	| "lakeside"
	| "foothills"
	| "alpine";

interface ZoneRule {
	/** Archetypes allowed here, and their relative weights. `null` = open ground (a gap). */
	kinds: (FeatureKind | null)[];
	kindWeights: number[];
	/** Gap range (viewport-height units) to leave after each feature. */
	gap: [number, number];
	/** How many slots this zone runs for. */
	run: [number, number];
	/** Legal successor zones and their weights. */
	next: Zone[];
	nextWeights: number[];
}

const RULES: Record<Zone, ZoneRule> = {
	meadow: {
		kinds: ["shrub", "broadleaf", "cabin", null],
		kindWeights: [4, 2, 1, 5],
		gap: [0.02, 0.08],
		run: [4, 8],
		next: ["meadow", "grove", "clearing"],
		nextWeights: [3, 3, 2],
	},
	grove: {
		kinds: ["broadleaf", "pine", "shrub"],
		kindWeights: [5, 2, 2],
		gap: [0.0, 0.03],
		run: [3, 6],
		next: ["grove", "forest", "meadow", "clearing"],
		nextWeights: [2, 3, 3, 1],
	},
	forest: {
		kinds: ["broadleaf", "pine", "shrub"],
		kindWeights: [4, 4, 1],
		gap: [-0.005, 0.018],
		run: [4, 9],
		next: ["forest", "grove", "clearing"],
		nextWeights: [3, 3, 2],
	},
	clearing: {
		kinds: [null, "shrub", "rock"],
		kindWeights: [5, 1, 1],
		gap: [0.07, 0.16],
		run: [1, 3],
		next: ["meadow", "grove", "forest"],
		nextWeights: [3, 3, 2],
	},
	// Biome-only: reached solely via BIOME_SUCCESSORS when the journey is on.
	lakeside: {
		kinds: ["reeds", "broadleaf", "cabin", "shrub", null],
		kindWeights: [4, 2, 1, 1, 3],
		gap: [0.02, 0.07],
		run: [3, 7],
		next: ["lakeside", "meadow", "grove"],
		nextWeights: [3, 3, 2],
	},
	foothills: {
		kinds: ["rock", "pine", "hill", "shrub"],
		kindWeights: [3, 3, 2, 1],
		gap: [0.02, 0.07],
		run: [3, 7],
		next: ["foothills", "forest", "alpine", "clearing"],
		nextWeights: [3, 2, 2, 2],
	},
	alpine: {
		kinds: ["pine", "rock", "hill", null],
		kindWeights: [2, 3, 2, 3],
		gap: [0.04, 0.12],
		run: [3, 6],
		next: ["alpine", "foothills", "clearing"],
		nextWeights: [3, 3, 2],
	},
};

/**
 * Successor zones reachable ONLY via the biome journey (never listed in any base `next`), so they
 * appear solely when `variety > 0`. Keyed by source zone → `[zone, base weight]`.
 */
const BIOME_SUCCESSORS: Partial<Record<Zone, [Zone, number][]>> = {
	meadow: [["lakeside", 3]],
	clearing: [["foothills", 3], ["lakeside", 2]],
	forest: [["foothills", 3]],
	foothills: [["alpine", 3]],
};

/** One emitted slot: a feature archetype (or `null` for open ground) plus the gap after it. */
export interface ZoneSlot {
	kind: FeatureKind | null;
	gap: number;
	zone: Zone;
}

/**
 * Each zone's place on the wildness axis (`0` = open lowland, `1` = high wilds). The biome field's
 * local wildness is matched against these to bias transitions toward fitting zones.
 */
const WILDNESS: Record<Zone, number> = {
	meadow: 0.2,
	lakeside: 0.15,
	grove: 0.45,
	forest: 0.62,
	clearing: 0.12,
	foothills: 0.82,
	alpine: 0.96,
};

/**
 * Scale a transition weight by how well a candidate zone's wildness matches the local biome.
 * `variety` 0 leaves the weight untouched (so the FSM is identical to the uniform landscape); higher
 * values sharpen the match so the journey drifts lowland↔wilds as you travel. Clamped to a small
 * positive so any legal successor stays barely possible (transitions never hard-lock).
 */
function biasWeight(
	weight: number,
	level: number,
	wildness: number,
	variety: number,
): number {
	const diff = Math.abs(level - wildness); // 0 (perfect match) .. 1 (opposite)
	const factor = Math.max(0.02, 1 + variety * 3 * (1 - 2 * diff));
	return weight * factor;
}

/**
 * A forward, infinite stream of {@link ZoneSlot}s. Walks the zoning FSM, emitting features for the
 * current zone until its run is spent, then legally transitions. The optional `wildness`/`variety`
 * arguments bias *only* the transitions (kind and gap selection are untouched), and `weighted()`
 * always consumes exactly one RNG draw, so turning the journey on never desyncs determinism.
 */
export class ZoneStream {
	#rng: Rng;
	#zone: Zone;
	#remaining: number;

	constructor(rng: Rng, start: Zone = "meadow") {
		this.#rng = rng;
		this.#zone = start;
		this.#remaining = this.#rollRun(start);
	}

	/** The zone currently being emitted. */
	get zone(): Zone {
		return this.#zone;
	}

	#rollRun(z: Zone): number {
		const [lo, hi] = RULES[z].run;
		return this.#rng.int(lo, hi);
	}

	/** Emit the next slot, advancing (and transitioning) the FSM as needed. */
	next(wildness = 0.5, variety = 0): ZoneSlot {
		if (this.#remaining <= 0) {
			this.#zone = this.#chooseNext(wildness, variety);
			this.#remaining = this.#rollRun(this.#zone);
		}
		this.#remaining--;
		const rule = RULES[this.#zone];
		const kind = this.#rng.weighted(rule.kinds, rule.kindWeights);
		return { kind, gap: this.#rollGap(rule), zone: this.#zone };
	}

	/**
	 * Pick the next zone. With `variety = 0` this is exactly the base FSM transition (so the uniform
	 * landscape is reproduced byte-for-byte). With the journey on it extends the legal successors
	 * with any biome-only zones reachable from here, then biases the whole set toward the local
	 * wildness — and `weighted()` always draws once, so determinism is preserved either way.
	 */
	#chooseNext(wildness: number, variety: number): Zone {
		const rule = RULES[this.#zone];
		if (variety <= 0) return this.#rng.weighted(rule.next, rule.nextWeights);
		const extra = BIOME_SUCCESSORS[this.#zone];
		const cands = extra ? [...rule.next, ...extra.map((e) => e[0])] : rule.next;
		const baseW = extra
			? [...rule.nextWeights, ...extra.map((e) => e[1])]
			: rule.nextWeights;
		const weights = cands.map((z, i) =>
			biasWeight(baseW[i], WILDNESS[z], wildness, variety)
		);
		return this.#rng.weighted(cands, weights);
	}

	/**
	 * Roll a gap with deliberate non-uniformity so the stand doesn't read as evenly-spaced: mostly
	 * the zone's range, but ~16% of the time features nearly touch (a tight thicket) and ~16% open
	 * into a wider glade.
	 */
	#rollGap(rule: ZoneRule): number {
		const r = this.#rng.next();
		if (r < 0.16) return this.#rng.float(-0.006, 0.004); // touching / slight overlap
		if (r > 0.84) return this.#rng.float(rule.gap[1], rule.gap[1] + 0.12); // a glade
		return this.#rng.float(rule.gap[0], rule.gap[1]);
	}
}
