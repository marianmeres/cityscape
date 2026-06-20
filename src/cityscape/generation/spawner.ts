/**
 * The layer spawner — what makes the world infinite at bounded cost.
 *
 * Each building layer has one spawner that, every tick, fills the leading edge of the viewport
 * with freshly-generated buildings and recycles those that have scrolled well past the trailing
 * edge back into an object pool. Generation and recycle thresholds use hysteresis (`GEN < REC`)
 * so nothing churns at the boundary, and two district streams (one per side) let the same
 * spawner work in either scroll direction. Pure: it reads a {@link Camera} and an {@link Rng},
 * touches no DOM.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import type { Camera } from "../../engine/scene/camera.ts";
import type { Layer } from "../../engine/scene/layer.ts";
import type { CityEnv } from "../env.ts";
import { Building } from "../buildings/building.ts";
import { type BuildingKind, generateBuilding } from "../buildings/kinds.ts";
import { DistrictStream } from "./district.ts";
import type { BiomeField } from "./biome.ts";

/** Per-layer placement parameters. */
export interface SpawnerOptions {
	depth: number;
	/** Viewport fraction this layer's feet sit *above* the waterline (distant-shore stagger). */
	shoreOffset: number;
	/** Size multiplier; far layers are smaller. */
	scale: number;
	/** Archetypes to keep out of this layer (e.g. no skyscrapers up close), remapped if generated. */
	excludeKinds?: Iterable<BuildingKind>;
	/**
	 * Shared macro-zoning field. When present *and* `biomeVariety > 0`, district transitions are
	 * biased toward the local urbanism so the skyline drifts city↔country. Omitted (or variety 0) =
	 * the uniform city. Every layer shares one field so the bands agree on the journey.
	 */
	biomeField?: BiomeField;
}

/** Where an excluded archetype is downgraded to (front layers get shorter buildings). */
const SUBSTITUTE: Record<BuildingKind, BuildingKind> = {
	skyscraper: "tower",
	landmark: "tower",
	tower: "midrise",
	midrise: "house",
	house: "house",
	factory: "midrise",
	// Rural kinds are already short — they stay as-is on every band.
	tree: "tree",
	barn: "barn",
	silo: "silo",
};

const GEN_MARGIN = 340;
const REC_MARGIN = 680;
const LOOP_GUARD = 400;

/** Fills and recycles one building {@link Layer}. */
export class LayerSpawner {
	readonly layer: Layer<CityEnv>;
	readonly depth: number;

	#shoreOffset: number;
	#scale: number;
	#rng: Rng;
	#streamR: DistrictStream;
	#streamL: DistrictStream;
	#pool: Building[] = [];
	#right = 0; // local-x right edge of the rightmost building
	#left = 0; // local-x left edge of the leftmost building
	#init = false;
	#exclude: Set<BuildingKind>;
	#biomeField?: BiomeField;
	// Per-tick biome context (refreshed in `sync`): the shift that maps this layer's local-x into
	// the shared near-plane frame so every band samples the same journey, plus the live knobs.
	#biomeShift = 0;
	#biomeScale = 5;
	#biomeVariety = 0;

	constructor(layer: Layer<CityEnv>, rng: Rng, opts: SpawnerOptions) {
		this.layer = layer;
		this.depth = opts.depth;
		this.#shoreOffset = opts.shoreOffset;
		this.#scale = opts.scale;
		this.#rng = rng;
		this.#exclude = new Set(opts.excludeKinds ?? []);
		this.#biomeField = opts.biomeField;
		this.#streamR = new DistrictStream(rng.fork("right"));
		this.#streamL = new DistrictStream(rng.fork("left"));
	}

