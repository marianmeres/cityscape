import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { bayerThreshold, makeBayer } from "../src/engine/render/pixel/dither.ts";

Deno.test("makeBayer(0) is the 1×1 base", () => {
	const m = makeBayer(0);
	assertEquals(m.size, 1);
	assertEquals(Array.from(m.data), [0]);
});

Deno.test("makeBayer(1) is the classic 2×2 matrix", () => {
	const m = makeBayer(1);
	assertEquals(m.size, 2);
	// [[0,2],[3,1]] row-major.
	assertEquals(Array.from(m.data), [0, 2, 3, 1]);
});

Deno.test("makeBayer(3) is an 8×8 permutation of 0..63", () => {
	const m = makeBayer(3);
	assertEquals(m.size, 8);
	assertEquals(m.data.length, 64);
	const sorted = Array.from(m.data).sort((a, b) => a - b);
	assertEquals(sorted, Array.from({ length: 64 }, (_, i) => i));
});

Deno.test("bayerThreshold is in (0,1) and tiles (wraps) by size", () => {
	const m = makeBayer(2); // 4×4
	for (let y = 0; y < 4; y++) {
		for (let x = 0; x < 4; x++) {
			const v = bayerThreshold(m, x, y);
			assert(v > 0 && v < 1, `threshold ${v} out of range`);
			// Wraps positively and negatively.
			assertAlmostEquals(bayerThreshold(m, x + 4, y + 8), v);
			assertAlmostEquals(bayerThreshold(m, x - 4, y - 4), v);
		}
	}
});

Deno.test("bayerThreshold values are evenly spread across (0,1)", () => {
	const m = makeBayer(2);
	const vals = Array.from(
		m.data,
		(_, i) => bayerThreshold(m, i % 4, Math.floor(i / 4)),
	);
	// 16 distinct, evenly-spaced thresholds (k+0.5)/16.
	const set = new Set(vals.map((v) => Math.round(v * 16)));
	assertEquals(set.size, 16);
});
