import { assert, assertEquals } from "@std/assert";
import { createRng } from "../src/engine/math/rng.ts";
import { DistrictStream } from "../src/cityscape/generation/district.ts";
import type { BuildingKind } from "../src/cityscape/buildings/kinds.ts";

const DOWNTOWN_KINDS = new Set<BuildingKind>(["skyscraper", "tower", "landmark"]);

Deno.test("district stream is deterministic", () => {
	const a = new DistrictStream(createRng("city"));
	const b = new DistrictStream(createRng("city"));
	for (let i = 0; i < 100; i++) {
		const sa = a.next();
		const sb = b.next();
		assertEquals(sa.kind, sb.kind);
		assertEquals(sa.district, sb.district);
	}
});

Deno.test("a factory never sits directly beside a skyscraper/tower/landmark", () => {
	for (const seed of ["a", "b", "c", "d", "e"]) {
		const stream = new DistrictStream(createRng(seed));
		let prev: BuildingKind | null = null;
		for (let i = 0; i < 4000; i++) {
			const cur = stream.next().kind;
			// A `null` slot is an open gap (park) — it always separates neighbours.
			if (prev && cur) {
				const dangerous = (prev === "factory" && DOWNTOWN_KINDS.has(cur)) ||
					(cur === "factory" && DOWNTOWN_KINDS.has(prev));
				assert(
					!dangerous,
					`illegal adjacency: ${prev} beside ${cur} (seed ${seed}, i ${i})`,
				);
			}
			prev = cur;
		}
	}
});

Deno.test("every emitted slot belongs to a known district", () => {
	const known = new Set([
		"downtown",
		"commercial",
		"residential",
		"industrial",
		"park",
		"countryside",
		"coast",
	]);
	const stream = new DistrictStream(createRng("z"));
	for (let i = 0; i < 500; i++) assert(known.has(stream.next().district));
});
