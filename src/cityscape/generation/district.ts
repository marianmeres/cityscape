/**
 * The zoning state machine — why the skyline "makes sense".
 *
 * A real city is a sequence of districts (a downtown of towers, a residential stretch of houses,
 * an industrial belt of factories…) with sensible transitions between them. This models that as
 * a small Markov-ish FSM: each district permits certain building archetypes and only certain
 * *next* districts, so a factory never ends up wedged between two skyscrapers — a `park` always
 * buffers the industrial belt from downtown. Pure and deterministic from its {@link Rng}.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import type { BuildingKind } from "../buildings/kinds.ts";

/** The zoning districts. `countryside` is biome-only (never reached without the journey on). */
export type District =
	| "downtown"
	| "commercial"
	| "residential"
	| "industrial"
	| "park"
	| "countryside"
	| "coast";

interface DistrictRule {
	/** Archetypes allowed here, and their relative weights. `null` = an open gap (park). */
	kinds: (BuildingKind | null)[];
	kindWeights: number[];
	/** Gap range (viewport-height units) to leave after each building. */
	gap: [number, number];
	/** How many slots this district runs for. */
	run: [number, number];
	/** Legal successor districts and their weights. */
	next: District[];
	nextWeights: number[];
}

const RULES: Record<District, DistrictRule> = {
	downtown: {
		kinds: ["skyscraper", "tower", "landmark"],
		kindWeights: [5, 3, 1],
		gap: [-0.006, 0.018],
		run: [3, 7],
		next: ["downtown", "commercial", "park"],
		nextWeights: [2, 4, 2],
	},
	commercial: {
		kinds: ["tower", "midrise", "skyscraper"],
		kindWeights: [3, 4, 1],
		gap: [0.006, 0.028],
		run: [3, 6],
		next: ["commercial", "downtown", "residential", "park"],
		nextWeights: [2, 3, 3, 1],
	},
	residential: {
		kinds: ["house", "midrise"],
		kindWeights: [5, 2],
		gap: [0.01, 0.04],
		run: [4, 8],
		next: ["residential", "commercial", "park", "industrial"],
		nextWeights: [3, 3, 2, 2],
	},
	industrial: {
		kinds: ["factory", "midrise"],
		kindWeights: [4, 1],
		gap: [0.018, 0.056],
		run: [2, 5],
		// Never straight to downtown/commercial — a park or residential belt buffers it.
		next: ["industrial", "park", "residential"],
		nextWeights: [2, 3, 3],
	},
	park: {
		kinds: [null],
		kindWeights: [1],
		gap: [0.07, 0.15],
		run: [1, 2],
		next: ["downtown", "commercial", "residential", "industrial"],
		nextWeights: [3, 3, 3, 2],
	},
	// Biome-only: reached solely via BIOME_SUCCESSORS when the journey is on. Trees, the odd
	// farmhouse, barns, silos and distant hills, with wide open gaps between them.
	countryside: {
		kinds: ["tree", "house", "barn", "silo", "hill", null],
		kindWeights: [5, 2, 2, 1, 2, 3],
		gap: [0.03, 0.1],
		run: [4, 9],
		next: ["countryside", "residential", "park"],
		nextWeights: [4, 2, 2],
	},
	// Biome-only, the open low end: mostly empty shore with rolling hills and the rare cottage.
	coast: {
		kinds: ["hill", "tree", "house", null],
		kindWeights: [2, 2, 1, 6],
		gap: [0.06, 0.16],
		run: [3, 7],
		next: ["coast", "countryside", "park"],
		nextWeights: [3, 2, 2],
	},
};

/**
 * Successor districts reachable ONLY via the biome journey (never listed in any base `next`), so
 * they appear solely when `variety > 0`. Keyed by source district → `[district, base weight]`.
 */
const BIOME_SUCCESSORS: Partial<Record<District, [District, number][]>> = {
	residential: [["countryside", 4]],
	park: [["countryside", 4], ["coast", 2]],
	countryside: [["coast", 3]],
};

/** One emitted slot: a building archetype (or `null` for open space) plus the gap after it. */
export interface DistrictSlot {
	kind: BuildingKind | null;
	gap: number;
	district: District;
}

/**
 * Each district's place on the urbanism axis (`0` = open country, `1` = dense downtown). The biome
 * field's local urbanism is matched against these to bias transitions toward fitting districts.
 */
