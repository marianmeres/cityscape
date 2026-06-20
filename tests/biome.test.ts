import { assert, assertEquals } from "@std/assert";
import { createRng } from "../src/engine/math/rng.ts";
import { DistrictStream } from "../src/cityscape/generation/district.ts";
import { BiomeField } from "../src/cityscape/generation/biome.ts";

/** Captured from the pre-biome DistrictStream (seed 777). `variety = 0` must reproduce this. */
const GOLDEN = [
	"commercial:tower",
	"commercial:midrise",
	"commercial:midrise",
	"commercial:midrise",
	"commercial:midrise",
	"downtown:landmark",
	"downtown:skyscraper",
	"downtown:tower",
	"commercial:midrise",
	"commercial:midrise",
	"commercial:tower",
	"residential:house",
	"residential:house",
	"residential:midrise",
	"residential:midrise",
	"residential:midrise",
	"residential:midrise",
	"residential:house",
	"residential:house",
	"residential:house",
	"residential:house",
	"residential:midrise",
	"residential:house",
	"residential:midrise",
	"residential:house",
	"residential:midrise",
	"residential:midrise",
	"residential:house",
	"residential:house",
	"residential:house",
	"residential:house",
	"commercial:midrise",
	"commercial:tower",
	"commercial:skyscraper",
	"residential:house",
	"residential:house",
	"residential:midrise",
	"residential:midrise",
	"residential:house",
	"residential:house",
];

function sequence(variety: number, urbanism: number): string[] {
	const s = new DistrictStream(createRng(777));
	return Array.from({ length: GOLDEN.length }, () => {
		const slot = s.next(urbanism, variety);
		return `${slot.district}:${slot.kind}`;
	});
}

// The guarantee is construction-time: a fresh variety=0 stream is byte-identical to the pre-biome
// city. Live-toggling variety at runtime is intentionally path-dependent (the FSM is stateful), so
// there is deliberately no toggle-reversibility test here — see biome.ts for the rationale.
Deno.test("variety=0 reproduces the pre-biome city exactly (default args)", () => {
	const s = new DistrictStream(createRng(777));
	const seq = Array.from({ length: GOLDEN.length }, () => {
		const slot = s.next();
		return `${slot.district}:${slot.kind}`;
	});
	assertEquals(seq, GOLDEN);
});

Deno.test("variety=0 ignores urbanism — any reading reproduces the golden", () => {
	assertEquals(sequence(0, 0), GOLDEN);
	assertEquals(sequence(0, 1), GOLDEN);
	assertEquals(sequence(0, 0.5), GOLDEN);
});

Deno.test("biased stream stays deterministic (same draws, same result)", () => {
	assertEquals(sequence(1, 0.8), sequence(1, 0.8));
});

Deno.test("the journey biases the district mix toward the local urbanism", () => {
	// Over many seeds, a metropolis reading should yield far more high-urbanism districts than a
	// country reading does — that's the whole point of the journey.
	const dense = new Set(["downtown", "commercial"]);
	let cityInMetro = 0;
	let cityInCountry = 0;
	let total = 0;
	for (const seed of ["a", "b", "c", "d", "e", "f"]) {
		const metro = new DistrictStream(createRng(seed));
		const country = new DistrictStream(createRng(seed));
		for (let i = 0; i < 400; i++) {
			if (dense.has(metro.next(1, 1).district)) cityInMetro++;
			if (dense.has(country.next(0, 1).district)) cityInCountry++;
			total++;
		}
	}
	const metroFrac = cityInMetro / total;
	const countryFrac = cityInCountry / total;
	assert(
		metroFrac > countryFrac + 0.3,
		`expected metropolis to be far denser: metro=${metroFrac.toFixed(2)} country=${
			countryFrac.toFixed(2)
		}`,
	);
});

Deno.test("rural districts/kinds appear only with the journey on", () => {
	const rural = new Set(["tree", "barn", "silo"]);
	// variety=0: the uniform city is untouched — never countryside, never a rural kind.
	for (const seed of ["a", "b", "c", "d"]) {
		const s = new DistrictStream(createRng(seed));
		for (let i = 0; i < 3000; i++) {
			const slot = s.next();
			assert(slot.district !== "countryside", "countryside leaked at variety=0");
			assert(
				!(slot.kind && rural.has(slot.kind)),
				`rural kind ${slot.kind} leaked at variety=0`,
			);
		}
	}
	// variety=1 at a deep-country reading: countryside and its rural kinds do appear.
	let sawCountryside = false;
	let sawRural = false;
	for (const seed of ["a", "b", "c", "d"]) {
		const s = new DistrictStream(createRng(seed));
		for (let i = 0; i < 3000; i++) {
			const slot = s.next(0.05, 1);
			if (slot.district === "countryside") sawCountryside = true;
			if (slot.kind && rural.has(slot.kind)) sawRural = true;
		}
	}
	assert(sawCountryside, "expected countryside with the journey on at low urbanism");
	assert(sawRural, "expected rural kinds with the journey on at low urbanism");
});

Deno.test("BiomeField is deterministic, bounded, varied, and reversible", () => {
	const a = new BiomeField(12345);
	const b = new BiomeField(12345);
	let min = 1;
	let max = 0;
	for (let x = -200; x < 200; x += 0.25) {
		const u = a.urbanismAt(x, 5);
		assertEquals(u, b.urbanismAt(x, 5)); // deterministic + reversible (negatives included)
		assert(u >= 0 && u <= 1, `urbanism out of range at ${x}: ${u}`);
		min = Math.min(min, u);
		max = Math.max(max, u);
	}
	// The field must actually traverse the axis, not hover near the middle.
	assert(min < 0.2, `field never reaches open country (min ${min.toFixed(2)})`);
	assert(max > 0.8, `field never reaches dense city (max ${max.toFixed(2)})`);
});
