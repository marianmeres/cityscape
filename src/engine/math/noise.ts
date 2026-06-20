/**
 * Seeded 1-D value noise — smooth, continuous, deterministic pseudo-randomness.
 *
 * Unlike {@link createRng} (which yields independent samples) this yields a *continuous* curve:
 * `at(x)` and `at(x + ε)` are close. That is exactly what the mood cycle and organic drift want
 * — a value that wanders calmly rather than jittering. Built from a hashed value at each integer
 * lattice point, smoothstep-interpolated between them, with optional fractal layering (fBm).
 *
 * @module
 */

import { smoothstep } from "./ease.ts";

/** A continuous 1-D noise field sampled by `at(x)`. */
export interface Noise1D {
	/** Sample the field at `x`; returns a value in `[0, 1]`. */
	at(x: number): number;
	/** Sample in `[-1, 1]` (handy for symmetric drift around a center). */
	signed(x: number): number;
}

/** Deterministic hash of an integer lattice index → `[0, 1]`. */
function hash1(i: number, seed: number): number {
	let h = (i ^ seed) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	h = (h ^ (h >>> 16)) >>> 0;
	return h / 4294967296;
}

/**
 * Create a 1-D value-noise field.
 *
 * @param seed       deterministic seed
 * @param octaves    fractal layers; more octaves = more fine detail (default `1`)
 * @param persistence amplitude falloff per octave (default `0.5`)
 */
export function createNoise1D(
	seed: number,
	octaves = 1,
	persistence = 0.5,
): Noise1D {
	const oct = Math.max(1, Math.floor(octaves));

	const single = (x: number): number => {
		const i = Math.floor(x);
		const f = x - i;
		const a = hash1(i, seed);
		const b = hash1(i + 1, seed);
		return a + (b - a) * smoothstep(0, 1, f);
	};

	const at = (x: number): number => {
		if (oct === 1) return single(x);
		let sum = 0;
		let amp = 1;
		let freq = 1;
		let norm = 0;
		for (let o = 0; o < oct; o++) {
			sum += single(x * freq + o * 1000) * amp;
			norm += amp;
			amp *= persistence;
			freq *= 2;
		}
		return sum / norm;
	};

	return {
		at,
		signed: (x: number): number => at(x) * 2 - 1,
	};
}
