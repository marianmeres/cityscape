/**
 * A {@link Layer}: one parallax depth band holding a set of entities.
 *
 * Layers are a dumb container by design — they update and draw their entities and prune dead
 * ones. The *policy* of what populates a layer (spawning, recycling, district streams) lives in
 * the domain (cityscape's spawner), keeping the engine reusable.
 *
 * @module
 */

import type { DrawContext, Entity, UpdateContext } from "./entity.ts";

/** A parallax depth band. `depth` `0` = far, `1` = near. */
export class Layer<Env> {
	/** Identifying name (useful for debugging / targeted lookups). */
	readonly name: string;
	/** Parallax/atmosphere depth shared by everything in this band. */
	readonly depth: number;
	/** The live entity set, drawn in insertion order (back to front within the band). */
	readonly entities: Entity<Env>[] = [];

	constructor(name: string, depth: number) {
		this.name = name;
		this.depth = depth;
	}

	/** Add an entity to the band. */
	add(entity: Entity<Env>): void {
		this.entities.push(entity);
	}

	/** Remove all entities. */
	clear(): void {
		this.entities.length = 0;
	}

	/** Update every entity, then drop any that died this tick. */
	update(ctx: UpdateContext<Env>): void {
		const list = this.entities;
		for (let i = 0; i < list.length; i++) list[i].update(ctx);
		// Compact in place (cheaper than filter; preserves order).
		let w = 0;
		for (let i = 0; i < list.length; i++) {
			if (list[i].alive) list[w++] = list[i];
		}
		list.length = w;
	}

	/** Draw every entity into the frame's command sink. */
	draw(ctx: DrawContext): void {
		const list = this.entities;
		for (let i = 0; i < list.length; i++) list[i].draw(ctx);
	}
}
