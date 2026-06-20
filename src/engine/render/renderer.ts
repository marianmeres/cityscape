/**
 * The {@link Renderer} interface — the swappable target seam.
 *
 * A renderer is the *only* thing that knows about a concrete drawing target. It receives a
 * {@link DisplayList} (pure data, already projected to screen space) and realises it. The
 * simulation depends on this interface, never on an implementation. We ship two:
 *
 *  - `CanvasRenderer`  (`./render/canvas`) — Canvas2D, the production target.
 *  - `AsciiRenderer`   (`./render/ascii`)  — a character grid; proves the seam is real, and being
 *                                            string-producing it is itself unit-testable.
 *
 * @module
 */

import type { DisplayList } from "./draw-command.ts";

/** A consumer of {@link DisplayList}s. The whole renderer contract. */
export interface Renderer {
	/**
	 * Notify the renderer of the target's logical size (CSS pixels) and device pixel ratio.
	 * Called on init and whenever the viewport changes.
	 */
	resize(width: number, height: number, dpr?: number): void;

	/** Realise one frame. Implementations clear/paint as appropriate for their target. */
	render(list: DisplayList): void;

	/** Optional teardown (detach observers, free contexts). */
	dispose?(): void;
}
