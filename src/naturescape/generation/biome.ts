/**
 * The biome field — a shared, seeded macro-zoning over world position.
 *
 * Where the Zone FSM ({@link ./zone.ts}) gives *local* coherence (meadow → grove → forest → …),
 * the biome field gives the *macro* arc of the journey: a slow, continuous **wildness** scalar over
 * world-x that rises into deep forest / high alpine and falls into open lowland meadow. It is pure
 * value noise — a deterministic function of `(seed, worldX)` with **no sequential state** — so it is
 * reversible (the camera can scroll either way), reproduces exactly per seed, and is sampled
 * identically by every parallax band, so the whole frame agrees on "where" it is. The Zone FSM
 * consults it to bias which zones are legal, turning a uniform landscape into a
 * meadow → woods → foothills → … journey as you travel.
 *
 * It holds no RNG and mutates nothing, so sampling it never perturbs the simulation's determinism.
 * The bias it drives collapses to nothing at `biomeVariety = 0`, exactly reproducing the uniform
 * landscape from construction (and from any permalink, which rebuilds fresh). Mirrors the
 * cityscape's biome field exactly — the architecture is shared, only the axis is renamed.
 *
 * @module
 */

import { clamp } from "../../engine/math/ease.ts";
import { createNoise1D, type Noise1D } from "../../engine/math/noise.ts";

/**
 * A shared macro-zoning field: world-x → wildness in `[0,1]` (0 = open lowland, 1 = deep wilds).
 */
export class BiomeField {
	#noise: Noise1D;

	constructor(seed: number) {
		// Two octaves: a broad arc plus a little variation so regions aren't perfectly even.
		this.#noise = createNoise1D((seed ^ 0xb10e) >>> 0, 2);
	}

	/**
	 * Wildness at a world coordinate, in `[0,1]`. `scale` is the region length in world units
	 * (higher = longer meadow/forest stretches). Contrast is stretched a touch around the midpoint
	 * so the journey actually reaches both ends rather than hovering near 0.5.
	 */
	wildnessAt(worldX: number, scale: number): number {
		const s = scale > 0 ? scale : 1;
		const n = this.#noise.at(worldX / s);
		return clamp(0.5 + (n - 0.5) * 1.4, 0, 1);
	}
}
