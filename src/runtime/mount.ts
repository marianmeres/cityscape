/**
 * The browser runtime — the one place that assembles the whole thing for a page.
 *
 * `mountCityscape()` creates a full-page canvas, wires a {@link CanvasRenderer}, builds the
 * headless scene, drives it with an rAF-backed {@link Engine}, and adds the optional light
 * interaction (pointer-parallax sway, wheel-scrub speed, click-to-flash) and ambient audio. It
 * returns a {@link CityscapeHandle} the example (or any host) uses to swap renderers, push config
 * changes, and read a permalink. Everything DOM lives here or in the renderer/ui/audio — the
 * engine and cityscape stay pure.
 *
 * @module
 */

import { Engine, type FrameScheduler } from "../engine/loop/engine.ts";
import { clamp, lerp } from "../engine/math/ease.ts";
import {
	createPointerState,
	parallaxSway,
	type PointerState,
} from "../engine/input/input.ts";
import { decodeFromHash, encodeToHash } from "../engine/config/serialize.ts";
import type { Renderer } from "../engine/render/renderer.ts";
import {
	type CityscapeConfig,
	type CityscapeScene,
	createCityscape,
} from "../cityscape/mod.ts";
import { CanvasRenderer } from "../render/canvas/canvas-renderer.ts";
import { AmbientAudio } from "../audio/ambient-audio.ts";

/** Options for {@link mountCityscape}. */
export interface MountOptions {
	/** Where to attach the canvas (default `document.body`). */
	container?: HTMLElement;
	/** Use an existing canvas instead of creating one. */
	canvas?: HTMLCanvasElement;
	/** Initial config overrides. */
	config?: Partial<CityscapeConfig>;
	/** Start the loop immediately (default `true`). */
	autoStart?: boolean;
	/** If no seed is supplied, pick a random one so each load differs (default `true`). */
	randomizeSeed?: boolean;
	/** Read initial config from `location.hash` (default `true`). */
	readHash?: boolean;
	/** Mirror config into `location.hash` on change for shareable permalinks (default `false`). */
	writeHash?: boolean;
	/** Enable pointer/wheel/click interaction (default `true`). */
	interaction?: boolean;
	/** Cap the device pixel ratio (default `2`) to bound cost on hi-dpi displays. */
	maxDpr?: number;
}

/** The live handle returned by {@link mountCityscape}. */
export interface CityscapeHandle {
	readonly scene: CityscapeScene;
	readonly engine: Engine;
	readonly canvas: HTMLCanvasElement;
	readonly audio: AmbientAudio;
	/** The currently active renderer. */
	renderer: Renderer;
	/**
	 * Swap the active renderer (e.g. Canvas ⇄ ASCII). The previous renderer is *not* disposed —
	 * swapping is deactivation, not destruction, and renderers may be reused (the example toggles
	 * back and forth). Renderers you pass here are caller-owned.
	 */
	setRenderer(renderer: Renderer): void;
	/** Apply a config patch (from a panel) and run runtime side-effects (audio, permalink). */
	update(patch: Partial<CityscapeConfig>): void;
	/** Subscribe to runtime-initiated config changes (wheel scrub) to refresh a panel. */
	onConfigChange(fn: (config: CityscapeConfig) => void): () => void;
	/** A shareable permalink encoding the current config. */
	permalink(): string;
	start(): void;
	stop(): void;
	destroy(): void;
}

const rafScheduler: FrameScheduler = (cb) => {
	const id = requestAnimationFrame(cb);
	return () => cancelAnimationFrame(id);
};

