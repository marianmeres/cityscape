/**
 * The layer spawner — what makes the world infinite at bounded cost.
 *
 * Each land layer has one spawner that, every tick, fills the leading edge of the viewport with
 * freshly-generated features and recycles those that have scrolled well past the trailing edge back
 * into an object pool. Generation and recycle thresholds use hysteresis (`GEN < REC`) so nothing
 * churns at the boundary, and two zone streams (one per side) let the same spawner work in either
 * scroll direction. Pure: it reads a {@link Camera} and an {@link Rng}, touches no DOM. A faithful
 * port of the cityscape's `LayerSpawner`.
 *
 * @module
 */

import type { Rng } from "../../engine/math/rng.ts";
import type { Camera } from "../../engine/scene/camera.ts";
import type { Layer } from "../../engine/scene/layer.ts";
import type { NatureEnv } from "../env.ts";
import { Feature } from "../features/feature.ts";
import { type FeatureKind, generateFeature } from "../features/kinds.ts";
import { ZoneStream } from "./zone.ts";
import type { BiomeField } from "./biome.ts";

/** Per-layer placement parameters. */
export interface SpawnerOptions {
	depth: number;
	/** Viewport fraction this layer's feet sit *above* the waterline (distant-bank stagger). */
	shoreOffset: number;
	/** Size multiplier; far layers are smaller. */
	scale: number;
	/** Archetypes to keep out of this layer (remapped to a substitute if generated). */
	excludeKinds?: Iterable<FeatureKind>;
	/**
	 * Shared macro-zoning field. When present *and* `biomeVariety > 0`, zone transitions are biased
	 * toward the local wildness so the landscape drifts lowland↔wilds. Omitted (or variety 0) = the
	 * uniform landscape. Every layer shares one field so the bands agree on the journey.
	 */
	biomeField?: BiomeField;
}

/** Where an excluded archetype is downgraded to. */
const SUBSTITUTE: Record<FeatureKind, FeatureKind> = {
	hill: "broadleaf",
	cabin: "broadleaf",
	reeds: "shrub",
	broadleaf: "broadleaf",
	pine: "pine",
	shrub: "shrub",
	rock: "rock",
};

const GEN_MARGIN = 340;
const REC_MARGIN = 680;
const LOOP_GUARD = 400;

/** Fills and recycles one land {@link Layer}. */
export class LayerSpawner {
	readonly layer: Layer<NatureEnv>;
	readonly depth: number;

	#shoreOffset: number;
	#scale: number;
	#rng: Rng;
	#streamR: ZoneStream;
	#streamL: ZoneStream;
	#pool: Feature[] = [];
	#right = 0; // local-x right edge of the rightmost feature
	#left = 0; // local-x left edge of the leftmost feature
	#init = false;
	#exclude: Set<FeatureKind>;
	#biomeField?: BiomeField;
	// Per-tick biome context (refreshed in `sync`).
	#biomeShift = 0;
	#biomeScale = 5;
	#biomeVariety = 0;

	constructor(layer: Layer<NatureEnv>, rng: Rng, opts: SpawnerOptions) {
		this.layer = layer;
		this.depth = opts.depth;
		this.#shoreOffset = opts.shoreOffset;
		this.#scale = opts.scale;
		this.#rng = rng;
		this.#exclude = new Set(opts.excludeKinds ?? []);
		this.#biomeField = opts.biomeField;
		this.#streamR = new ZoneStream(rng.fork("right"));
		this.#streamL = new ZoneStream(rng.fork("left"));
	}

	/** Remap an archetype barred from this layer to a permitted substitute. */
	#allow(kind: FeatureKind): FeatureKind {
		let k = kind;
		for (let i = 0; i < 6 && this.#exclude.has(k); i++) {
			const next = SUBSTITUTE[k];
			if (next === k) break;
			k = next;
		}
		return k;
	}

	/** Top up the leading edges and recycle the trailing edge for the current camera. */
	sync(camera: Camera, width: number, env: NatureEnv): void {
		if (!this.#init) {
			this.#left = this.#right = camera.viewLeft(this.depth);
			this.#init = true;
		}
		// Refresh the biome context. The shift converts a layer-local x to the shared near-plane
		// coordinate (`lx + scroll·(1−parallax)`), so a feature entering at the leading edge samples
		// the same wildness on every band — the whole frame agrees where it is.
		this.#biomeShift = camera.scroll * (1 - camera.parallaxAt(this.depth));
		this.#biomeScale = env.config.biomeScale;
		this.#biomeVariety = env.config.biomeVariety;

		let guard = 0;
		while (
			camera.project(this.#right, this.depth) < width + GEN_MARGIN &&
			guard++ < LOOP_GUARD
		) {
			this.#placeRight();
		}
		guard = 0;
		while (
			camera.project(this.#left, this.depth) > -GEN_MARGIN &&
			guard++ < LOOP_GUARD
		) {
			this.#placeLeft();
		}
		this.#recycle(camera, width);
	}

	/** Number of pooled (idle) features — for tests / debugging. */
	get pooled(): number {
		return this.#pool.length;
	}

	#obtain(): Feature {
		return this.#pool.pop() ??
			new Feature(this.depth, this.#rng.fork(this.layer.entities.length + 1));
	}

	/** Pull the next slot from a stream, sampling the shared biome at the placement edge. */
	#nextSlot(stream: ZoneStream, edge: number) {
		if (this.#biomeField && this.#biomeVariety > 0) {
			const wildness = this.#biomeField.wildnessAt(
				edge + this.#biomeShift,
				this.#biomeScale,
			);
			return stream.next(wildness, this.#biomeVariety);
		}
		return stream.next();
	}

	#placeRight(): void {
		const slot = this.#nextSlot(this.#streamR, this.#right);
		const gap = slot.gap * this.#scale;
		if (slot.kind === null) {
			this.#right += gap;
			return;
		}
		const spec = generateFeature(this.#allow(slot.kind), this.#rng);
		const leftEdge = this.#right + gap;
		const f = this.#obtain();
		f.reset(spec, leftEdge, this.#shoreOffset, this.#scale);
		this.layer.add(f);
		this.#right = leftEdge + f.bounds.width;
	}

	#placeLeft(): void {
		const slot = this.#nextSlot(this.#streamL, this.#left);
		const gap = slot.gap * this.#scale;
		if (slot.kind === null) {
			this.#left -= gap;
			return;
		}
		const spec = generateFeature(this.#allow(slot.kind), this.#rng);
		const f = this.#obtain();
		const width = spec.width * this.#scale;
		const leftEdge = this.#left - gap - width;
		f.reset(spec, leftEdge, this.#shoreOffset, this.#scale);
		this.layer.add(f);
		this.#left = leftEdge;
	}

	#recycle(camera: Camera, width: number): void {
		const list = this.layer.entities;
		let w = 0;
		let removed = false;
		for (let i = 0; i < list.length; i++) {
			const f = list[i];
			const l = camera.project(f.bounds.x, this.depth);
			const r = camera.project(f.bounds.x + f.bounds.width, this.depth);
			if (r < -REC_MARGIN || l > width + REC_MARGIN) {
				if (f instanceof Feature) this.#pool.push(f);
				removed = true;
			} else {
				list[w++] = f;
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
		for (const f of list) {
			if (f.bounds.x < lo) lo = f.bounds.x;
			const right = f.bounds.x + f.bounds.width;
			if (right > hi) hi = right;
		}
		this.#left = lo;
		this.#right = hi;
	}
}
