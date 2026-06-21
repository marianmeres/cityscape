/**
 * The browser runtime for the shapes puzzle — the one place that assembles a playable page.
 *
 * `mountShapes()` creates a full-page canvas, wires a {@link CanvasRenderer}, builds the headless
 * {@link ShapesScene}, drives it with an rAF-backed {@link Engine}, and adds input + chrome: pointer
 * /touch pick-and-drag straight onto the board, keyboard through the pure {@link IntentState}, a
 * DOM HUD (level · moves/par · timer) with on-screen rotate/flip/undo/hint controls, and reactive
 * **@marianmeres/vanilla** start + solved screens. All DOM lives here; the engine and the shapes
 * domain stay pure.
 *
 * @module
 */

import { observable, reactTo, type Unsubscribe } from "@marianmeres/vanilla";
import { Engine, type FrameScheduler } from "../engine/loop/engine.ts";
import { IntentState, type KeyMap } from "../engine/input/intent.ts";
import type { Renderer } from "../engine/render/renderer.ts";
import { createShapes, type ShapesConfig, type ShapesScene } from "../shapes/mod.ts";
import { CanvasRenderer } from "../render/canvas/canvas-renderer.ts";
import { ShapesAudio } from "../audio/shapes-audio.ts";
import { ICONS, starIcon } from "./icons.ts";

const MUTE_KEY = "shapes-muted";

function loadMuted(): boolean {
	try {
		return globalThis.localStorage?.getItem(MUTE_KEY) === "1";
	} catch {
		return false;
	}
}

function saveMuted(muted: boolean): void {
	try {
		globalThis.localStorage?.setItem(MUTE_KEY, muted ? "1" : "0");
	} catch {
		// ignore (private mode, etc.)
	}
}

/** Options for {@link mountShapes}. */
export interface ShapesMountOptions {
	/** Where to attach (default `document.body`). */
	container?: HTMLElement;
	/** Use an existing canvas instead of creating one. */
	canvas?: HTMLCanvasElement;
	/** Initial config overrides. */
	config?: Partial<ShapesConfig>;
	/** Show the title screen first (default `true`). When `false`, play starts immediately. */
	title?: boolean;
	/** If no seed is supplied, pick a random one (default `true`). */
	randomizeSeed?: boolean;
	/** Cap device pixel ratio (default `2`). */
	maxDpr?: number;
}

/** The live handle returned by {@link mountShapes}. */
export interface ShapesHandle {
	readonly scene: ShapesScene;
	readonly engine: Engine;
	readonly canvas: HTMLCanvasElement;
	/** Swap the active renderer (Canvas ⇄ ASCII ⇄ PixelArt). */
	renderer: Renderer;
	setRenderer(renderer: Renderer): void;
	start(): void;
	stop(): void;
	destroy(): void;
}

/** Default keyboard bindings (physical `KeyboardEvent.code` → abstract action). */
const KEYMAP: KeyMap = {
	KeyR: "rotate",
	KeyE: "rotateCCW",
	KeyF: "flip",
	KeyZ: "undo",
	Backspace: "undo",
	KeyH: "hint",
	Tab: "selectNext",
	Enter: "next",
	KeyN: "next",
};

const rafScheduler: FrameScheduler = (cb) => {
	const id = requestAnimationFrame(cb);
	return () => cancelAnimationFrame(id);
};

