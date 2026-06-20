import { assert, assertEquals } from "@std/assert";
import { createNoise1D } from "../src/engine/math/noise.ts";

Deno.test("noise: stays in [0,1]", () => {
	const n = createNoise1D(123, 3);
	for (let x = 0; x < 200; x += 0.3) {
		const v = n.at(x);
		assert(v >= 0 && v <= 1, `out of range at ${x}: ${v}`);
	}
});

Deno.test("noise: deterministic for the same seed", () => {
	const a = createNoise1D(5);
	const b = createNoise1D(5);
	for (let x = 0; x < 50; x += 1.7) assertEquals(a.at(x), b.at(x));
});

Deno.test("noise: continuous (adjacent samples are close)", () => {
	const n = createNoise1D(9, 1);
	for (let x = 0; x < 50; x += 1) {
		const d = Math.abs(n.at(x) - n.at(x + 0.01));
		assert(d < 0.05, `not smooth at ${x}: jump ${d}`);
	}
});

Deno.test("noise: signed maps to [-1,1]", () => {
	const n = createNoise1D(11, 2);
	for (let x = 0; x < 50; x += 1.3) {
		const v = n.signed(x);
		assert(v >= -1 && v <= 1);
	}
});
