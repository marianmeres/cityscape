/**
 * Time-stepping primitives, decoupled from any frame source.
 *
 * Real animation frames arrive at irregular intervals; a robust simulation steps at a *fixed*
 * delta so behaviour is frame-rate-independent and deterministic. {@link FixedStepper} accumulates
 * wall-clock time and dispatches whole fixed steps, clamping a runaway accumulator (the classic
 * "spiral of death" guard) so a backgrounded tab that wakes after seconds doesn't explode.
 *
 * Pure: it does not read the clock itself — the caller feeds elapsed time. That keeps it
 * unit-testable with synthetic time.
 *
 * @module
 */

/** Result of advancing a {@link FixedStepper}. */
export interface StepResult {
	/** How many fixed steps were dispatched this advance. */
	steps: number;
	/**
	 * Interpolation factor `0..1` for the leftover sub-step time — renderers can lerp visual
	 * state between the last two fixed steps for smoothness. (We keep it simple and mostly
	 * ignore it, but exposing it is part of doing the loop properly.)
	 */
	alpha: number;
}

/**
 * Dispatches fixed-delta update steps from a stream of variable elapsed times.
 *
 * ```ts
 * const stepper = new FixedStepper(1000 / 60);
 * // each frame:
 * stepper.advance(deltaMs, (dt) => world.update(dt));
 * ```
 */
export class FixedStepper {
	/** The fixed step size, in milliseconds. */
	readonly stepMs: number;
	/** Max steps dispatched per `advance` (spiral-of-death clamp). */
	readonly maxSteps: number;
	/** Total simulated time dispatched so far, in milliseconds. */
	elapsed = 0;

	#acc = 0;

	constructor(stepMs: number = 1000 / 60, maxSteps = 5) {
		if (stepMs <= 0) throw new RangeError("stepMs must be > 0");
		this.stepMs = stepMs;
		this.maxSteps = Math.max(1, Math.floor(maxSteps));
	}

	/**
	 * Add `deltaMs` of real time and dispatch `fn(stepMs)` for each whole fixed step that fits.
	 * Excess time beyond `maxSteps` is dropped (we fall behind rather than freeze).
	 */
	advance(deltaMs: number, fn: (dt: number) => void): StepResult {
		if (!(deltaMs > 0)) return { steps: 0, alpha: this.#acc / this.stepMs };
		this.#acc += deltaMs;
		let steps = 0;
		while (this.#acc >= this.stepMs && steps < this.maxSteps) {
			fn(this.stepMs);
			this.elapsed += this.stepMs;
			this.#acc -= this.stepMs;
			steps++;
		}
		// If we hit the clamp, discard the backlog so we don't replay it next frame.
		if (this.#acc >= this.stepMs) this.#acc = 0;
		return { steps, alpha: this.#acc / this.stepMs };
	}

	/** Reset the accumulator and simulated clock. */
	reset(): void {
		this.#acc = 0;
		this.elapsed = 0;
	}
}
