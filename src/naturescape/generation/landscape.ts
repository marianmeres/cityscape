/**
 * Landscape assembly — wires the parallax layers and atmosphere onto a {@link World}.
 *
 * It spreads `parallaxLayers` land bands from far to near (each with its own depth, ground baseline
 * and size scale so distant bands sit higher and smaller), gives each a {@link LayerSpawner}, and
 * adds the atmosphere (sky backdrop, rainbow, sun, mountains, clouds, rays, flyers) plus the front
 * matter (birds, lake, meadow, wildlife, rain, snow). Returns the spawners so the scene can drive
 * them each tick. The direct analogue of the cityscape's `buildSkyline`.
 *
 * @module
 */

import { lerp } from "../../engine/math/ease.ts";
import type { Rng } from "../../engine/math/rng.ts";
import { Layer } from "../../engine/scene/layer.ts";
import type { World } from "../../engine/scene/world.ts";
import type { NatureConfig } from "../config.ts";
import type { FeatureKind } from "../features/kinds.ts";
import type { NatureEnv } from "../env.ts";
import { SkyBackdrop } from "../scenery/backdrop.ts";
import { Rainbow } from "../weather/rainbow.ts";
import { Sun } from "../scenery/sun.ts";
import { MountainRange } from "../scenery/mountains.ts";
import { CloudField } from "../scenery/cloud.ts";
import { SunRays } from "../weather/rays.ts";
import { FlyerDirector } from "../scenery/flyer.ts";
import { BirdDirector } from "../scenery/bird.ts";
import { Lake } from "../scenery/lake.ts";
import { Meadow } from "../scenery/meadow.ts";
import { WildlifeDirector } from "../wildlife.ts";
import { Rain } from "../weather/rain.ts";
import { Snow } from "../weather/snow.ts";
import { LayerSpawner } from "./spawner.ts";
import { BiomeField } from "./biome.ts";

/** What landscape assembly hands back to the scene. */
export interface Landscape {
	spawners: LayerSpawner[];
}

/** Build all layers + atmosphere onto `world`. */
export function buildLandscape(
	world: World<NatureEnv>,
	config: NatureConfig,
	rng: Rng,
): Landscape {
	// ── Atmosphere (drawn behind the land) ─────────────────────────────
	// Back-to-front within the single sky layer: backdrop → rainbow → sun → mountains → clouds →
	// rays (breaking through the cloud) → flyers in front.
	const sky = new Layer<NatureEnv>("sky", 0);
	sky.add(new SkyBackdrop());
	sky.add(new Rainbow());
	sky.add(new Sun());
	sky.add(new MountainRange(rng.fork("mountains")));
	sky.add(new CloudField(rng.fork("clouds")));
	sky.add(new SunRays());
	sky.add(new FlyerDirector(rng.fork("flyer")));
	world.addLayer(sky);

	// ── Parallax land bands (far → near) ───────────────────────────────
	const n = Math.max(1, Math.round(config.parallaxLayers));
	const spawners: LayerSpawner[] = [];
	// One field shared by every band so they agree on the macro journey.
	const biomeField = new BiomeField(rng.fork("biome").seed);
	for (let i = 0; i < n; i++) {
		const f = n === 1 ? 1 : i / (n - 1); // 0 = far, 1 = near
		const depth = lerp(0.6, 0.92, f);
		const scale = lerp(0.74, 1.05, f);
		const shoreOffset = (1 - f) * 0.06; // far bands a touch higher (distant rolling ground)
		const layer = new Layer<NatureEnv>(`land-${i}`, depth);
		world.addLayer(layer);
		// Keep big rolling hills on the far bands (distant horizon, not foreground lumps), and keep
		// cabins/reeds off the hazy far band where their detail wouldn't read.
		const exclude: FeatureKind[] = [];
		if (f > 0.45) exclude.push("hill");
		if (f < 0.25) exclude.push("cabin", "reeds");
		spawners.push(
			new LayerSpawner(layer, rng.fork(`layer-${i}`), {
				depth,
				shoreOffset,
				scale,
				excludeKinds: exclude.length > 0 ? exclude : undefined,
				biomeField,
			}),
		);
	}

	// ── Birds drift just in front of the land ──────────────────────────
	const birds = new Layer<NatureEnv>("birds", 0.94);
	birds.add(new BirdDirector(rng.fork("birds")));
	world.addLayer(birds);

	// ── Water: the calm bottom band ────────────────────────────────────
	const water = new Layer<NatureEnv>("water", 1);
	water.add(new Lake(rng.fork("lake")));
	world.addLayer(water);

	// ── Meadow bank: the grassy edge, drawn on top so flowers reflect on the water ──
	const bank = new Layer<NatureEnv>("bank", 1.1);
	bank.add(new Meadow(rng.fork("meadow")));
	world.addLayer(bank);

	// ── Wildlife: deer, fish rises, butterflies — in front of the bank ──
	const life = new Layer<NatureEnv>("wildlife", 1.15);
	life.add(new WildlifeDirector(rng.fork("wildlife")));
	world.addLayer(life);

	// ── Weather: rain + snow fall over everything ──────────────────────
	const weather = new Layer<NatureEnv>("weather", 1.3);
	weather.add(new Rain(rng.fork("rain")));
	weather.add(new Snow(rng.fork("snow")));
	world.addLayer(weather);

	return { spawners };
}
