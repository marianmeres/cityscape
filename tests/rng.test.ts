import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { createRng, hashSeed, normalizeSeed } from "../src/engine/math/rng.ts";

Deno.test("rng: deterministic for the same seed", () => {
	const a = createRng("paris");
	const b = createRng("paris");
	const seqA = Array.from({ length: 20 }, () => a.next());
	const seqB = Array.from({ length: 20 }, () => b.next());
	assertEquals(seqA, seqB);
});

Deno.test("rng: different seeds diverge", () => {
	const a = createRng("paris");
	const b = createRng("london");
	assertNotEquals(a.next(), b.next());
});

Deno.test("rng: next() stays in [0,1)", () => {
	const r = createRng(42);
	for (let i = 0; i < 1000; i++) {
		const v = r.next();
		assert(v >= 0 && v < 1, `out of range: ${v}`);
	}
});

Deno.test("rng: int() is inclusive and in range", () => {
	const r = createRng(7);
	const seen = new Set<number>();
	for (let i = 0; i < 2000; i++) {
		const v = r.int(3, 6);
		assert(v >= 3 && v <= 6 && Number.isInteger(v));
		seen.add(v);
	}
	assertEquals([...seen].sort(), [3, 4, 5, 6]);
});

Deno.test("rng: fork is deterministic and independent", () => {
	const base = createRng("seed");
	const f1 = base.fork("a");
	const f2 = createRng("seed").fork("a");
	assertEquals(f1.next(), f2.next()); // deterministic

	const fa = createRng("seed").fork("a");
	const fb = createRng("seed").fork("b");
	assertNotEquals(fa.next(), fb.next()); // independent streams
});

Deno.test("rng: pick & weighted respect inputs", () => {
	const r = createRng(99);
	const arr = ["x", "y", "z"];
	for (let i = 0; i < 100; i++) assert(arr.includes(r.pick(arr)));

	// Weighted heavily toward index 0.
	let zeros = 0;
	for (let i = 0; i < 1000; i++) {
		if (r.weighted(arr, [100, 1, 1]) === "x") zeros++;
	}
	assert(zeros > 900, `expected mostly x, got ${zeros}`);
});

Deno.test("rng: hashSeed / normalizeSeed are stable uint32", () => {
	assertEquals(hashSeed("abc"), hashSeed("abc"));
	const n = normalizeSeed("abc");
	assert(n >= 0 && n <= 0xffffffff && Number.isInteger(n));
	assertEquals(normalizeSeed(5), 5);
});
