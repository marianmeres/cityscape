/**
 * The headless cityscape scene — the top-level, renderer-agnostic, DOM-free API.
 *
 * `createCityscape(config)` builds the whole simulation (camera, mood engine, parallax skyline,
 * ambient director) and returns a {@link CityscapeScene} you drive with `update(dt)` and read
 * with `collect(w, h)` → a {@link DisplayList}. Hand that list to *any* {@link Renderer}
 * (Canvas, ASCII, …). The orchestration order matters and lives here: step the camera, resolve
 * the mood, run the spawners against the new camera position, then update entities.
 *
 * Determinism: everything derives from `config.seed`. The same seed + config reproduces the exact
 * city — which is what the tests rely on and what the URL-hash permalink restores.
 *
 * @module
 */

import { createRng, normalizeSeed, type Rng } from "../engine/math/rng.ts";
import { clamp } from "../engine/math/ease.ts";
import { Camera } from "../engine/scene/camera.ts";
import { World } from "../engine/scene/world.ts";
import type { DisplayList } from "../engine/render/draw-command.ts";
import { type CityscapeConfig, DEFAULT_CONFIG, normalizeConfig } from "./config.ts";
import { MoodEngine } from "./mood.ts";
import { AmbientDirector, AmbientEventBus } from "./events.ts";
import { Building } from "./buildings/building.ts";
import type { CityEnv } from "./env.ts";
import { buildSkyline } from "./generation/skyline.ts";
import type { LayerSpawner } from "./generation/spawner.ts";

/** The public, headless scene contract. */
export interface CityscapeScene {
	/** The simulation world (camera + parallax layers). */
	readonly world: World<CityEnv>;
	/** The live, normalised configuration (mutated by {@link CityscapeScene.setConfig}). */
	readonly config: CityscapeConfig;
	/** Ambient-event bus — subscribe to drive audio. */
	readonly events: AmbientEventBus;
	/** Total simulated time, ms. */
	readonly time: number;
	/** Advance the simulation by `dtMs` (call once per fixed step). */
	update(dtMs: number): void;
	/** Produce this frame's renderer-agnostic {@link DisplayList}. */
	collect(width: number, height: number): DisplayList;
	/** Notify of a viewport resize. */
	resize(width: number, height: number): void;
	/** Apply a partial config change (from the panel / permalink). */
	setConfig(patch: Partial<CityscapeConfig>): void;
	/** A pointer-parallax sway in screen px — horizontal `px` and (optional) vertical `py`. */
	setSway(px: number, py?: number): void;
	/** Light interaction: flash the windows of the nearest building under a screen point. */
	poke(screenX: number, screenY: number): void;
}

class Cityscape implements CityscapeScene {
	config: CityscapeConfig;
	events = new AmbientEventBus();
	time = 0;

	#world!: World<CityEnv>;
	#mood!: MoodEngine;
	#director!: AmbientDirector;
	#spawners!: LayerSpawner[];
	#env!: CityEnv;
	#seed = 0;

	constructor(config: CityscapeConfig) {
		this.config = config;
		this.#build();
	}

	get world(): World<CityEnv> {
		return this.#world;
	}

	/** (Re)construct the simulation from the current config + seed. */
	#build(): void {
		this.#seed = normalizeSeed(this.config.seed);
		const rng: Rng = createRng(this.#seed);
		this.#mood = new MoodEngine(this.config, this.#seed);
		this.#director = new AmbientDirector(rng.fork("ambient"), this.events);
		this.#world = new World<CityEnv>(
			new Camera({ speed: signedSpeed(this.config), minParallax: 0.18 }),
		);
		this.#env = { config: this.config, mood: this.#mood.mood, bus: this.events };
		const skyline = buildSkyline(this.#world, this.config, rng.fork("skyline"));
		this.#spawners = skyline.spawners;
	}

	resize(width: number, height: number): void {
		this.#world.resize(width, height);
		// Prime the scene so the very first `collect()` is valid even if the render loop paints a
		// frame before its first fixed `update()` step (a 0ms first delta dispatches no steps). A
		// dt=0 tick resolves the mood, spawns the initial skyline, and seeds entity caches.
		if (width > 0 && height > 0) this.#tick(0);
	}

	update(dtMs: number): void {
		if (!(dtMs > 0)) return;
		this.time += dtMs;
		this.#tick(dtMs);
	}

	/** One simulation step. `dtMs === 0` primes/refreshes without advancing time or events. */
	#tick(dtMs: number): void {
		const cam = this.#world.camera;
		cam.speed = signedSpeed(this.config);
		cam.zoom = this.config.zoom;
		// Vertical camera position: a static aim plus a slow automatic float, bounded so the
		// backdrop/water over-draw always covers the shift.
		const h = cam.height;
		const bob = Math.sin(this.time * 0.00013) * this.config.verticalDrift * h;
		cam.offsetY = clamp(this.config.cameraHeight * h + bob, -0.25 * h, 0.25 * h);
		this.#mood.update(this.time, this.config);
		if (dtMs > 0) this.#director.update(dtMs, this.config);
		cam.step(dtMs);
		for (const sp of this.#spawners) sp.sync(cam, cam.width, this.#env);
		this.#world.updateEntities({
			dt: dtMs,
			time: this.time,
			width: cam.width,
			height: cam.height,
			env: this.#env,
		});
	}

	collect(width: number, height: number): DisplayList {
		return this.#world.collect(width, height);
	}

	setConfig(patch: Partial<CityscapeConfig>): void {
		const next = normalizeConfig({ ...this.config, ...patch });
		const structural = next.seed !== this.config.seed ||
			next.parallaxLayers !== this.config.parallaxLayers;
		const paletteChanged = next.palette !== this.config.palette;
		// Mutate in place so #env.config (same reference) sees the change.
		Object.assign(this.config, next);
		if (structural) {
			const cam = this.#world.camera;
			const { width, height } = cam;
			this.#build();
			this.resize(width, height); // re-prime the freshly rebuilt world
		} else if (paletteChanged) {
			this.#mood.setPalette(this.config.palette);
		}
	}

	setSway(px: number, py = 0): void {
		this.#world.camera.sway = px;
		this.#world.camera.swayY = py;
	}

	poke(screenX: number, _screenY: number): void {
		// Find the nearest (highest-depth) building band and flash the building under the point.
		const buildingLayers = this.#world.layers.filter((l) =>
			l.name.startsWith("buildings-")
		);
		for (let i = buildingLayers.length - 1; i >= 0; i--) {
			const layer = buildingLayers[i];
			const cam = this.#world.camera;
			for (const e of layer.entities) {
				if (!(e instanceof Building)) continue;
				const l = cam.project(e.bounds.x, layer.depth);
				const r = cam.project(e.bounds.x + e.bounds.width, layer.depth);
				if (screenX >= l && screenX <= r) {
					e.flash();
					return;
				}
			}
		}
	}
}

/** Resolve the signed scroll speed from the config (direction × magnitude). */
function signedSpeed(config: CityscapeConfig): number {
	return config.cameraSpeed * (config.cameraDirection === "left" ? -1 : 1);
}

/**
 * Create a headless cityscape simulation. Pass any subset of {@link CityscapeConfig}; the rest
 * fills from {@link DEFAULT_CONFIG} and everything is clamped to valid ranges.
 */
export function createCityscape(
	config: Partial<CityscapeConfig> = {},
): CityscapeScene {
	return new Cityscape(normalizeConfig({ ...DEFAULT_CONFIG, ...config }));
}