	/** Remap an archetype that is barred from this layer to a shorter substitute. */
	#allow(kind: BuildingKind): BuildingKind {
		let k = kind;
		// Walk down the substitution chain until we land on a permitted (or terminal) kind.
		for (let i = 0; i < 6 && this.#exclude.has(k); i++) {
			const next = SUBSTITUTE[k];
			if (next === k) break;
			k = next;
		}
		return k;
	}

	/** Top up the leading edges and recycle the trailing edge for the current camera. */
	sync(camera: Camera, width: number, env: CityEnv): void {
		if (!this.#init) {
			this.#left = this.#right = camera.viewLeft(this.depth);
			this.#init = true;
		}
		const litChance = env.config.windowLightChance;
		// Refresh the biome context for this tick. The shift converts a layer-local x to the shared
		// near-plane coordinate (`lx + scroll·(1−parallax)`), so a building entering at the leading
		// edge samples the same urbanism on every band — the whole frame agrees where it is.
		this.#biomeShift = camera.scroll * (1 - camera.parallaxAt(this.depth));
		this.#biomeScale = env.config.biomeScale;
		this.#biomeVariety = env.config.biomeVariety;

		let guard = 0;
		while (
			camera.project(this.#right, this.depth) < width + GEN_MARGIN &&
			guard++ < LOOP_GUARD
		) {
			this.#placeRight(litChance);
		}
		guard = 0;
		while (
			camera.project(this.#left, this.depth) > -GEN_MARGIN &&
			guard++ < LOOP_GUARD
		) {
			this.#placeLeft(litChance);
		}
		this.#recycle(camera, width);
	}

	/** Number of pooled (idle) buildings — for tests / debugging. */
	get pooled(): number {
		return this.#pool.length;
	}

	#obtain(): Building {
		return this.#pool.pop() ??
			new Building(this.depth, this.#rng.fork(this.layer.entities.length + 1));
	}

	/**
	 * Pull the next slot from a stream, sampling the shared biome at the placement edge when the
	 * journey is active. With no field or `variety = 0` this is exactly `stream.next()` — the
	 * uniform city — so the biome scaffold ships dormant and is opt-in via the knob.
	 */
	#nextSlot(stream: DistrictStream, edge: number) {
		if (this.#biomeField && this.#biomeVariety > 0) {
			const urbanism = this.#biomeField.urbanismAt(
				edge + this.#biomeShift,
				this.#biomeScale,
			);
			return stream.next(urbanism, this.#biomeVariety);
		}
		return stream.next();
	}

	#placeRight(litChance: number): void {
		const slot = this.#nextSlot(this.#streamR, this.#right);
		const gap = slot.gap * this.#scale;
		if (slot.kind === null) {
			this.#right += gap;
			return;
		}
		const spec = generateBuilding(this.#allow(slot.kind), this.#rng);
		const leftEdge = this.#right + gap;
		const b = this.#obtain();
		b.reset(spec, leftEdge, this.#shoreOffset, this.#scale, litChance);
		this.layer.add(b);
		this.#right = leftEdge + b.bounds.width;
	}

	#placeLeft(litChance: number): void {
		const slot = this.#nextSlot(this.#streamL, this.#left);
		const gap = slot.gap * this.#scale;
		if (slot.kind === null) {
			this.#left -= gap;
			return;
		}
		const spec = generateBuilding(this.#allow(slot.kind), this.#rng);
		const b = this.#obtain();
		const width = spec.width * this.#scale;
		const leftEdge = this.#left - gap - width;
		b.reset(spec, leftEdge, this.#shoreOffset, this.#scale, litChance);
		this.layer.add(b);
		this.#left = leftEdge;
	}

	#recycle(camera: Camera, width: number): void {
		const list = this.layer.entities;
		let w = 0;
		let removed = false;
		// Order-preserving compaction (keeps same-layer overlap draw order stable).
		for (let i = 0; i < list.length; i++) {
			const b = list[i];
			const l = camera.project(b.bounds.x, this.depth);
			const r = camera.project(b.bounds.x + b.bounds.width, this.depth);
			if (r < -REC_MARGIN || l > width + REC_MARGIN) {
				if (b instanceof Building) this.#pool.push(b);
				removed = true;
			} else {
				list[w++] = b;
			}
		}
		list.length = w;
		if (removed) this.#recomputeEdges(camera);
	}

	#recomputeEdges(camera: Camera): void {
		const list = this.layer.entities;
		if (list.length === 0) {
			this.#left = this.#right = camera.viewLeft(this.depth);
			return;
		}
		let lo = Infinity;
		let hi = -Infinity;
		for (const b of list) {
			if (b.bounds.x < lo) lo = b.bounds.x;
			const right = b.bounds.x + b.bounds.width;
			if (right > hi) hi = right;
		}
		this.#left = lo;
		this.#right = hi;
	}
}
