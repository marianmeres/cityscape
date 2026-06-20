/**
 * The domain environment handed to every naturescape entity each tick.
 *
 * This is the concrete `Env` that instantiates the engine's generic `Entity<Env>`. It bundles the
 * live config, the current resolved {@link Mood} (day light + season), and the ambient event bus —
 * everything an entity needs to update without reaching outside the simulation.
 *
 * @module
 */

import type { NatureConfig } from "./config.ts";
import type { Mood } from "./mood.ts";
import type { AmbientEventBus } from "./events.ts";

/** Per-tick simulation environment shared by all naturescape entities. */
export interface NatureEnv {
	/** Live, normalised configuration (panel edits land here). */
	config: NatureConfig;
	/** The current resolved mood snapshot (refreshed each tick by the scene). */
	mood: Mood;
	/** Ambient-event sink (audio consumes). */
	bus: AmbientEventBus;
}

/** A naturescape entity: an engine {@link Entity} bound to {@link NatureEnv}. */
export type { Entity } from "../engine/scene/entity.ts";
