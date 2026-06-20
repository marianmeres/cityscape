/**
 * The {@link Entity} contract and its update/draw contexts.
 *
 * An entity is the atom of the simulation. It is split into two pure phases:
 *
 *  - **`update(ctx)`** — advance internal state by a fixed `dt`, reading the domain `Env`
 *    (mood, config, rng…). This is where appearance is *resolved* (e.g. a window decides its
 *    current colour from the mood).
 *  - **`draw(ctx)`** — append screen-space {@link DrawCommand}s describing how it currently
 *    looks. No domain reads, no clock, no DOM — just geometry + already-resolved colours.
 *
 * The engine is generic over a domain environment `Env` so it never depends on cityscape types;
 * cityscape instantiates `Entity<CityEnv>`. Dependencies point strictly inward.
 *
 * @module
 */

import type { DisplayListBuilder } from "../render/draw-command.ts";
import type { Camera } from "./camera.ts";

/** Passed to {@link Entity.update}; carries the per-tick simulation context. */
export interface UpdateContext<Env> {
	/** Fixed step delta, in milliseconds. */
	dt: number;
	/** Total simulated time so far, in milliseconds. */
	time: number;
	/** Current viewport width in CSS pixels. */
	width: number;
	/** Current viewport height in CSS pixels. */
	height: number;
	/** The domain environment (cityscape supplies mood/config/rng/event-bus). */
	env: Env;
}

/** Passed to {@link Entity.draw}; everything needed to emit screen-space primitives. */
export interface DrawContext {
	/** The frame's command sink. */
	out: DisplayListBuilder;
	/** The camera, for projecting world/local coordinates to screen space. */
	camera: Camera;
	/** Viewport width in CSS pixels. */
	width: number;
	/** Viewport height in CSS pixels. */
	height: number;
}

/** A simulated, drawable object living in a parallax {@link Layer}. */
export interface Entity<Env> {
	/** Parallax/atmosphere depth: `0` = far, `1` = near. */
	readonly depth: number;
	/**
	 * Horizontal world-space extent, used for viewport culling and spawn/recycle. `x` is the
	 * left edge in the layer's local coordinate space; `width` its span. Sky-fixed entities
	 * (gradient, moon) may report a huge/sentinel extent so they are never culled.
	 */
	readonly bounds: { x: number; width: number };
	/** When `false`, the owner may recycle/remove this entity. */
	alive: boolean;
	/** Advance internal state by `ctx.dt`. */
	update(ctx: UpdateContext<Env>): void;
	/** Append draw commands describing the current appearance. */
	draw(ctx: DrawContext): void;
}
