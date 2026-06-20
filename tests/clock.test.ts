import { assert, assertEquals } from "@std/assert";
import { FixedStepper } from "../src/engine/time/clock.ts";

Deno.test("FixedStepper dispatches whole steps and carries remainder", () => {
	const s = new FixedStepper(10);
	let calls = 0;
	const r1 = s.advance(25, () => calls++);
	assertEquals(r1.steps, 2);
	assertEquals(calls, 2);
	assertEquals(s.elapsed, 20);
	// 5ms carried; +6ms = 11 → one more step.
	const r2 = s.advance(6, () => calls++);
	assertEquals(r2.steps, 1);
	assertEquals(calls, 3);
});

Deno.test("FixedStepper clamps the spiral of death", () => {
	const s = new FixedStepper(10, 3);
	let calls = 0;
	const r = s.advance(10_000, () => calls++);
	assertEquals(r.steps, 3); // capped
	assertEquals(calls, 3);
});

Deno.test("FixedStepper ignores non-positive deltas", () => {
	const s = new FixedStepper(10);
	let calls = 0;
	assertEquals(s.advance(0, () => calls++).steps, 0);
	assertEquals(s.advance(-5, () => calls++).steps, 0);
	assertEquals(calls, 0);
});

Deno.test("FixedStepper reset clears state", () => {
	const s = new FixedStepper(10);
	s.advance(35, () => {});
	s.reset();
	assertEquals(s.elapsed, 0);
	let calls = 0;
	assertEquals(s.advance(5, () => calls++).steps, 0); // no carried remainder
});

Deno.test("FixedStepper rejects bad step size", () => {
	let threw = false;
	try {
		new FixedStepper(0);
	} catch {
		threw = true;
	}
	assert(threw);
});