/** Mount a playable shapes puzzle onto the page. */
export function mountShapes(opts: ShapesMountOptions = {}): ShapesHandle {
	ensureStyles();
	const container = opts.container ?? document.body;
	const maxDpr = opts.maxDpr ?? 2;

	// ── Canvas ──────────────────────────────────────────────────────────
	const canvas = opts.canvas ?? document.createElement("canvas");
	if (!opts.canvas) {
		canvas.style.cssText =
			"position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;";
		container.append(canvas);
	} else {
		canvas.style.touchAction = "none";
	}

	// ── Initial config ──────────────────────────────────────────────────
	const initial: Partial<ShapesConfig> = { ...opts.config };
	if ((opts.randomizeSeed ?? true) && !initial.seed) {
		initial.seed = Math.random().toString(36).slice(2, 9);
	}

	const scene = createShapes(initial);
	let renderer: Renderer = new CanvasRenderer(canvas);
	const audio = new ShapesAudio(loadMuted());
	let lastPlacements = 0;

	// ── Reactive phase (drives the start + solved screens — vanilla's core) ──
	const phase = observable<"title" | "playing" | "solved">(
		(opts.title ?? true) ? "title" : "playing",
	);
	const intent = new IntentState(KEYMAP);

	// ── Chrome ──────────────────────────────────────────────────────────
	const hud = buildHud(container);
	const start = buildStartScreen(container, () => {
		audio.resume(); // unlock WebAudio from the Play gesture
		phase.set("playing");
	});
	const solved = buildSolvedScreen(container, () => advance());
	const unsubs: Unsubscribe[] = [];

	// ── Sizing ──────────────────────────────────────────────────────────
	let vw = 1;
	let vh = 1;
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

	const advance = (): void => {
		scene.nextLevel();
		phase.set("playing");
	};

	const dispatch = (action: string): void => {
		switch (action) {
			case "rotate":
				return scene.rotate();
			case "rotateCCW":
				return scene.rotateCCW();
			case "flip":
				return scene.flip();
			case "undo":
				return scene.undo();
			case "hint":
				return scene.hint();
			case "selectNext":
				return scene.selectNext();
			case "next":
				if (scene.solved) advance();
				return;
		}
	};

	// ── Loop ────────────────────────────────────────────────────────────
	const engine = new Engine({
		scheduler: rafScheduler,
		step: (dt) => scene.update(dt),
		render: () => {
			for (const action of intent.consumePressed()) dispatch(action);
			intent.tick();
			renderer.render(scene.collect(vw, vh));
			hud.update(scene);
			// Click on each new placement (monotonic counter self-heals across level rebuilds).
			const placed = scene.game.placements;
			if (placed > lastPlacements) audio.click();
			lastPlacements = placed;
			if (scene.solved && phase.get() === "playing") {
				audio.solved();
				solved.show(scene);
				phase.set("solved");
			}
		},
	});

	// Drive the start/solved screens (and the loop) from the reactive phase.
	unsubs.push(reactTo([phase], () => {
		const p = phase.get();
		start.root.style.display = p === "title" ? "flex" : "none";
		solved.root.style.display = p === "solved" ? "flex" : "none";
		hud.root.style.display = p === "playing" ? "flex" : "none";
		hud.controls.style.display = p === "playing" ? "flex" : "none";
		if (p === "title") engine.stop();
		else engine.start();
	}));

	// ── Listeners ───────────────────────────────────────────────────────
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

	const localXY = (e: PointerEvent): [number, number] => {
		const r = canvas.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top];
	};

	on(globalThis, "resize", () => resize());
	on(canvas, "pointerdown", (e) => {
		const pe = e as PointerEvent;
		audio.resume(); // unlock WebAudio on the first user gesture
		canvas.setPointerCapture?.(pe.pointerId);
		scene.pointerDown(...localXY(pe));
	});
	on(canvas, "pointermove", (e) => scene.pointerMove(...localXY(e as PointerEvent)));
	on(canvas, "pointerup", () => scene.pointerUp());
	on(canvas, "pointercancel", () => scene.pointerUp());

	on(globalThis, "keydown", (e) => {
		const ke = e as KeyboardEvent;
		if (ke.code in KEYMAP) {
			ke.preventDefault();
			// Shift+R is a convenience for counter-clockwise on desktop.
			if (ke.code === "KeyR" && ke.shiftKey) {
				if (phase.get() === "playing") scene.rotateCCW();
				return;
			}
			intent.keyDown(ke.code);
		}
	});
	on(globalThis, "keyup", (e) => intent.keyUp((e as KeyboardEvent).code));
	on(globalThis, "blur", () => intent.reset());

	hud.bind({
		rotate: () => scene.rotate(),
		flip: () => scene.flip(),
		undo: () => scene.undo(),
		hint: () => scene.hint(),
	});

	// Mute toggle (persisted) — appended to the control bar.
	const muteBtn = iconBtn(ICONS.volumeOn, "Mute");
	const refreshMute = (): void => {
		muteBtn.innerHTML = audio.muted ? ICONS.volumeOff : ICONS.volumeOn;
		muteBtn.title = audio.muted ? "Unmute" : "Mute";
		muteBtn.setAttribute("aria-label", muteBtn.title);
	};
	muteBtn.onclick = () => {
		audio.setMuted(!audio.muted);
		saveMuted(audio.muted);
		refreshMute();
		if (!audio.muted) audio.resume();
	};
	refreshMute();
	hud.controls.append(muteBtn);

	resize();
	if ((opts.title ?? true) === false) engine.start();

	return {
		scene,
		engine,
		canvas,
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
		start: () => engine.start(),
		stop: () => engine.stop(),
		destroy() {
			engine.stop();
			for (const c of cleanups) c();
			for (const u of unsubs) u();
			renderer.dispose?.();
			audio.destroy();
			hud.root.remove();
			hud.controls.remove();
			start.root.remove();
			solved.root.remove();
			if (!opts.canvas) canvas.remove();
		},
	};
}

