import { assert, assertEquals } from "@std/assert";
import { createRng } from "../src/engine/math/rng.ts";
import { type Zone, ZoneStream } from "../src/naturescape/generation/zone.ts";

const KNOWN: Set<Zone> = new Set([
	"meadow",
	"grove",
	"forest",
	"clearing",
	"lakeside",
	"foothills",
	"alpine",
]);

/** Zones reachable only via the biome journey (variety > 0). */
const BIOME_ONLY: Set<Zone> = new Set(["lakeside", "foothills", "alpine"]);

Deno.test("zone stream is deterministic", () => {
	const a = new ZoneStream(createRng("valley"));
	const b = new ZoneStream(createRng("valley"));
	for (let i = 0; i < 100; i++) {
		const sa = a.next();
		const sb = b.next();
		assertEquals(sa.kind, sb.kind);
		assertEquals(sa.zone, sb.zone);
	}
});

Deno.test("every emitted slot belongs to a known zone", () => {
	const stream = new ZoneStream(createRng("z"));
	for (let i = 0; i < 500; i++) assert(KNOWN.has(stream.next().zone));
});

Deno.test("with variety 0, the biome-only zones never appear (uniform landscape)", () => {
	for (const seed of ["a", "b", "c", "d", "e"]) {
		const stream = new ZoneStream(createRng(seed));
		for (let i = 0; i < 3000; i++) {
			const zone = stream.next().zone; // default args = no biome bias
			assert(
				!BIOME_ONLY.has(zone),
				`biome-only zone ${zone} leaked without the journey (seed ${seed})`,
			);
		}
	}
});

Deno.test("with the journey on, biome-only zones do appear", () => {
	let seen = false;
	const stream = new ZoneStream(createRng("trek"));
	for (let i = 0; i < 4000 && !seen; i++) {
		// High wildness + strong variety should reach the wilds.
		if (BIOME_ONLY.has(stream.next(0.95, 1).zone)) seen = true;
	}
	assert(seen, "the wilds should be reachable when variety > 0");
});
