/**
 * The browser runtime for the shapes puzzle — the one place that assembles a playable page.
 *
 * `mountShapes()` creates a full-page canvas, wires a {@link CanvasRenderer}, builds the headless
 * {@link ShapesScene}, drives it with an rAF-backed {@link Engine}, and adds input + chrome: pointer
 * /touch pick-and-drag straight onto the board plus tap gestures (tap = rotate, double-tap = flip, or
 * double-tap a placed piece to take it back), keyboard through the pure {@link IntentState}, a DOM HUD
 * (level · moves/par · timer) with a hint button + a top-right mute, and reactive
 * **@marianmeres/vanilla** start + solved screens whose look follows the active palette + `Popup`
 * config knobs. All DOM lives here; the engine and the shapes domain stay pure.
 *
 * @module
 */

import { observable, reactTo, type Unsubscribe } from "@marianmeres/vanilla";
import { Engine, type FrameScheduler } from "../engine/loop/engine.ts";
import { IntentState, type KeyMap } from "../engine/input/intent.ts";
import type { Renderer } from "../engine/render/renderer.ts";
import {
	createShapes,
	getPalette,
	type ShapesConfig,
	type ShapesScene,
} from "../shapes/mod.ts";
import { darken, lighten, toCss, withAlpha } from "../engine/math/color.ts";
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

	// Mute toggle (persisted) — pinned top-right, on its own (not in the bottom control bar).
	const muteBtn = iconBtn(ICONS.volumeOn, "Mute");
	muteBtn.classList.add("shp-mute");
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
	container.append(muteBtn);

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

	// ── Popup theming ─────────────────────────────────────────────────────
	// The start/solved cards are DOM, so they're styled with CSS custom properties set from the live
	// config: colours follow the active palette, and the `Popup` knobs tune radius/shadow/blur/dim.
	// Cheap change-detection keeps this from touching the DOM on frames where nothing changed.
	let lastPopupSig = "";
	const applyPopupTheme = (): void => {
		const c = scene.config;
		const sig = `${c.palette}|${c.panelRadius}|${c.panelShadow}|${c.panelBlur}|` +
			`${c.panelOpacity}`;
		if (sig === lastPopupSig) return;
		lastPopupSig = sig;
		const pal = getPalette(c.palette);
		const css = (k: string, v: string): void => container.style.setProperty(k, v);
		const accentLight = lighten(pal.select, 0.05);
		css("--shp-card-bg", toCss(withAlpha(lighten(pal.tray, 0.05), 0.97)));
		css("--shp-card-fg", toCss(pal.text));
		css("--shp-card-border", toCss(withAlpha(lighten(pal.outline, 0.12), 0.55)));
		css("--shp-card-radius", `${c.panelRadius}px`);
		css(
			"--shp-card-shadow",
			c.panelShadow > 0
				? `0 ${Math.round(22 * c.panelShadow)}px ${
					Math.round(64 * c.panelShadow)
				}px ` +
					`rgba(0,0,0,${(0.55 * c.panelShadow).toFixed(3)})`
				: "none",
		);
		css(
			"--shp-overlay-bg",
			toCss(withAlpha(darken(pal.background, 0.25), c.panelOpacity)),
		);
		css("--shp-overlay-blur", `${c.panelBlur}px`);
		css("--shp-accent", toCss(accentLight));
		css("--shp-accent-hover", toCss(lighten(pal.select, 0.18)));
		css("--shp-accent-fg", toCss(darken(pal.select, 0.72)));
		css("--shp-star", toCss(pal.select));
	};
	applyPopupTheme(); // theme the start card before the first frame (engine idle on the title)

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
			// The frame vignette + grain is a raster post-pass (Canvas only), driven live from the
			// `vignette` Look knob; the ASCII/PixelArt targets simply have none.
			if (renderer instanceof CanvasRenderer) {
				renderer.setPost({ vignette: scene.config.vignette });
			}
			applyPopupTheme(); // live-restyle the cards when palette / Popup knobs change
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
		muteBtn.style.display = p === "playing" ? "inline-flex" : "none";
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

	// ── Pointer gestures (rotate / flip / move / remove) ────────────────
	// The rotate/flip/undo buttons are gone, so pointer gestures do the work:
	//   • tap an inactive loose piece  → just select/activate it (no rotate — so you can pick it up)
	//   • tap the already-active piece → rotate (instant — fires on release, no delay)
	//   • drag a piece                 → move / snap it onto the figure
	//   • double-tap a placed piece    → lift it back off the board
	//   • the "secondary" action (flip a loose piece / remove a placed one) has its OWN triggers so it
	//     never competes with the tap: long-press, right-click (desktop), or two-finger tap (touch).
	const DOUBLE_TAP_MS = 280;
	const DOUBLE_TAP_SLOP = 40; // px: a 2nd tap this close to the 1st (in time) is a double-tap
	const LONG_PRESS_MS = 400; // hold this long without moving → secondary action
	const MOVE_SLOP = 8; // px of travel that turns a press into a drag (and cancels a long-press)
	let downX = 0;
	let downY = 0;
	let dragged = false;
	let lastTapId: number | null = null;
	let lastTapAt = 0;
	let lastTapX = 0;
	let lastTapY = 0;
	let lastPointerType = "mouse";
	// Which piece was active *before* this press (captured before the press re-selects). A tap rotates
	// only when it lands on the piece that was already active — otherwise the tap just activates it.
	let activeBeforePress: number | null = null;
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressFired = false;
	const activePointers = new Set<number>();
	let multiTouch = false;

	const cancelLongPress = (): void => {
		if (longPressTimer != null) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	};

	/** Flip a loose piece, or take a placed one off the board — shared by every secondary trigger. */
	const secondaryAction = (x: number, y: number): void => {
		if (phase.get() !== "playing") return;
		const id = scene.pieceAt(x, y);
		if (id == null) return;
		if (scene.game.pieces[id].state === "placed") scene.removePlaced(id);
		else scene.flip(id);
	};

	const handleTap = (x: number, y: number, t: number): void => {
		if (phase.get() !== "playing") return;
		const id = scene.pieceAt(x, y);
		if (id == null) {
			lastTapId = null;
			return;
		}
		if (scene.game.pieces[id].state === "placed") {
			// Placed piece: a double-tap lifts it back to the tray (single tap does nothing).
			const isDouble = id === lastTapId && t - lastTapAt <= DOUBLE_TAP_MS &&
				Math.hypot(x - lastTapX, y - lastTapY) <= DOUBLE_TAP_SLOP;
			lastTapId = id;
			lastTapAt = t;
			lastTapX = x;
			lastTapY = y;
			if (isDouble) {
				lastTapId = null;
				scene.removePlaced(id);
			}
			return;
		}
		// Loose piece: the first tap only activates it; a tap on the already-active piece rotates.
		lastTapId = id;
		lastTapAt = t;
		lastTapX = x;
		lastTapY = y;
		if (id === activeBeforePress) scene.rotate(id);
		// else: scene.pointerDown already selected it — leave it highlighted, don't rotate yet.
	};

	on(globalThis, "resize", () => resize());

	// Right-click → flip/remove (desktop). Touch long-presses also raise `contextmenu`, but those are
	// already handled by the long-press timer, so ignore contextmenu unless it came from a mouse.
	on(canvas, "contextmenu", (e) => {
		e.preventDefault();
		if (lastPointerType === "touch") return;
		const me = e as MouseEvent;
		const r = canvas.getBoundingClientRect();
		secondaryAction(me.clientX - r.left, me.clientY - r.top);
	});

	on(canvas, "pointerdown", (e) => {
		const pe = e as PointerEvent;
		lastPointerType = pe.pointerType || lastPointerType;
		if (pe.button > 0) return; // right/middle button → handled via contextmenu
		audio.resume(); // unlock WebAudio on the first user gesture
		activePointers.add(pe.pointerId);
		// A second finger landing → two-finger tap = secondary action; cancel the first finger's drag.
		if (activePointers.size >= 2) {
			multiTouch = true;
			cancelLongPress();
			scene.pointerUp();
			dragged = false;
			lastTapId = null;
			if (!longPressFired) secondaryAction(downX, downY);
			return;
		}
		canvas.setPointerCapture?.(pe.pointerId);
		[downX, downY] = localXY(pe);
		dragged = false;
		longPressFired = false;
		// Remember what was active before this press decides selection (so a tap on an already-active
		// piece rotates, while a tap on a fresh piece only activates it).
		activeBeforePress = scene.game.draggingId ?? scene.game.selectedId;
		scene.pointerDown(downX, downY);
		cancelLongPress();
		longPressTimer = setTimeout(() => {
			longPressTimer = null;
			if (multiTouch || dragged) return;
			longPressFired = true; // suppress the rotate that pointerup would otherwise do
			secondaryAction(downX, downY);
		}, LONG_PRESS_MS);
	});
	on(canvas, "pointermove", (e) => {
		const pe = e as PointerEvent;
		lastPointerType = pe.pointerType || lastPointerType;
		if (multiTouch) return;
		const [x, y] = localXY(pe);
		scene.pointerMove(x, y);
		// Any real travel turns this into a drag — which is not a tap, and cancels the long-press.
		if (
			scene.game.draggingId != null ||
			(x - downX) ** 2 + (y - downY) ** 2 > MOVE_SLOP * MOVE_SLOP
		) {
			dragged = true;
			cancelLongPress();
		}
	});
	on(canvas, "pointerup", (e) => {
		const pe = e as PointerEvent;
		activePointers.delete(pe.pointerId);
		cancelLongPress();
		if (multiTouch) {
			if (activePointers.size === 0) multiTouch = false;
			return;
		}
		scene.pointerUp();
		if (longPressFired) {
			longPressFired = false; // the hold already flipped/removed — don't also rotate
			return;
		}
		if (dragged) lastTapId = null; // a drag breaks any double-tap chain
		else handleTap(downX, downY, pe.timeStamp);
	});
	on(canvas, "pointercancel", (e) => {
		activePointers.delete((e as PointerEvent).pointerId);
		cancelLongPress();
		scene.pointerUp();
		dragged = false;
		longPressFired = false;
		if (activePointers.size === 0) multiTouch = false;
	});

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

	hud.bind(() => scene.hint());

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
			cancelLongPress();
			for (const c of cleanups) c();
			for (const u of unsubs) u();
			renderer.dispose?.();
			audio.destroy();
			hud.root.remove();
			hud.controls.remove();
			muteBtn.remove();
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
	/** Wire the single remaining control (the hint bulb). */
	bind(hint: () => void): void;
}

