import { assert, assertEquals } from "@std/assert";
import { createRng } from "../src/engine/math/rng.ts";
import { Camera } from "../src/engine/scene/camera.ts";
import { Layer } from "../src/engine/scene/layer.ts";
import { LayerSpawner } from "../src/cityscape/generation/spawner.ts";
import type { Building } from "../src/cityscape/buildings/building.ts";
import { AmbientEventBus } from "../src/cityscape/events.ts";
import { MoodEngine } from "../src/cityscape/mood.ts";
import { DEFAULT_CONFIG } from "../src/cityscape/config.ts";
import type { CityEnv } from "../src/cityscape/env.ts";

function makeEnv(): CityEnv {
	return {
		config: DEFAULT_CONFIG,
		mood: new MoodEngine(DEFAULT_CONFIG, 1).mood,
		bus: new AmbientEventBus(),
	};
}

function makeSpawner(seedSuffix = "") {
	const layer = new Layer<CityEnv>("buildings-0", 0.8);
	const sp = new LayerSpawner(layer, createRng("spawn" + seedSuffix), {
		depth: 0.8,
		shoreOffset: 0.02,
		scale: 1,
	});
	return { layer, sp };
}

Deno.test("spawner fills the viewport", () => {
	const { layer, sp } = makeSpawner();
	const cam = new Camera({ speed: 30 });
	cam.resize(800, 400);
	sp.sync(cam, cam.width, makeEnv());
	assert(layer.entities.length > 0, "expected buildings to be spawned");
});

Deno.test("spawner recycles into the pool and stays bounded while scrolling", () => {
	const { layer, sp } = makeSpawner();
	const cam = new Camera({ speed: 80 });
	cam.resize(800, 400);
	const env = makeEnv();
	let maxCount = 0;
	for (let i = 0; i < 400; i++) {
		cam.step(50);
		sp.sync(cam, cam.width, env);
		maxCount = Math.max(maxCount, layer.entities.length);
	}
	assert(layer.entities.length > 0, "city should remain populated");
	assert(maxCount < 300, `entity count should stay bounded, got ${maxCount}`);
	assert(sp.pooled > 0, "recycling should have returned buildings to the pool");
});

Deno.test("excludeKinds keeps skyscrapers out of a layer (downgraded to towers)", () => {
	const layer = new Layer<CityEnv>("buildings-front", 0.92);
	const sp = new LayerSpawner(layer, createRng("front"), {
		depth: 0.92,
		shoreOffset: 0,
		scale: 1.1,
		excludeKinds: ["skyscraper"],
	});
	const cam = new Camera({ speed: 60 });
	cam.resize(1000, 500);
	const env = makeEnv();
	for (let i = 0; i < 300; i++) {
		cam.step(50);
		sp.sync(cam, cam.width, env);
	}
	const kinds = layer.entities.map((e) => (e as Building).kind);
	assert(kinds.length > 0, "layer should have buildings");
	assert(!kinds.includes("skyscraper"), "front layer must contain no skyscrapers");
});

Deno.test("spawner is deterministic", () => {
	const a = makeSpawner("X");
	const b = makeSpawner("X");
	const camA = new Camera({ speed: 40 });
	const camB = new Camera({ speed: 40 });
	camA.resize(640, 360);
	camB.resize(640, 360);
	const envA = makeEnv();
	const envB = makeEnv();
	for (let i = 0; i < 120; i++) {
		camA.step(33);
		camB.step(33);
		a.sp.sync(camA, camA.width, envA);
		b.sp.sync(camB, camB.width, envB);
	}
	// bounds.x is in viewport-height units (small) — compare at sub-unit precision.
	const xa = a.layer.entities.map((e) => Math.round(e.bounds.x * 1e4)).sort((p, q) =>
		p - q
	);
	const xb = b.layer.entities.map((e) => Math.round(e.bounds.x * 1e4)).sort((p, q) =>
		p - q
	);
	assertEquals(xa, xb);
});
