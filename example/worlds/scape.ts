/**
 * The shared wiring for the two "scape" worlds — the night city and the nature valley. They are
 * ~95% identical (mount a full-page scape, build the schema panel, toggle Canvas ⇄ ASCII ⇄ Pixel,
 * a hamburger menu, an immersive fullscreen mode, keyboard shortcuts), so the old `city/main.ts`
 * and `nature/main.ts` collapse into this one factory parameterised by a {@link ScapeSpec}.
 *
 * Written exactly how a consumer would: import the library, `mount…()`, build the panel from the
 * schema, swap renderers through the returned handle. The one SPA twist is lifecycle — everything
 * is built into a `data-world` stage and every listener is tracked, so `destroy()` can unwind the
 * whole world cleanly when the router leaves the route (no leaked rAF loops or key handlers).
 *
 * Permalinks are intentionally gone (the hash now belongs to the router); each world just mounts
 * with a fresh random seed and its built-in defaults.
 */

import { mountCityscape } from "../../src/runtime/mount.ts";
import { mountNaturescape } from "../../src/runtime/mount-nature.ts";
import { CONFIG_SCHEMA as NATURE_SCHEMA } from "../../src/naturescape/config.ts";
import { createControlPanel } from "../../src/ui/panel.ts";
import { AsciiRenderer } from "../../src/render/ascii/ascii-renderer.ts";
import { PixelArtRenderer } from "../../src/render/pixelart/pixelart-renderer.ts";
import type { Renderer } from "../../src/engine/render/renderer.ts";
import type { ConfigField } from "../../src/engine/config/schema.ts";
import type { View } from "../view.ts";

/** The slice of a scape mount handle this wiring uses (both city + nature handles satisfy it). */
interface ScapeHandle<C extends object> {
	readonly scene: { config: C };
	readonly canvas: HTMLCanvasElement;
	renderer: Renderer;
	setRenderer(renderer: Renderer): void;
	update(patch: Partial<C>): void;
	onConfigChange(fn: (config: C) => void): () => void;
	destroy(): void;
}

interface ScapeSpec<C extends object> {
	/** Scopes the stage for theming + the manifest/router. */
	world: "city" | "nature";
	/** Mount the world into the given stage container. */
	mount: (container: HTMLElement) => ScapeHandle<C>;
	/** Config schema for the panel (omit → the panel's default city schema). */
	schema?: ConfigField[];
	/** Panel title. */
	title: string;
	/** The "jump to the sibling world" menu row. */
	other: { route: string; label: string; title: string };
	/** The one-line interaction hint at the foot of the menu. */
	hint: string;
}

type Mode = "canvas" | "ascii" | "pixel";

