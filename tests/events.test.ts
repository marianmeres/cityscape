import { assert, assertEquals } from "@std/assert";
import { createRng } from "../src/engine/math/rng.ts";
import {
	AmbientDirector,
	type AmbientEvent,
	AmbientEventBus,
} from "../src/cityscape/events.ts";
import { DEFAULT_CONFIG } from "../src/cityscape/config.ts";

Deno.test("bus delivers events and unsubscribes", () => {
	const bus = new AmbientEventBus();
	const seen: AmbientEvent[] = [];
	const off = bus.on((e) => seen.push(e));
	bus.emit({ type: "horn", intensity: 0.5, pan: 0 });
	assertEquals(seen.length, 1);
	off();
	bus.emit({ type: "wind", intensity: 0.5, pan: 0 });
	assertEquals(seen.length, 1);
});

Deno.test("director emits sparse, valid events over time", () => {
	const bus = new AmbientEventBus();
	const seen: AmbientEvent[] = [];
	bus.on((e) => seen.push(e));
	const dir = new AmbientDirector(createRng("ambient"), bus);
	// 5 simulated minutes in 100ms ticks.
	for (let i = 0; i < 3000; i++) dir.update(100, DEFAULT_CONFIG);
	assert(seen.length > 0, "expected at least one cue");
	// Sparse: far fewer than one per second.
	assert(seen.length < 60, `too chatty: ${seen.length} in 5 min`);
	for (const e of seen) {
		assert(e.intensity >= 0 && e.intensity <= 1);
		assert(e.pan >= -1 && e.pan <= 1);
	}
});

Deno.test("director is deterministic", () => {
	const counts: number[] = [];
	for (let run = 0; run < 2; run++) {
		const bus = new AmbientEventBus();
		let n = 0;
		bus.on(() => n++);
		const dir = new AmbientDirector(createRng("same"), bus);
		for (let i = 0; i < 2000; i++) dir.update(100, DEFAULT_CONFIG);
		counts.push(n);
	}
	assertEquals(counts[0], counts[1]);
});
