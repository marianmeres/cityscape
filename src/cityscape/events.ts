/**
 * Ambient events — the simulation's *decision* to make a sound, kept separate from any audio.
 *
 * A calm city occasionally produces a distant car horn, a gust of wind, a low rumble. Whether
 * and when that happens is part of the (pure, deterministic) simulation; *how* it sounds is a
 * browser concern handled by the WebAudio adapter in `../audio`. The two meet at this bus. This
 * keeps the core DOM-free and makes the audio layer swappable (or absent) without touching the
 * sim — and lets the event cadence be unit-tested.
 *
 * @module
 */

import type { Rng } from "../engine/math/rng.ts";
import type { CityscapeConfig } from "./config.ts";

/** Kinds of ambient sound the city can call for. */
export type AmbientEventType = "horn" | "wind" | "rumble" | "chime";

/** A single ambient cue. */
export interface AmbientEvent {
	type: AmbientEventType;
	/** Loudness hint `0..1`. */
	intensity: number;
	/** Stereo pan hint `-1` (left) .. `1` (right). */
	pan: number;
}

/** Receives ambient cues. */
export type AmbientListener = (event: AmbientEvent) => void;

/** A tiny synchronous pub/sub for {@link AmbientEvent}s. */
export class AmbientEventBus {
	#listeners = new Set<AmbientListener>();

	/** Subscribe; returns an unsubscribe function. */
	on(fn: AmbientListener): () => void {
		this.#listeners.add(fn);
		return () => this.#listeners.delete(fn);
	}

	/** Emit a cue to all listeners. */
	emit(event: AmbientEvent): void {
		for (const fn of this.#listeners) fn(event);
	}
}

/** Relative likelihood of each event type when one fires. */
const TYPE_WEIGHTS: Record<AmbientEventType, number> = {
	wind: 5,
	rumble: 2.5,
	horn: 1.5,
	chime: 1,
};
const TYPES = Object.keys(TYPE_WEIGHTS) as AmbientEventType[];
const WEIGHTS = TYPES.map((t) => TYPE_WEIGHTS[t]);

/**
 * Drives sparse, deterministic ambient cues onto a bus. It keeps a countdown to the next event;
 * each fire schedules the next one a random (calm) interval later. Density scales with the
 * scene's activity but stays low so it never distracts.
 */
export class AmbientDirector {
	#rng: Rng;
	#bus: AmbientEventBus;
	#timer: number;

	constructor(rng: Rng, bus: AmbientEventBus) {
		this.#rng = rng;
		this.#bus = bus;
		this.#timer = this.#nextInterval();
	}

	#nextInterval(): number {
		// 7–22 seconds between cues.
		return this.#rng.float(7000, 22000);
	}

	/** Advance by `dt` ms; may emit one cue. */
	update(dt: number, _config: CityscapeConfig): void {
		this.#timer -= dt;
		if (this.#timer > 0) return;
		this.#timer = this.#nextInterval();
		const type = this.#rng.weighted(TYPES, WEIGHTS);
		this.#bus.emit({
			type,
			intensity: this.#rng.float(0.25, type === "wind" ? 0.7 : 0.55),
			pan: this.#rng.float(-0.8, 0.8),
		});
	}
}
