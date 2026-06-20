/**
 * Ambient events — the simulation's *decision* to make a sound, kept separate from any audio.
 *
 * A calm valley occasionally produces birdsong, a gust of breeze through the leaves, the trickle
 * of water, a rustle in the grass. Whether and when that happens is part of the (pure,
 * deterministic) simulation; *how* it sounds is a browser concern handled by the WebAudio adapter
 * in `../audio`. The two meet at this bus — the same pattern the cityscape uses, with its own
 * nature vocabulary — keeping the core DOM-free and the audio layer swappable (or absent).
 *
 * @module
 */

import type { Rng } from "../engine/math/rng.ts";
import type { NatureConfig } from "./config.ts";

/** Kinds of ambient sound the valley can call for. */
export type AmbientEventType = "birdsong" | "breeze" | "water" | "rustle";

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
	birdsong: 4,
	breeze: 4,
	water: 2,
	rustle: 1.5,
};
const TYPES = Object.keys(TYPE_WEIGHTS) as AmbientEventType[];
const WEIGHTS = TYPES.map((t) => TYPE_WEIGHTS[t]);

/**
 * Drives sparse, deterministic ambient cues onto a bus. It keeps a countdown to the next event;
 * each fire schedules the next one a random (calm) interval later. Rain nudges the cadence toward
 * the soft, busier end while keeping it low so it never distracts.
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
		// 5–18 seconds between cues.
		return this.#rng.float(5000, 18000);
	}

	/** Advance by `dt` ms; may emit one cue. */
	update(dt: number, config: NatureConfig): void {
		this.#timer -= dt * (1 + config.wind * 0.5);
		if (this.#timer > 0) return;
		this.#timer = this.#nextInterval();
		// When it rains, lean toward water/breeze and hush the birds a touch.
		const weights = config.rain > 0.2
			? TYPES.map((t, i) =>
				t === "water"
					? WEIGHTS[i] * 2.5
					: t === "birdsong"
					? WEIGHTS[i] * 0.4
					: WEIGHTS[i]
			)
			: WEIGHTS;
		const type = this.#rng.weighted(TYPES, weights);
		this.#bus.emit({
			type,
			intensity: this.#rng.float(0.25, type === "breeze" ? 0.7 : 0.55),
			pan: this.#rng.float(-0.8, 0.8),
		});
	}
}