/** Mount a running cityscape onto the page. */
export function mountCityscape(opts: MountOptions = {}): CityscapeHandle {
	const container = opts.container ?? document.body;
	const maxDpr = opts.maxDpr ?? 2;
	const interaction = opts.interaction ?? true;

	// ── Canvas ─────────────────────────────────────────────────────────
	const canvas = opts.canvas ?? document.createElement("canvas");
	if (!opts.canvas) {
		canvas.style.cssText =
			"position:absolute;inset:0;width:100%;height:100%;display:block;";
		container.append(canvas);
	}

	// ── Initial config (overrides ◁ hash ◁ random seed) ─────────────────
	let initial: Partial<CityscapeConfig> = { ...opts.config };
	if (opts.readHash ?? true) {
		const fromHash = decodeFromHash(globalThis.location?.hash ?? "");
		if (fromHash) initial = { ...initial, ...fromHash };
	}
	if ((opts.randomizeSeed ?? true) && !initial.seed) {
		initial.seed = Math.random().toString(36).slice(2, 9);
	}

	const scene = createCityscape(initial);
	const canvasRenderer = new CanvasRenderer(canvas);
	canvasRenderer.setPost({ vignette: scene.config.vignette });
	let renderer: Renderer = canvasRenderer;
	const audio = new AmbientAudio(scene.events);
	audio.setVolume(scene.config.audioVolume);
	if (scene.config.audioEnabled) audio.setEnabled(true);

	// ── Stats overlay (toggled by the `showStats` config) ───────────────
	const stats = document.createElement("div");
	stats.style.cssText = "position:fixed;left:16px;top:16px;z-index:9;display:none;" +
		"font:11px/1.5 ui-monospace,Menlo,monospace;white-space:pre;padding:8px 10px;" +
		"border-radius:8px;pointer-events:none;color:#cfe0ff;" +
		"background:rgba(10,16,32,0.7);border:1px solid rgba(120,140,200,0.2);";
	container.append(stats);
	let fps = 0;
	let lastFrame = 0;
	let statsAccum = 0;

	const configListeners = new Set<(c: CityscapeConfig) => void>();

	// ── Sizing ─────────────────────────────────────────────────────────
	let vw = 0;
	let vh = 0;
	const resize = (): void => {
		const rect = opts.canvas
			? canvas.getBoundingClientRect()
			: { width: container.clientWidth, height: container.clientHeight };
		vw = Math.max(1, Math.round(rect.width || globalThis.innerWidth));
		vh = Math.max(1, Math.round(rect.height || globalThis.innerHeight));
		const dpr = Math.min(maxDpr, globalThis.devicePixelRatio || 1);
		scene.resize(vw, vh);
		renderer.resize(vw, vh, dpr);
	};

	// ── Interaction state ───────────────────────────────────────────────
	const pointer: PointerState = createPointerState();
	let swayCurrent = 0;
	let swayYCurrent = 0;

	// ── Loop ────────────────────────────────────────────────────────────
	const engine = new Engine({
		scheduler: rafScheduler,
		step: (dt) => scene.update(dt),
		render: () => {
			if (interaction) {
				const on = scene.config.pointerParallax;
				const swayTarget = on ? parallaxSway(pointer, vw, 42) : 0;
				// Vertical sway: pointer above center pans up, below pans down.
				const swayYTarget = on && pointer.inside
					? ((pointer.y / vh) * 2 - 1) * 26
					: 0;
				swayCurrent = lerp(swayCurrent, swayTarget, 0.08);
				swayYCurrent = lerp(swayYCurrent, swayYTarget, 0.08);
				scene.setSway(swayCurrent, swayYCurrent);
			}
			const list = scene.collect(vw, vh);
			renderer.render(list);
			updateStats(list.commands.length);
		},
	});

	/** Update the FPS / counts overlay (throttled), respecting the `showStats` toggle. */
	const updateStats = (commandCount: number): void => {
		const now = (globalThis.performance ?? Date).now();
		if (lastFrame) {
			const dt = now - lastFrame;
			if (dt > 0) fps = fps ? fps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
			statsAccum += dt;
		}
		lastFrame = now;
		if (!scene.config.showStats) {
			if (stats.style.display !== "none") stats.style.display = "none";
			return;
		}
		stats.style.display = "block";
		if (statsAccum < 200) return;
		statsAccum = 0;
		let entities = 0;
		for (const layer of scene.world.layers) entities += layer.entities.length;
		stats.textContent =
			`${
				Math.round(fps)
			} fps   ${vw}×${vh}\n${entities} entities · ${commandCount} draws` +
			`\nseed ${scene.config.seed} · ${scene.config.palette}`;
	};

	// ── Runtime config application ──────────────────────────────────────
	const applyRuntime = (patch: Partial<CityscapeConfig>): void => {
		if ("audioEnabled" in patch) audio.setEnabled(!!patch.audioEnabled);
		if ("audioVolume" in patch) audio.setVolume(scene.config.audioVolume);
		if ("vignette" in patch) {
			canvasRenderer.setPost({ vignette: scene.config.vignette });
		}
		if (opts.writeHash) writeHash();
	};
	const update = (patch: Partial<CityscapeConfig>): void => {
		scene.setConfig(patch);
		applyRuntime(patch);
	};
	const writeHash = (): void => {
		if (!globalThis.history?.replaceState) return;
		globalThis.history.replaceState(null, "", `#${encodeToHash(scene.config)}`);
	};
	const permalink = (): string => {
		const loc = globalThis.location;
		const base = loc ? `${loc.origin}${loc.pathname}` : "";
		return `${base}#${encodeToHash(scene.config)}`;
	};

	// ── DOM listeners ───────────────────────────────────────────────────
	const cleanups: Array<() => void> = [];
	const on = (
		target: EventTarget,
		type: string,
		fn: (e: Event) => void,
		options?: AddEventListenerOptions,
	): void => {
		target.addEventListener(type, fn as EventListener, options);
		cleanups.push(() =>
			target.removeEventListener(type, fn as EventListener, options)
		);
	};

	on(globalThis, "resize", () => resize());

	// Pause on hidden tab (and resume).
	let wasRunning = false;
	on(document, "visibilitychange", () => {
		if (document.hidden) {
			wasRunning = engine.running;
			engine.stop();
		} else if (wasRunning) {
			engine.start();
		}
	});

	if (interaction) {
		on(canvas, "pointermove", (e) => {
			const pe = e as PointerEvent;
			pointer.x = pe.clientX;
			pointer.y = pe.clientY;
			pointer.inside = true;
		});
		on(canvas, "pointerleave", () => (pointer.inside = false));
		on(canvas, "pointerdown", (e) => {
			const pe = e as PointerEvent;
			audio.resume();
			pointer.down = true;
			scene.poke(pe.clientX, pe.clientY);
		});
		on(canvas, "pointerup", () => (pointer.down = false));
		on(canvas, "wheel", (e) => {
			const delta = (e as WheelEvent).deltaY < 0 ? 3 : -3;
			const cameraSpeed = clamp(scene.config.cameraSpeed + delta, 0, 120);
			update({ cameraSpeed });
			for (const fn of configListeners) fn(scene.config);
		}, { passive: true });
	}

	resize();
	if (opts.autoStart ?? true) engine.start();

	return {
		scene,
		engine,
		canvas,
		audio,
		get renderer() {
			return renderer;
		},
		set renderer(r: Renderer) {
			renderer = r;
			resize();
		},
		setRenderer(r) {
			renderer = r;
			resize();
		},
		update,
		onConfigChange(fn) {
			configListeners.add(fn);
			return () => configListeners.delete(fn);
		},
		permalink,
		start: () => engine.start(),
		stop: () => engine.stop(),
		destroy() {
			engine.stop();
			for (const c of cleanups) c();
			audio.destroy();
			// Dispose the renderer this handle created. Renderers passed to setRenderer are
			// caller-owned (swapping is deactivation, not destruction — the example toggles
			// Canvas⇄ASCII and reuses both), so we never dispose those on swap.
			(canvasRenderer as Renderer).dispose?.();
			if (renderer !== canvasRenderer) renderer.dispose?.();
			stats.remove();
			if (!opts.canvas) canvas.remove();
		},
	};
}
