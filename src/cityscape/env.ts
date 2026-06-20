/**
 * The domain environment handed to every cityscape entity each tick.
 *
 * This is the concrete `Env` that instantiates the engine's generic `Entity<Env>`. It bundles
 * the live config, the current resolved {@link Mood}, and the ambient event bus — everything an
 * entity needs to update without reaching outside the simulation.
 *
 * @module
 */

import type { CityscapeConfig } from "./config.ts";
import type { Mood } from "./mood.ts";
import type { AmbientEventBus } from "./events.ts";

/** Per-tick simulation environment shared by all cityscape entities. */
export interface CityEnv {
	/** Live, normalised configuration (panel edits land here). */
	config: CityscapeConfig;
	/** The current resolved mood snapshot (refreshed each tick by the scene). */
	mood: Mood;
	/** Ambient-event sink (windows, etc. may emit; audio consumes). */
	bus: AmbientEventBus;
}

/** A cityscape entity: an engine {@link Entity} bound to {@link CityEnv}. */
export type { Entity } from "../engine/scene/entity.ts";
