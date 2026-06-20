/**
 * Pure pointer-input model.
 *
 * The *data* of pointer interaction (position, whether inside, pressed) and the pure math that
 * turns it into effects (a parallax sway offset, a wheel→speed nudge) live here, DOM-free. The
 * actual DOM event listeners that populate a {@link PointerState} live in `runtime/` — so the
 * interaction policy is testable and the engine never imports an event target.
 *
 * @module
 */

import { clamp } from "../math/ease.ts";

/** A snapshot of pointer state, normalised by the runtime. */
export interface PointerState {
	/** Pointer x in CSS pixels (viewport-relative). */
	x: number;
	/** Pointer y in CSS pixels (viewport-relative). */
	y: number;
	/** Whether the pointer is over the viewport. */
	inside: boolean;
	/** Whether a button is currently pressed. */
	down: boolean;
}

/** A neutral pointer state (nothing hovering). */
export function createPointerState(): PointerState {
	return { x: 0, y: 0, inside: false, down: false };
}

/**
 * The screen-space sway offset for pointer-parallax: maps the pointer's horizontal position
 * (relative to viewport center) to a `[-maxPx, maxPx]` offset. Returns `0` when the pointer is
 * outside, so the scene eases back to rest. Pure.
 */
export function parallaxSway(
	pointer: PointerState,
	viewportWidth: number,
	maxPx: number,
): number {
	if (!pointer.inside || viewportWidth <= 0) return 0;
	const centered = (pointer.x / viewportWidth) * 2 - 1; // -1..1
	return clamp(centered, -1, 1) * maxPx;
}
