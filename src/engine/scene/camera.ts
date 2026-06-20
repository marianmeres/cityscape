/**
 * The {@link Camera}: a single horizontal scroll position plus depth-aware parallax projection.
 *
 * The world is an infinite side-scroll. Rather than move every entity, we move one camera and
 * project. Parallax falls out of a single rule: a layer at `depth` scrolls by
 * `scroll * parallaxAt(depth)`, so near layers (depth→1) slide fast and far layers (depth→0)
 * barely move. Entities store *local* x-coordinates; `project()` turns them into screen x.
 *
 * **Units.** Horizontal world coordinates (local x, scroll, widths, gaps) are measured in
 * *viewport-height units* — `1` unit = the viewport height in pixels (`unit`). Since building
 * heights are also a fraction of viewport height, this keeps building aspect ratios **constant at
 * any window size** (the fix for "tall, narrow towers on a 16:9 screen"). `project()` is the one
 * place that multiplies by `unit` to reach screen pixels; `speed` stays in screen px/sec.
 *
 * Pure and DOM-free — `step()` is fed a delta, it does not read a clock.
 *
 * @module
 */

import { lerp } from "../math/ease.ts";

/** Options for {@link Camera}. */
export interface CameraOptions {
	/** Scroll speed in **screen pixels per second**. Sign sets direction (+ = world moves left). */
	speed?: number;
	/** Parallax factor of the farthest layer (depth 0). Near layer (depth 1) is always 1. */
	minParallax?: number;
	/** Initial scroll offset (viewport-height units). */
	scroll?: number;
}

/** Tracks scroll position and projects local coordinates to screen space by depth. */
export class Camera {
	/** Accumulated scroll distance of the near plane, in world units. */
	scroll: number;
	/** Scroll speed (world units/sec); sign sets direction. Mutable for live config. */
	speed: number;
	/** Parallax factor at depth 0 (farthest). */
	minParallax: number;
	/** Viewport width in CSS pixels. */
	width = 0;
	/** Viewport height in CSS pixels. */
	height = 0;
	/**
	 * Camera distance / zoom: a uniform world scale. `>1` zooms in (bigger buildings, wider
	 * spacing, fewer on screen); `<1` zooms out. Folded into {@link unit}, so it scales the whole
	 * scene uniformly while preserving aspect ratios and screen scroll speed.
	 */
	zoom = 1;
	/**
	 * A transient screen-space horizontal offset (e.g. pointer-parallax sway). Scaled by depth
	 * in {@link Camera.project} so near layers sway more than far ones. Set by the runtime; the
	 * simulation ignores it.
	 */
	sway = 0;
	/** Vertical camera position in pixels (config aim + slow drift); applied at render time. */
	offsetY = 0;
	/** Transient vertical pointer sway in pixels; set by the runtime. */
	swayY = 0;

	constructor(opts: CameraOptions = {}) {
		this.speed = opts.speed ?? 24;
		this.minParallax = opts.minParallax ?? 0.18;
		this.scroll = opts.scroll ?? 0;
	}

	/** Pixels per horizontal world-unit: viewport height × zoom. `1` until the first resize. */
	get unit(): number {
		return Math.max(1, this.height) * this.zoom;
	}

	/** Update the viewport size. */
	resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
	}

	/** Advance scroll by `dt` milliseconds (speed is screen px/sec → world-units via `unit`). */
	step(dt: number): void {
		this.scroll += (this.speed * (dt / 1000)) / this.unit;
	}

	/** Parallax factor for a given depth (`0`=far → `minParallax`, `1`=near → `1`). */
	parallaxAt(depth: number): number {
		return lerp(this.minParallax, 1, depth);
	}

	/** Project a layer-local x (world-units) at `depth` to screen x in pixels (including sway). */
	project(localX: number, depth: number): number {
		const p = this.parallaxAt(depth);
		return (localX - this.scroll * p) * this.unit + this.sway * p;
	}

	/** The left edge of the visible window in a depth's local (world-unit) coordinate space. */
	viewLeft(depth: number): number {
		return this.scroll * this.parallaxAt(depth);
	}

	/** The right edge of the visible window in a depth's local (world-unit) coordinate space. */
	viewRight(depth: number): number {
		return this.viewLeft(depth) + this.width / this.unit;
	}

	/**
	 * Is a local-space horizontal extent `[x, x+width]` at `depth` within the viewport,
	 * expanded by `margin` px on both sides? Used for culling and spawn decisions.
	 */
	isVisible(x: number, width: number, depth: number, margin = 0): boolean {
		const left = this.project(x, depth);
		const right = this.project(x + width, depth);
		return right >= -margin && left <= this.width + margin;
	}
}