function buildHud(container: HTMLElement): Hud {
	const root = el("div", "shp-hud");
	const level = el("span", "shp-stat");
	const moves = el("span", "shp-stat");
	const time = el("span", "shp-stat");
	root.append(level, moves, time);
	container.append(root);

	// Rotate/flip/undo moved to tap gestures (tap = rotate, double-tap = flip / remove); only the
	// hint bulb remains a button.
	const controls = el("div", "shp-controls");
	const hint = iconBtn(ICONS.hint, "Hint (H)");
	controls.append(hint);
	container.append(controls);

	return {
		root,
		controls,
		update(scene) {
			level.textContent = `Level ${scene.levelNumber}`;
			moves.textContent = `${scene.moves} / par ${scene.par}`;
			time.textContent = formatTime(scene.elapsedMs);
		},
		bind(onHint) {
			hint.onclick = onHint;
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
		"Drag pieces onto the figure. Tap to select, tap again to rotate; hold, right-click or " +
		"two-finger tap to flip. Double-tap a placed piece to take it back. Fewest moves wins.";
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
 padding:calc(10px + env(safe-area-inset-top,0px)) calc(10px + env(safe-area-inset-right,0px)) 10px
 calc(10px + env(safe-area-inset-left,0px));font:13px/1.4 ui-monospace,Menlo,monospace;
 color:#dfe7f5;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.6);}
.shp-stat{opacity:.92;}
.shp-controls{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:0;right:0;z-index:8;
 display:flex;gap:12px;justify-content:center;}
.shp-btn{min-width:48px;min-height:48px;padding:0 14px;border-radius:12px;cursor:pointer;
 display:inline-flex;align-items:center;justify-content:center;
 font:15px/1 system-ui,sans-serif;color:#eef2fb;background:rgba(40,48,66,.82);
 border:1px solid rgba(130,150,200,.28);backdrop-filter:blur(6px);}
.shp-btn:hover{background:rgba(56,66,90,.92);}
.shp-btn:active{transform:translateY(1px);}
.shp-btn svg{display:block;}
.shp-icon{padding:0;}
.shp-mute{position:fixed;top:calc(16px + env(safe-area-inset-top,0px));
 right:calc(16px + env(safe-area-inset-right,0px));z-index:8;}
.shp-overlay{position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;
 background:var(--shp-overlay-bg,rgba(8,11,18,.6));
 backdrop-filter:blur(var(--shp-overlay-blur,3px));-webkit-backdrop-filter:blur(var(--shp-overlay-blur,3px));}
.shp-card{max-width:340px;text-align:center;padding:28px 26px;border-radius:var(--shp-card-radius,18px);
 background:var(--shp-card-bg,rgba(24,29,40,.96));border:1px solid var(--shp-card-border,rgba(130,150,200,.22));
 color:var(--shp-card-fg,#eaf0fb);box-shadow:var(--shp-card-shadow,0 20px 60px rgba(0,0,0,.45));}
.shp-title{margin:0 0 10px;font:600 28px/1.1 system-ui,sans-serif;letter-spacing:.5px;}
.shp-sub{margin:0 0 18px;font:14px/1.5 system-ui,sans-serif;opacity:.82;}
.shp-stars{display:flex;justify-content:center;gap:6px;color:var(--shp-star,#ffd873);margin-bottom:10px;}
.shp-primary{min-width:140px;color:var(--shp-accent-fg,#fff);
 background:var(--shp-accent,rgba(90,130,210,.92));border-color:transparent;}
.shp-primary:hover{background:var(--shp-accent-hover,rgba(108,150,230,1));}
/* Installed PWA: the OS status bar overlays the content but env(safe-area-inset-top) can report 0
   (non-notched iOS, black-translucent), hiding the top-anchored HUD + mute button under the clock.
   Enforce a minimum top clearance so they stay readable + reachable, mirroring the example chrome. */
@media (display-mode:standalone),(display-mode:fullscreen){
 .shp-mute{top:calc(16px + max(env(safe-area-inset-top,0px),28px));}
 .shp-hud{padding-top:calc(10px + max(env(safe-area-inset-top,0px),28px));}
}
`;
