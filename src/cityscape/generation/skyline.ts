/**
 * Skyline assembly — wires the parallax layers and atmosphere onto a {@link World}.
 *
 * It spreads `parallaxLayers` building bands from far to near (each with its own depth, ground
 * baseline, and size scale so distant bands sit higher and smaller), gives each a
 * {@link LayerSpawner}, and adds the atmosphere (sky backdrop, stars, moon, clouds, flyers,
 * birds). Returns the spawners so the scene can drive them each tick.
 *
 * @module
 */

import { lerp } from "../../engine/math/ease.ts";
import type { Rng } from "../../engine/math/rng.ts";
import { Layer } from "../../engine/scene/layer.ts";
import type { World } from "../../engine/scene/world.ts";
import type { CityscapeConfig } from "../config.ts";
import type { BuildingKind } from "../buildings/kinds.ts";
import type { CityEnv } from "../env.ts";
import { SkyBackdrop } from "../sky/backdrop.ts";
import { Aurora } from "../sky/aurora.ts";
import { Starfield } from "../sky/starfield.ts";
import { Moon } from "../sky/moon.ts";
import { CloudField } from "../sky/cloud.ts";
import { FlyerDirector } from "../sky/flyer.ts";
import { BirdDirector } from "../sky/bird.ts";
import { Water } from "../sky/water.ts";
import { Shore } from "../sky/shore.ts";
import { GroundFog } from "../sky/fog.ts";
import { TrafficDirector } from "../sky/traffic.ts";
import { LayerSpawner } from "./spawner.ts";
import { BiomeField } from "./biome.ts";

/** What skyline assembly hands back to the scene. */
export interface Skyline {
	spawners: LayerSpawner[];
}

/** Build all layers + atmosphere onto `world`. */
export function buildSkyline(
	world: World<CityEnv>,
	config: CityscapeConfig,
	rng: Rng,
): Skyline {
	// ── Atmosphere (drawn behind the buildings) ───────────────────────
	// Added in back-to-front order (a single layer draws in insertion order): backdrop →
	// stars → moon → high flyers (planes/satellites/shooting stars) → clouds in front of them.
	const sky = new Layer<CityEnv>("sky", 0);
	sky.add(new SkyBackdrop());
	sky.add(new Aurora(rng.fork("aurora")));
	sky.add(new Starfield(rng.fork("stars")));
	sky.add(new Moon(rng.fork("moon")));
	sky.add(new FlyerDirector(rng.fork("flyer")));
	sky.add(new CloudField(rng.fork("clouds")));
	world.addLayer(sky);

	// ── Parallax building bands (far → near) ──────────────────────────
	// Ranges are deliberately tight so the bands read as one close-together skyline — even with
	// just 2 layers they sit near each other in parallax speed, size, and shore stagger.
	const n = Math.max(1, Math.round(config.parallaxLayers));
	const spawners: LayerSpawner[] = [];
	// One field shared by every band so they agree on the macro journey. `fork` derives a stable
	// seed without consuming the parent stream, so the other forks above are unaffected.
	const biomeField = new BiomeField(rng.fork("biome").seed);
	for (let i = 0; i < n; i++) {
		const f = n === 1 ? 1 : i / (n - 1); // 0 = far, 1 = near
		const depth = lerp(0.6, 0.92, f);
		const scale = lerp(0.78, 1.05, f);
		const shoreOffset = (1 - f) * 0.05; // far bands a touch higher (distant shore)
		const layer = new Layer<CityEnv>(`buildings-${i}`, depth);
		world.addLayer(layer);
		// Keep skyscrapers out of the nearest band (up close they'd dominate the frame), and keep
		// hills off the nearer bands so they read as a distant rolling horizon, not foreground lumps.
		const isFront = i === n - 1;
		const exclude: BuildingKind[] = [];
		if (isFront) exclude.push("skyscraper");
		if (f > 0.4) exclude.push("hill");
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

	// ── Birds drift just in front of the skyline ───────────────────────
	const birds = new Layer<CityEnv>("birds", 0.94);
	birds.add(new BirdDirector(rng.fork("birds")));
	world.addLayer(birds);

	// ── Water: the calm bottom third ───────────────────────────────────
	const water = new Layer<CityEnv>("water", 1);
	water.add(new Water(rng.fork("water")));
	world.addLayer(water);

	// ── Ground fog: a low mist hazing the base of the skyline ──────────
	const fog = new Layer<CityEnv>("fog", 1.05);
	fog.add(new GroundFog());
	world.addLayer(fog);

	// ── Shore: the lit embankment, drawn on top so its lamps reflect on the water ──
	const shore = new Layer<CityEnv>("shore", 1.1);
	shore.add(new Shore(rng.fork("shore")));
	world.addLayer(shore);

	// ── Traffic: sparse headlights crossing the embankment, drawn in front of the shore ──
	const traffic = new Layer<CityEnv>("traffic", 1.12);
	traffic.add(new TrafficDirector(rng.fork("traffic")));
	world.addLayer(traffic);

	return { spawners };
}