/* -------------------------------------------------------------------------- *
 * Chrome (plain DOM; reactive bits use vanilla above)
 * -------------------------------------------------------------------------- */

interface Hud {
	root: HTMLElement;
	controls: HTMLElement;
	update(scene: ShapesScene): void;
	bind(
		handlers: {
			rotate: () => void;
			flip: () => void;
			undo: () => void;
			hint: () => void;
		},
	): void;
}

function buildHud(container: HTMLElement): Hud {
	const root = el("div", "shp-hud");
	const level = el("span", "shp-stat");
	const moves = el("span", "shp-stat");
	const time = el("span", "shp-stat");
	root.append(level, moves, time);
	container.append(root);

	const controls = el("div", "shp-controls");
	const rotate = iconBtn(ICONS.rotateCW, "Rotate (R)");
	const flip = iconBtn(ICONS.flip, "Flip (F)");
	const undo = iconBtn(ICONS.undo, "Undo (Z)");
	const hint = iconBtn(ICONS.hint, "Hint (H)");
	controls.append(rotate, flip, undo, hint);
	container.append(controls);

	return {
		root,
		controls,
		update(scene) {
			level.textContent = `Level ${scene.levelNumber}`;
			moves.textContent = `${scene.moves} / par ${scene.par}`;
			time.textContent = formatTime(scene.elapsedMs);
		},
		bind(h) {
			rotate.onclick = h.rotate;
			flip.onclick = h.flip;
			undo.onclick = h.undo;
			hint.onclick = h.hint;
		},
	};
}

function buildStartScreen(
	container: HTMLElement,
	onPlay: () => void,
): { root: HTMLElement } {
	const root = el("div", "shp-overlay");
	const card = el("div", "shp-card");
	const h = el("h1", "shp-title");
	h.textContent = "Shapes";
	const p = el("p", "shp-sub");
	p.textContent =
		"Reassemble the figure. Drag pieces in, rotate & flip to fit — fewest moves wins.";
	const play = btn("Play", "Play");
	play.classList.add("shp-primary");
	play.onclick = onPlay;
	card.append(h, p, play);
	root.append(card);
	container.append(root);
	return { root };
}

interface SolvedScreen {
	root: HTMLElement;
	show(scene: ShapesScene): void;
}

