/**
 * Ordered (Bayer) dithering — the pure math behind the pixel-art renderer's gradient crosshatch.
 *
 * A Bayer matrix is a small, recursively-built threshold map. Tiling it across the screen and
 * biasing each pixel's colour by its threshold *before* quantising spreads a smooth ramp across a
 * few palette tones as a stable cross-hatch, instead of hard bands. Anchored to screen pixels (not
 * scene content) the pattern stays put as the city scrolls, so it reads as a fixed "screen door"
 * rather than crawling noise — exactly the classic pixel-art look. Pure, DOM-free, deterministic.
 *
 * @module
 */

/**
 * A Bayer threshold matrix: `size`×`size` integer thresholds in `0..size²-1`, row-major. The
 * values are a permutation of that range; {@link bayerThreshold} normalises them to `(0,1)`.
 */
export interface BayerMatrix {
	size: number;
	data: Int32Array;
}

/**
 * Build a `2^order × 2^order` Bayer matrix via the standard recursive construction
 * (`order` 0 → 1×1, 1 → 2×2, 2 → 4×4, 3 → 8×8). Higher orders give finer dithering.
 */
export function makeBayer(order: number): BayerMatrix {
	const n = Math.max(0, Math.floor(order));
	// Start from the 1×1 base and quadruple in size each step.
	let m: number[][] = [[0]];
	for (let k = 0; k < n; k++) {
		const s = m.length;
		const next: number[][] = Array.from(
			{ length: s * 2 },
			() => new Array(s * 2).fill(0),
		);
		for (let y = 0; y < s; y++) {
			for (let x = 0; x < s; x++) {
				const base = m[y][x] * 4;
				next[y][x] = base + 0;
				next[y][x + s] = base + 2;
				next[y + s][x] = base + 3;
				next[y + s][x + s] = base + 1;
			}
		}
		m = next;
	}
	const size = m.length;
	const data = new Int32Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) data[y * size + x] = m[y][x];
	}
	return { size, data };
}

/**
 * The normalised dither threshold in `(0,1)` for screen pixel `(x,y)`. The matrix tiles infinitely
 * (negative coordinates wrap correctly), so the pattern is a stable function of screen position.
 */
export function bayerThreshold(m: BayerMatrix, x: number, y: number): number {
	const s = m.size;
	const ix = ((x % s) + s) % s;
	const iy = ((y % s) + s) % s;
	return (m.data[iy * s + ix] + 0.5) / (s * s);
}
