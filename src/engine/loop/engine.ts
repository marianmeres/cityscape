/**
 * The {@link Engine}: a frame loop that drives a fixed-step `update` and a variable `render`.
 *
 * Crucially, the engine does **not** import `requestAnimationFrame` or read a clock — both the
 * frame scheduler and the timestamps are injected. The browser supplies an rAF-backed
 * {@link FrameScheduler} in `runtime/`; a test can supply a synthetic one and drive frames by
 * hand. That keeps this control-flow core DOM-free and unit-testable.
 *
 * @module
 */

import { clamp } from "../math/ease.ts";
import { FixedStepper } from "../time/clock.ts";

/** Cancels a previously-scheduled frame. */
export type CancelFrame = () => void;

/**
 * Schedules `cb` to run on the next frame, handing it a monotonic timestamp in milliseconds.
 * Returns a canceller. (Browser impl wraps `requestAnimationFrame`/`cancelAnimationFrame`.)
 */
export type FrameScheduler = (cb: (timeMs: number) => void) => CancelFrame;

/** Engine wiring. `step` is the fixed-dt simulation tick; `render` paints a frame. */
export interface EngineOptions {
	/** Fixed-step simulation update; called 0..N times per frame with a constant `dt`. */
	step: (dt: number) => void;
	/** Render a frame; `alpha` is the sub-step interpolation factor (`0..1`). */
	render: (alpha: number) => void;
	/** Injected frame scheduler (browser: rAF). */
	scheduler: FrameScheduler;
	/** Fixed step size in ms (default 1000/60). */
	fixedStepMs?: number;
	/** Max steps per frame, spiral-of-death guard (default 5). */
	maxStepsPerFrame?: number;
	/** Clamp for a single frame's measured delta, ms (default 250). */
	maxFrameDeltaMs?: number;
}

/** A start/stop/pause frame loop. */
export class Engine {
	readonly stepper: FixedStepper;

	#opts: EngineOptions;
	#running = false;
	#last: number | null = null;
	#cancel: CancelFrame | null = null;
	#maxFrameDelta: number;

	constructor(opts: EngineOptions) {
		this.#opts = opts;
		this.stepper = new FixedStepper(opts.fixedStepMs, opts.maxStepsPerFrame ?? 5);
		this.#maxFrameDelta = opts.maxFrameDeltaMs ?? 250;
	}

	/** Whether the loop is currently scheduling frames. */
	get running(): boolean {
		return this.#running;
	}

	/** Begin the loop (no-op if already running). */
	start(): void {
		if (this.#running) return;
		this.#running = true;
		this.#last = null;
		this.#schedule();
	}

	/** Stop the loop and cancel any pending frame. */
	stop(): void {
		this.#running = false;
		this.#cancel?.();
		this.#cancel = null;
	}

	/** Pause (alias of stop that reads as intent). */
	pause(): void {
		this.stop();
	}

	/** Resume after a pause; resets the delta baseline to avoid a time jump. */
	resume(): void {
		if (this.#running) return;
		this.start();
	}

	#schedule(): void {
		this.#cancel = this.#opts.scheduler(this.#frame);
	}

	#frame = (time: number): void => {
		if (!this.#running) return;
		if (this.#last == null) this.#last = time;
		const delta = clamp(time - this.#last, 0, this.#maxFrameDelta);
		this.#last = time;
		const { alpha } = this.stepper.advance(delta, this.#opts.step);
		this.#opts.render(alpha);
		this.#schedule();
	};
}