function buildSolvedScreen(container: HTMLElement, onNext: () => void): SolvedScreen {
	const root = el("div", "shp-overlay");
	const card = el("div", "shp-card");
	const h = el("h1", "shp-title");
	h.textContent = "Solved!";
	const stars = el("div", "shp-stars");
	const detail = el("p", "shp-sub");
	const next = btn("Next level", "Next");
	next.classList.add("shp-primary");
	next.onclick = onNext;
	card.append(h, stars, detail, next);
	root.append(card);
	container.append(root);
	return {
		root,
		show(scene) {
			const s = scene.score();
			stars.innerHTML = [0, 1, 2].map((i) => starIcon(i < s.stars)).join("");
			detail.textContent = `${s.moves} moves (par ${s.par}) · ${
				formatTime(s.timeMs)
			}`;
		},
	};
}

/* -------------------------------------------------------------------------- *
 * Small DOM helpers + styles
 * -------------------------------------------------------------------------- */

function el(tag: string, className: string): HTMLElement {
	const e = document.createElement(tag);
	e.className = className;
	return e;
}

function btn(label: string, title: string): HTMLButtonElement {
	const b = document.createElement("button");
	b.className = "shp-btn";
	b.type = "button";
	b.textContent = label;
	b.title = title;
	return b;
}

/** A control button whose face is an inline SVG icon (with the title doubling as the a11y label). */
function iconBtn(svg: string, title: string): HTMLButtonElement {
	const b = document.createElement("button");
	b.className = "shp-btn shp-icon";
	b.type = "button";
	b.innerHTML = svg;
	b.title = title;
	b.setAttribute("aria-label", title);
	return b;
}

function formatTime(ms: number): string {
	const total = Math.floor(ms / 1000);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

const STYLE_ID = "shapes-runtime-style";

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	document.head.append(style);
}

const CSS = `
.shp-hud{position:fixed;top:0;left:0;right:0;z-index:8;display:flex;gap:16px;justify-content:center;
 padding:10px;font:13px/1.4 ui-monospace,Menlo,monospace;color:#dfe7f5;pointer-events:none;
 text-shadow:0 1px 2px rgba(0,0,0,.6);}
.shp-stat{opacity:.92;}
.shp-controls{position:fixed;bottom:16px;left:0;right:0;z-index:8;display:flex;gap:12px;justify-content:center;}
.shp-btn{min-width:48px;min-height:48px;padding:0 14px;border-radius:12px;cursor:pointer;
 display:inline-flex;align-items:center;justify-content:center;
 font:15px/1 system-ui,sans-serif;color:#eef2fb;background:rgba(40,48,66,.82);
 border:1px solid rgba(130,150,200,.28);backdrop-filter:blur(6px);}
.shp-btn:hover{background:rgba(56,66,90,.92);}
.shp-btn:active{transform:translateY(1px);}
.shp-btn svg{display:block;}
.shp-icon{padding:0;}
.shp-overlay{position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;
 background:rgba(8,11,18,.6);backdrop-filter:blur(3px);}
.shp-card{max-width:340px;text-align:center;padding:28px 26px;border-radius:18px;
 background:rgba(24,29,40,.96);border:1px solid rgba(130,150,200,.22);color:#eaf0fb;
 box-shadow:0 20px 60px rgba(0,0,0,.45);}
.shp-title{margin:0 0 10px;font:600 28px/1.1 system-ui,sans-serif;letter-spacing:.5px;}
.shp-sub{margin:0 0 18px;font:14px/1.5 system-ui,sans-serif;opacity:.82;}
.shp-stars{display:flex;justify-content:center;gap:6px;color:#ffd873;margin-bottom:10px;}
.shp-primary{min-width:140px;background:rgba(90,130,210,.92);border-color:rgba(150,180,240,.5);}
.shp-primary:hover{background:rgba(108,150,230,1);}
`;