const URBANISM: Record<District, number> = {
	downtown: 1,
	commercial: 0.72,
	residential: 0.38,
	industrial: 0.28,
	park: 0.12,
	countryside: 0.18,
	coast: 0.04,
};

/**
 * Scale a transition weight by how well a candidate district's urbanism matches the local biome.
 * `variety` 0 leaves the weight untouched (so the FSM is identical to the uniform city); higher
 * values sharpen the match so the skyline drifts city↔country as you travel. Clamped to a small
 * positive so any legal successor stays barely possible (transitions never hard-lock).
 */
function biasWeight(
	weight: number,
	level: number,
	urbanism: number,
	variety: number,
): number {
	const diff = Math.abs(level - urbanism); // 0 (perfect match) .. 1 (opposite)
	const factor = Math.max(0.02, 1 + variety * 3 * (1 - 2 * diff));
	return weight * factor;
}

/**
 * A forward, infinite stream of {@link DistrictSlot}s. Walks the zoning FSM, emitting buildings
 * for the current district until its run is spent, then legally transitions.
 */
export class DistrictStream {
	#rng: Rng;
	#district: District;
	#remaining: number;

	constructor(rng: Rng, start: District = "commercial") {
		this.#rng = rng;
		this.#district = start;
		this.#remaining = this.#rollRun(start);
	}

	/** The district currently being emitted. */
	get district(): District {
		return this.#district;
	}

	#rollRun(d: District): number {
		const [lo, hi] = RULES[d].run;
		return this.#rng.int(lo, hi);
	}

	/**
	 * Emit the next slot, advancing (and transitioning) the FSM as needed. `urbanism` (0..1) is the
	 * local biome reading and `variety` (0..1) the journey strength; with `variety = 0` the biome is
	 * ignored and the stream is identical to the uniform city. Only district *transitions* are
	 * biased — kind and gap selection within a district are unchanged — and `weighted()` always
	 * consumes exactly one RNG draw, so turning the journey on never desyncs determinism. The FSM is
	 * stateful, though: a *live* change to `variety` shifts the ongoing journey irreversibly; only a
	 * freshly-constructed stream is byte-exact for a given seed (see `./biome.ts`).
	 */
	next(urbanism = 0.5, variety = 0): DistrictSlot {
		if (this.#remaining <= 0) {
			this.#district = this.#chooseNext(urbanism, variety);
			this.#remaining = this.#rollRun(this.#district);
		}
		this.#remaining--;
		const rule = RULES[this.#district];
		const kind = this.#rng.weighted(rule.kinds, rule.kindWeights);
		return { kind, gap: this.#rollGap(rule), district: this.#district };
	}

	/**
	 * Pick the next district. With `variety = 0` this is exactly the base FSM transition (so the
	 * uniform city is reproduced byte-for-byte). With the journey on it extends the legal successors
	 * with any biome-only districts reachable from here, then biases the whole set toward the local
	 * urbanism — and `weighted()` always draws once, so determinism is preserved either way.
	 */
	#chooseNext(urbanism: number, variety: number): District {
		const rule = RULES[this.#district];
		if (variety <= 0) return this.#rng.weighted(rule.next, rule.nextWeights);
		const extra = BIOME_SUCCESSORS[this.#district];
		const cands = extra ? [...rule.next, ...extra.map((e) => e[0])] : rule.next;
		const base = extra
			? [...rule.nextWeights, ...extra.map((e) => e[1])]
			: rule.nextWeights;
		const weights = cands.map((d, i) =>
			biasWeight(base[i], URBANISM[d], urbanism, variety)
		);
		return this.#rng.weighted(cands, weights);
	}

	/**
	 * Roll a gap with deliberate non-uniformity so the skyline doesn't read as evenly-spaced:
	 * mostly the district's range, but ~16% of the time buildings nearly touch (a tight cluster)
	 * and ~16% open into a wider plaza/break.
	 */
	#rollGap(rule: DistrictRule): number {
		const r = this.#rng.next();
		if (r < 0.16) return this.#rng.float(-0.006, 0.004); // touching / slight overlap
		if (r > 0.84) {
			return this.#rng.float(rule.gap[1], rule.gap[1] + 0.12); // a plaza / break
		}
		return this.#rng.float(rule.gap[0], rule.gap[1]);
	}
}
