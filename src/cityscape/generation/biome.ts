/**
 * The biome field — a shared, seeded macro-zoning over world position.
 *
 * Where the District FSM ({@link ./district.ts}) gives *local* zoning coherence (downtown →
 * commercial → park → …), the biome field gives the *macro* arc of the journey: a slow, continuous
 * **urbanism** scalar over world-x that rises into a dense metropolis and falls into open
 * outskirts. It is pure value noise — a deterministic function of `(seed, worldX)` with **no
 * sequential state** — so it is reversible (the camera can scroll either way), reproduces exactly
 * per seed, and is sampled identically by every parallax band, so the whole frame agrees on
 * "where" it is. The District FSM consults it to bias which districts are legal, turning a uniform
 * city into a downtown → town → outskirts → … journey as you travel.
 *
 * It holds no RNG and mutates nothing, so sampling it never perturbs the simulation's determinism.
 * The bias it drives collapses to nothing at `biomeVariety = 0`, exactly reproducing the uniform
 * city **from construction** (and from any permalink, which rebuilds fresh).
 *
 * One caveat, by design: the District FSM it biases is *stateful*, so raising the knob mid-run
 * advances each band's journey down a different, non-rewinding path. Dragging the slider back to 0
 * resumes a uniform city but does **not** restore the exact arrangement the untouched seed would
 * have produced. This is invisible in the infinite scroll (you never revisit a building), keeps the
 * knob live rather than a jarring world-rebuild, and is verified — not a determinism bug. Same
 * seed + same config from construction is always byte-identical.
 *
 * @module
 */

import { clamp } from "../../engine/math/ease.ts";
import { createNoise1D, type Noise1D } from "../../engine/math/noise.ts";

/**
 * A shared macro-zoning field: world-x → urbanism in `[0,1]` (0 = open country, 1 = dense city).
 */
export class BiomeField {
	#noise: Noise1D;

	constructor(seed: number) {
		// Two octaves: a broad arc plus a little variation so regions aren't perfectly even.
		this.#noise = createNoise1D((seed ^ 0xb10e) >>> 0, 2);
	}

	/**
	 * Urbanism at a world coordinate, in `[0,1]`. `scale` is the region length in world units
	 * (higher = longer city/outskirts stretches). Contrast is stretched a touch around the
	 * midpoint so the journey actually reaches both ends rather than hovering near 0.5.
	 */
	urbanismAt(worldX: number, scale: number): number {
		const s = scale > 0 ? scale : 1;
		const n = this.#noise.at(worldX / s);
		return clamp(0.5 + (n - 0.5) * 1.4, 0, 1);
	}
}
