/**
 * Seeded, deterministic pseudo-random number generator.
 *
 * The whole simulation is deterministic: the same `seed` (plus the same config) reproduces
 * the exact same city. That is what makes the core unit-testable and a chosen look shareable
 * as a permalink. We use `mulberry32` — a tiny, fast, well-distributed 32-bit generator —
 * and expose a small, intention-revealing surface on top of it.
 *
 * @module
 */

/** A deterministic random source. Pure: no global state, no `Math.random`. */
export interface Rng {
	/** The numeric seed this stream was created from (for debugging / reproduction). */
	readonly seed: number;
	/** Next float in `[0, 1)`. */
	next(): number;
	/** Integer in `[min, max]` (inclusive both ends). */
	int(min: number, max: number): number;
	/** Float in `[min, max)`. */
	float(min: number, max: number): number;
	/** `true` with probability `p` (default `0.5`). */
	bool(p?: number): boolean;
	/** A uniformly-chosen element of `arr` (throws on empty). */
	pick<T>(arr: readonly T[]): T;
	/** A weighted pick: `weights[i]` is the relative weight of `arr[i]`. */
	weighted<T>(arr: readonly T[], weights: readonly number[]): T;
	/**
	 * An independent child stream derived from this one's seed and `salt`. Used to give each
	 * parallax layer / subsystem its own reproducible stream without them interfering.
	 */
	fork(salt?: number | string): Rng;
}

/** Hash an arbitrary string into a 32-bit unsigned integer seed (FNV-1a). */
export function hashSeed(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		// 32-bit FNV prime multiply, kept in uint range via Math.imul.
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** Coerce a number|string seed into a uint32. */
export function normalizeSeed(seed: number | string): number {
	if (typeof seed === "string") return hashSeed(seed);
	// Fold floats / negatives into a stable uint32.
	return (Math.floor(seed) >>> 0) || (seed === 0 ? 0 : hashSeed(String(seed)));
}

/**
 * Create a deterministic {@link Rng} from a numeric or string seed.
 *
 * ```ts
 * const rng = createRng("paris");
 * rng.next();            // always the same first value for "paris"
 * rng.fork("sky");       // an independent, also-deterministic substream
 * ```
 */
export function createRng(seed: number | string): Rng {
	const seed32 = normalizeSeed(seed);
	// mulberry32 internal state.
	let a = seed32 >>> 0;

	const next = (): number => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	const rng: Rng = {
		seed: seed32,
		next,
		int(min, max) {
			if (max < min) [min, max] = [max, min];
			return min + Math.floor(next() * (max - min + 1));
		},
		float(min, max) {
			return min + next() * (max - min);
		},
		bool(p = 0.5) {
			return next() < p;
		},
		pick(arr) {
			if (arr.length === 0) throw new RangeError("pick() on empty array");
			return arr[Math.floor(next() * arr.length)];
		},
		weighted(arr, weights) {
			if (arr.length === 0) throw new RangeError("weighted() on empty array");
			let total = 0;
			for (const w of weights) total += Math.max(0, w);
			if (total <= 0) return arr[Math.floor(next() * arr.length)];
			let roll = next() * total;
			for (let i = 0; i < arr.length; i++) {
				roll -= Math.max(0, weights[i] ?? 0);
				if (roll < 0) return arr[i];
			}
			return arr[arr.length - 1];
		},
		fork(salt = 0) {
			const saltN = typeof salt === "string" ? hashSeed(salt) : salt >>> 0;
			// Mix seed + salt deterministically into a fresh seed.
			return createRng(Math.imul(seed32 ^ saltN, 0x9e3779b1) >>> 0);
		},
	};
	return rng;
}
