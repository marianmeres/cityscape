/**
 * Small, pure scalar utilities: interpolation, clamping, wrapping, easing.
 *
 * Deliberately framework-free and side-effect-free so every consumer (mood cycle, camera,
 * entity motion) is trivially unit-testable.
 *
 * @module
 */

/** Constrain `v` to the inclusive range `[min, max]`. */
export function clamp(v: number, min: number, max: number): number {
	return v < min ? min : v > max ? max : v;
}

/** Linear interpolation from `a` to `b` by `t` (t is not clamped). */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Inverse lerp: where does `v` sit between `a` and `b`? Returns `0` if `a === b`. */
export function inverseLerp(a: number, b: number, v: number): number {
	return a === b ? 0 : (v - a) / (b - a);
}

/** Remap `v` from range `[inMin,inMax]` to `[outMin,outMax]`. */
export function remap(
	v: number,
	inMin: number,
	inMax: number,
	outMin: number,
	outMax: number,
): number {
	return lerp(outMin, outMax, inverseLerp(inMin, inMax, v));
}

/** Hermite smoothstep on `[edge0, edge1]`, clamped to `[0,1]`. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = clamp(inverseLerp(edge0, edge1, x), 0, 1);
	return t * t * (3 - 2 * t);
}

/**
 * Wrap `v` into `[0, range)` (handles negatives). Used for the camera's infinite scroll and
 * for cyclic phase math.
 */
export function wrap(v: number, range: number): number {
	if (range <= 0) return 0;
	return ((v % range) + range) % range;
}

/** Triangle wave in `[0,1]`: ramps up then down over one unit period of `t`. */
export function triangle(t: number): number {
	const x = wrap(t, 1);
	return x < 0.5 ? x * 2 : 2 - x * 2;
}

/** Smooth (cosine) 0→1→0 pulse over one unit period — calmer than a triangle. */
export function cosinePulse(t: number): number {
	return 0.5 - 0.5 * Math.cos(wrap(t, 1) * Math.PI * 2);
}

/** Standard easing functions, all `(t:0..1) => 0..1`. */
export const ease = {
	linear: (t: number): number => t,
	inQuad: (t: number): number => t * t,
	outQuad: (t: number): number => t * (2 - t),
	inOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
	inOutCubic: (t: number): number =>
		t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
	outCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
} as const;
