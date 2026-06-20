import { assert, assertEquals } from "@std/assert";
import { createRng } from "../src/engine/math/rng.ts";
import { Camera } from "../src/engine/scene/camera.ts";
import { Layer } from "../src/engine/scene/layer.ts";
import { LayerSpawner } from "../src/naturescape/generation/spawner.ts";
import type { Feature } from "../src/naturescape/features/feature.ts";
import { AmbientEventBus } from "../src/naturescape/events.ts";
import { MoodEngine } from "../src/naturescape/mood.ts";
import { DEFAULT_CONFIG } from "../src/naturescape/config.ts";
import type { NatureEnv } from "../src/naturescape/env.ts";

function makeEnv(): NatureEnv {
	return {
		config: DEFAULT_CONFIG,
		mood: new MoodEngine(DEFAULT_CONFIG, 1).mood,
		bus: new AmbientEventBus(),
	};
}

function makeSpawner(seedSuffix = "") {
	const layer = new Layer<NatureEnv>("land-0", 0.8);
	const sp = new LayerSpawner(layer, createRng("spawn" + seedSuffix), {
		depth: 0.8,
		shoreOffset: 0.02,
		scale: 1,
	});
	return { layer, sp };
}

Deno.test("nature spawner fills the viewport", () => {
	const { layer, sp } = makeSpawner();
	const cam = new Camera({ speed: 30 });
	cam.resize(800, 400);
	sp.sync(cam, cam.width, makeEnv());
	assert(layer.entities.length > 0, "expected features to be spawned");
});

Deno.test("nature spawner recycles into the pool and stays bounded while scrolling", () => {
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
	assert(layer.entities.length > 0, "landscape should remain populated");
	assert(maxCount < 400, `entity count should stay bounded, got ${maxCount}`);
	assert(sp.pooled > 0, "recycling should have returned features to the pool");
});

Deno.test("excludeKinds keeps big hills out of a near layer (downgraded)", () => {
	const layer = new Layer<NatureEnv>("land-front", 0.92);
	const sp = new LayerSpawner(layer, createRng("front"), {
		depth: 0.92,
		shoreOffset: 0,
		scale: 1.1,
		excludeKinds: ["hill"],
	});
	const cam = new Camera({ speed: 60 });
	cam.resize(1000, 500);
	const env = makeEnv();
	for (let i = 0; i < 300; i++) {
		cam.step(50);
		sp.sync(cam, cam.width, env);
	}
	const kinds = layer.entities.map((e) => (e as Feature).kind);
	assert(kinds.length > 0, "layer should have features");
	assert(!kinds.includes("hill"), "near layer must contain no big hills");
});

Deno.test("nature spawner is deterministic", () => {
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
	const xa = a.layer.entities.map((e) => Math.round(e.bounds.x * 1e4)).sort((p, q) =>
		p - q
	);
	const xb = b.layer.entities.map((e) => Math.round(e.bounds.x * 1e4)).sort((p, q) =>
		p - q
	);
	assertEquals(xa, xb);
});
