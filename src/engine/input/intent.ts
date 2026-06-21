/**
 * Pure keyboard-intent model — the engine half of keyboard/button input.
 *
 * Like the pointer model in `input.ts`, the *data* of intent (which abstract actions are held, and
 * which fired this step) lives here, DOM-free and testable; the runtime owns the actual `keydown`/
 * `keyup` listeners that feed it. A {@link KeyMap} maps physical key codes (`KeyboardEvent.code`) to
 * abstract action names, so rebinding is data. Edge flags (`pressed`/`released`) are aged once per
 * fixed step via {@link IntentState.tick}, so they are frame-rate independent and a recorded stream
 * of `(step, keys)` replays a session exactly — input becomes just another deterministic input
 * alongside the seed.
 *
 * @module
 */

/** Maps a physical key code (`KeyboardEvent.code`) to an abstract action name. */
export type KeyMap = Record<string, string>;

/**
 * Tracks which abstract actions are held and which crossed an edge since the last {@link tick}.
 * Pure: it never touches the DOM — call {@link keyDown}/{@link keyUp} from a runtime adapter.
 */
export class IntentState {
	#map: KeyMap;
	#held = new Set<string>();
	#pressed = new Set<string>();
	#released = new Set<string>();

	constructor(map: KeyMap = {}) {
		this.#map = map;
	}

	/** Rebind at runtime (data-driven key mapping). */
	setMap(map: KeyMap): void {
		this.#map = map;
	}

	/** Feed a key-down by its `KeyboardEvent.code`. Ignores auto-repeat and unmapped keys. */
	keyDown(code: string): void {
		const action = this.#map[code];
		if (!action || this.#held.has(action)) return;
		this.#held.add(action);
		this.#pressed.add(action);
	}

	/** Feed a key-up by its `KeyboardEvent.code`. */
	keyUp(code: string): void {
		const action = this.#map[code];
		if (!action || !this.#held.has(action)) return;
		this.#held.delete(action);
		this.#released.add(action);
	}

	/** Whether `action` is currently held. */
	held(action: string): boolean {
		return this.#held.has(action);
	}

	/** Whether `action` went down since the last {@link tick} (a rising edge). */
	pressed(action: string): boolean {
		return this.#pressed.has(action);
	}

	/** Whether `action` came up since the last {@link tick} (a falling edge). */
	released(action: string): boolean {
		return this.#released.has(action);
	}

	/** A snapshot of the actions that fired this step (rising edges). */
	consumePressed(): string[] {
		return [...this.#pressed];
	}

	/** Age the edge flags — call once per fixed step, *after* reading them. */
	tick(): void {
		this.#pressed.clear();
		this.#released.clear();
	}

	/** Forget everything (e.g. on window blur, so no key stays stuck "held"). */
	reset(): void {
		this.#held.clear();
		this.#pressed.clear();
		this.#released.clear();
	}
}
