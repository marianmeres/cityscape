import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
	clamp,
	cosinePulse,
	ease,
	inverseLerp,
	lerp,
	remap,
	smoothstep,
	triangle,
	wrap,
} from "../src/engine/math/ease.ts";

Deno.test("clamp", () => {
	assertEquals(clamp(5, 0, 10), 5);
	assertEquals(clamp(-1, 0, 10), 0);
	assertEquals(clamp(11, 0, 10), 10);
});

Deno.test("lerp / inverseLerp / remap", () => {
	assertEquals(lerp(0, 10, 0.5), 5);
	assertEquals(inverseLerp(0, 10, 5), 0.5);
	assertEquals(inverseLerp(4, 4, 4), 0); // no div-by-zero
	assertEquals(remap(5, 0, 10, 0, 100), 50);
});

Deno.test("smoothstep is clamped and monotone", () => {
	assertEquals(smoothstep(0, 1, -1), 0);
	assertEquals(smoothstep(0, 1, 2), 1);
	assertAlmostEquals(smoothstep(0, 1, 0.5), 0.5);
	assert(smoothstep(0, 1, 0.3) < smoothstep(0, 1, 0.7));
});

Deno.test("wrap handles negatives", () => {
	assertEquals(wrap(7, 5), 2);
	assertEquals(wrap(-1, 5), 4);
	assertEquals(wrap(0, 0), 0); // guard
});

Deno.test("triangle & cosinePulse stay in [0,1]", () => {
	for (let t = -2; t < 2; t += 0.05) {
		const tr = triangle(t);
		const cp = cosinePulse(t);
		assert(tr >= 0 && tr <= 1);
		assert(cp >= -1e-9 && cp <= 1 + 1e-9);
	}
	assertAlmostEquals(cosinePulse(0), 0);
	assertAlmostEquals(cosinePulse(0.5), 1);
});

Deno.test("easing functions hit their endpoints", () => {
	for (const fn of Object.values(ease)) {
		assertAlmostEquals(fn(0), 0, 1e-9);
		assertAlmostEquals(fn(1), 1, 1e-9);
	}
});
