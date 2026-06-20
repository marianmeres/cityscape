/**
 * The {@link World}: the simulation root — a camera plus an ordered stack of parallax layers.
 *
 * The world owns the painter's-algorithm ordering (layers drawn far → near) and the single
 * reused {@link DisplayListBuilder}. It deliberately exposes camera stepping, entity updating,
 * and collection as *separate* methods so an orchestrator (cityscape's scene) can interleave its
 * own work — advance the camera, run spawners against the new position, then update entities —
 * without the engine knowing what a "spawner" is.
 *
 * @module
 */

import { type DisplayList, DisplayListBuilder } from "../render/draw-command.ts";
import { Camera } from "./camera.ts";
import type { Layer } from "./layer.ts";
import type { DrawContext, UpdateContext } from "./entity.ts";

/** A camera + an ordered stack of {@link Layer}s. Generic over the domain environment `Env`. */
export class World<Env> {
	readonly camera: Camera;
	/** Layers in paint order: index 0 is farthest (drawn first). */
	readonly layers: Layer<Env>[] = [];

	#builder: DisplayListBuilder;

	constructor(camera: Camera = new Camera()) {
		this.camera = camera;
		this.#builder = new DisplayListBuilder(0, 0);
	}

	/** Append a layer. Layers are kept sorted by depth ascending (far first). */
	addLayer(layer: Layer<Env>): Layer<Env> {
		this.layers.push(layer);
		this.layers.sort((a, b) => a.depth - b.depth);
		return layer;
	}

	/** Look up a layer by name. */
	layer(name: string): Layer<Env> | undefined {
		return this.layers.find((l) => l.name === name);
	}

	/** Update the viewport size on the camera. */
	resize(width: number, height: number): void {
		this.camera.resize(width, height);
	}

	/** Advance the camera scroll by `dt` ms. */
	stepCamera(dt: number): void {
		this.camera.step(dt);
	}

	/** Update every layer's entities with the given context. */
	updateEntities(ctx: UpdateContext<Env>): void {
		for (let i = 0; i < this.layers.length; i++) this.layers[i].update(ctx);
	}

	/**
	 * Produce this frame's {@link DisplayList}: reset the reused builder, then draw every layer
	 * far → near. Pure read of current state — no simulation mutation.
	 */
	collect(width: number, height: number): DisplayList {
		const out = this.#builder.reset(width, height);
		const ctx: DrawContext = { out, camera: this.camera, width, height };
		for (let i = 0; i < this.layers.length; i++) this.layers[i].draw(ctx);
		out.offsetY = this.camera.offsetY + this.camera.swayY;
		return out;
	}
}