/** Build one scape world into `host`. Generic over the world's config type `C`. */
function createScapeExample<C extends object>(
	host: HTMLElement,
	spec: ScapeSpec<C>,
): View {
	// ── Stage (scopes theme tokens + holds every DOM node this world creates) ──
	const stage = document.createElement("div");
	stage.className = "stage";
	stage.dataset.world = spec.world;
	host.append(stage);

	const handle = spec.mount(stage);
	const canvasRenderer = handle.renderer;

	// ── Toast helper ──────────────────────────────────────────────────────────
	const toast = document.createElement("div");
	toast.className = "scape-toast";
	stage.append(toast);
	let toastTimer = 0;
	const flash = (msg: string): void => {
		toast.textContent = msg;
		toast.classList.add("scape-toast-show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toast.classList.remove("scape-toast-show"), 1400);
	};

	// ── Visibility state ────────────────────────────────────────────────────────
	// Default view shows only the hamburger; the menu + settings panel are summoned on demand,
	// and immersive mode hides everything. `applyVisibility()` is the single source of truth.
	let immersive = false;
	let menuOpen = false;
	let panelOpen = false;
	const applyVisibility = (): void => {
		menuBtn.style.display = immersive ? "none" : "";
		menu.style.display = !immersive && menuOpen ? "" : "none";
		panel.el.style.display = !immersive && panelOpen ? "" : "none";
	};
	const setMenuOpen = (on: boolean): void => {
		menuOpen = on;
		applyVisibility();
	};
	const setPanelOpen = (on: boolean): void => {
		panelOpen = on;
		applyVisibility();
	};

	// ── Schema-driven control panel (hidden until summoned from the menu) ────────
	const panel = createControlPanel<C>({
		config: handle.scene.config,
		schema: spec.schema,
		title: spec.title,
		onChange: (patch) => handle.update(patch),
		onClose: () => setPanelOpen(false),
	});
	stage.append(panel.el);
	const unsubConfig = handle.onConfigChange((cfg) => panel.set(cfg));

	// ── ASCII renderer toggle — same DisplayList, different target ───────────────
	const pre = document.createElement("pre");
	pre.className = "scape-ascii";
	stage.append(pre);
	const ascii = new AsciiRenderer({ cellWidth: 7, cellHeight: 12 });
	const asciiAdapter: Renderer = {
		resize: (w, h) => ascii.resize(w, h),
		render: (list) => {
			ascii.render(list);
			pre.textContent = ascii.toString();
		},
	};

	// ── Pixel-art renderer — same DisplayList, painted low-res + dithered ────────
	let pixelScale = 4;
	const pixel = new PixelArtRenderer(handle.canvas, { pixelScale });

	// ── Renderer mode switch (Canvas · ASCII · Pixel) ────────────────────────────
	let mode: Mode = "canvas";
	const setMode = (next: Mode): void => {
		mode = next;
		const asciiOn = next === "ascii";
		// ASCII overlays a <pre>; Canvas & Pixel both paint the real canvas, so keep it visible.
		pre.style.display = asciiOn ? "block" : "none";
		handle.canvas.style.opacity = asciiOn ? "0" : "1";
		handle.setRenderer(
			next === "ascii" ? asciiAdapter : next === "pixel" ? pixel : canvasRenderer,
		);
		asciiBtn.textContent = asciiOn ? "Canvas view" : "ASCII view";
		pixelBtn.textContent = next === "pixel" ? "Canvas view" : "Pixel view";
	};
	/** Toggle a mode on/off (off returns to Canvas). */
	const toggleMode = (m: Mode): void => setMode(mode === m ? "canvas" : m);
	/** Change the pixel-art block size — only while the pixel view is active (it shares the canvas). */
	const adjustPixelScale = (delta: number): void => {
		if (mode !== "pixel") return;
		pixelScale = Math.max(1, Math.min(12, pixelScale + delta));
		pixel.setOptions({ pixelScale });
		flash(`Pixel size ${pixelScale}`);
	};

	// ── Hamburger menu — the only control visible by default (top-left) ──────────
	const menuBtn = document.createElement("button");
	menuBtn.className = "scape-menu-btn";
	menuBtn.textContent = "☰";
	menuBtn.title = "Menu";
	menuBtn.setAttribute("aria-label", "Menu");
	menuBtn.addEventListener("click", (e) => {
		e.stopPropagation(); // don't let the outside-click handler immediately re-close it
		setMenuOpen(!menuOpen);
	});

	const menu = document.createElement("div");
	menu.className = "scape-menu";

	/** Build one menu row; picking it dismisses the menu, then runs the action. */
	const menuItem = (label: string, onPick: () => void): HTMLButtonElement => {
		const b = document.createElement("button");
		b.className = "scape-menu-item";
		b.textContent = label;
		b.addEventListener("click", () => {
			setMenuOpen(false);
			onPick();
		});
		return b;
	};

	const asciiBtn = menuItem("ASCII view", () => toggleMode("ascii"));
	const pixelBtn = menuItem("Pixel view", () => toggleMode("pixel"));
	const fsBtn = menuItem("Fullscreen", () => setImmersive(true));
	const worldBtn = menuItem(spec.other.label, () => (location.hash = spec.other.route));
	worldBtn.title = spec.other.title;
	const homeBtn = menuItem("🏠 Worlds", () => (location.hash = "#/"));
	homeBtn.title = "Back to the chooser";
	const settingsBtn = menuItem("⚙ Settings", () => setPanelOpen(true));

	const hint = document.createElement("div");
	hint.className = "scape-menu-hint";
	hint.textContent = spec.hint;

	menu.append(asciiBtn, pixelBtn, fsBtn, worldBtn, homeBtn, settingsBtn, hint);
	stage.append(menuBtn, menu);

	// ── Immersive view: hide every control + go fullscreen; Escape (or `f`) restores ──
	const setImmersive = (on: boolean): void => {
		if (on === immersive) return;
		immersive = on;
		if (on) menuOpen = false; // don't leave a dangling menu to reappear on return
		applyVisibility();
		if (on) stage.requestFullscreen?.().catch(() => {});
		else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
	};

	// ── Listeners (tracked so destroy() can remove every one) ────────────────────
	const cleanups: Array<() => void> = [];
	const on = (
		target: EventTarget,
		type: string,
		fn: (e: Event) => void,
	): void => {
		target.addEventListener(type, fn as EventListener);
		cleanups.push(() => target.removeEventListener(type, fn as EventListener));
	};

	// Leaving browser fullscreen (Escape, window chrome, …) restores the controls.
	on(document, "fullscreenchange", () => {
		if (!document.fullscreenElement && immersive) setImmersive(false);
	});
	// Dismiss the menu on an outside click (the button stops its own click from bubbling).
	on(document, "click", (e) => {
		if (menuOpen && !menu.contains(e.target as Node)) setMenuOpen(false);
	});
	on(globalThis, "keydown", (e) => {
		const ke = e as KeyboardEvent;
		if (
			ke.target instanceof HTMLInputElement ||
			ke.target instanceof HTMLSelectElement
		) return;
		if (ke.key === "Escape") {
			if (menuOpen) setMenuOpen(false);
		} else if (ke.key === "a") toggleMode("ascii");
		else if (ke.key === "p") toggleMode("pixel");
		else if (ke.key === "[") adjustPixelScale(-1);
		else if (ke.key === "]") adjustPixelScale(1);
		else if (ke.key === "m") setMenuOpen(!menuOpen);
		else if (ke.key === "h") setPanelOpen(!panelOpen);
		else if (ke.key === "f") setImmersive(!immersive);
	});

	// Render the initial state (hamburger only).
	applyVisibility();

	return {
		destroy() {
			clearTimeout(toastTimer);
			// Drop back to the owned Canvas renderer first, so handle.destroy() disposes exactly
			// that one and we dispose the caller-owned ASCII/Pixel renderers ourselves (no double-free).
			handle.setRenderer(canvasRenderer);
			for (const c of cleanups) c();
			unsubConfig();
			if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
			panel.destroy();
			handle.destroy();
			pixel.dispose?.(); // the ASCII renderer is a pure string buffer — nothing to dispose
			stage.remove();
		},
	};
}

/** The night-city world (route `#/city`). */
export function createCityExample(host: HTMLElement): View {
	return createScapeExample(host, {
		world: "city",
		mount: (container) =>
			mountCityscape({
				container,
				readHash: false,
				writeHash: false,
				randomizeSeed: true,
			}),
		title: "Cityscape",
		other: {
			route: "#/nature",
			label: "🏞 Nature",
			title: "Switch to the nature valley",
		},
		hint:
			"move = parallax · wheel = speed · click = flash · keys: a / p / [ ] / m / h / f",
	});
}

/** The nature-valley world (route `#/nature`). */
export function createNatureExample(host: HTMLElement): View {
	return createScapeExample(host, {
		world: "nature",
		mount: (container) =>
			mountNaturescape({
				container,
				readHash: false,
				writeHash: false,
				randomizeSeed: true,
			}),
		schema: NATURE_SCHEMA,
		title: "Nature",
		other: { route: "#/city", label: "🌃 City", title: "Switch to the night city" },
		hint:
			"move = parallax · wheel = speed · click = ripple · keys: a / p / [ ] / m / h / f",
	});
}
