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
	/**
	 * Optional cap on the *render* rate. The fixed-step `step` still runs every scheduled frame
	 * (simulation stays real-time); only `render` is throttled — skipped when too little injected
	 * time has elapsed since the last paint. Default `undefined` = render every frame (unchanged).
	 *
	 * Useful on high-refresh (120 Hz+) panels for always-animating scenes where 60 fps is plenty:
	 * halving the paint work with no perceptible loss. This caps the *maximum* rate only — pausing
	 * an idle scene entirely is domain-specific and stays app-side (`stop()`, or gate in `render`).
	 */
	maxFps?: number;
}

/** A start/stop/pause frame loop. */
export class Engine {
	readonly stepper: FixedStepper;

	#opts: EngineOptions;
	#running = false;
	#last: number | null = null;
	#cancel: CancelFrame | null = null;
	#maxFrameDelta: number;
	/**
	 * Minimum injected-time gap between paints, ms (0 = uncapped). Derived with a 0.8 margin below
	 * one target-rate frame *on purpose*: at an exact `1000/maxFps` gap a true-`maxFps` panel's
	 * frames land right on the threshold and beat-skip to half the intended rate. The margin lets
	 * every on-cadence frame through while still dropping every other frame of a 2× panel.
	 */
	#minRenderMs: number;
	/** Injected time accumulated since the last render; gates the `maxFps` cap. */
	#sinceRender = 0;

	constructor(opts: EngineOptions) {
		this.#opts = opts;
		this.stepper = new FixedStepper(opts.fixedStepMs, opts.maxStepsPerFrame ?? 5);
		this.#maxFrameDelta = opts.maxFrameDeltaMs ?? 250;
		this.#minRenderMs = opts.maxFps && opts.maxFps > 0
			? (1000 / opts.maxFps) * 0.8
			: 0;
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
		this.#sinceRender = 0;
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
		const first = this.#last == null;
		if (this.#last == null) this.#last = time;
		const raw = time - this.#last;
		this.#last = time;
		// A gap far larger than any real frame means we were backgrounded or occluded — a hidden
		// tab, or an alt-tabbed / covered window (cases that don't always fire `visibilitychange`,
		// so the loop kept running with throttled frames). Resume cleanly: repaint the current
		// state and advance the simulation by *nothing*, so there's no catch-up jump or stutter.
		// Normal frames fall through to the fixed-step advance.
		if (raw > this.#maxFrameDelta) {
			const { alpha } = this.stepper.advance(0, this.#opts.step);
			// A recovery repaint after a background gap — always paint, ignoring the fps cap.
			this.#sinceRender = 0;
			this.#opts.render(alpha);
			this.#schedule();
			return;
		}
		const delta = clamp(raw, 0, this.#maxFrameDelta);
		const { alpha } = this.stepper.advance(delta, this.#opts.step);
		// Simulation advanced above every frame; the render may be throttled by `maxFps`. Always
		// paint the first frame and whenever uncapped; otherwise only once the min gap has elapsed.
		this.#sinceRender += delta;
		if (first || this.#minRenderMs === 0 || this.#sinceRender >= this.#minRenderMs) {
			this.#sinceRender = 0;
			this.#opts.render(alpha);
		}
		this.#schedule();
	};
}
