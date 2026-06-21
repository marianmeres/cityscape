/**
 * Example app — wires the library into a full-page background with a control panel and a live
 * Canvas ⇄ ASCII renderer toggle (the visible proof that the renderer seam is real).
 *
 * Written exactly how a consumer would: import the library, `mountCityscape()`, build the panel
 * from the schema, and swap renderers through the returned handle. Bundle with:
 *
 *   deno task example:build      (or example:watch)
 */

import { mountCityscape } from "../../src/runtime/mount.ts";
import { createControlPanel } from "../../src/ui/panel.ts";
import { AsciiRenderer } from "../../src/render/ascii/ascii-renderer.ts";
import { PixelArtRenderer } from "../../src/render/pixelart/pixelart-renderer.ts";
import type { Renderer } from "../../src/engine/render/renderer.ts";

// ── Mount the running cityscape (writes config to the URL hash for permalinks) ──
// `randomizeSeed: true` so a bare load (no permalink hash) shows a different city each time.
const handle = mountCityscape({ writeHash: true, randomizeSeed: true });
const canvasRenderer = handle.renderer;

// ── Toast helper ────────────────────────────────────────────────────────────
const toast = document.createElement("div");
toast.className = "cs-toast";
document.body.append(toast);
let toastTimer = 0;
function flash(msg: string): void {
	toast.textContent = msg;
	toast.classList.add("cs-toast-show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(
		() => toast.classList.remove("cs-toast-show"),
		1400,
	);
}

// ── Visibility state ──────────────────────────────────────────────────────────
// Default view shows only the hamburger button; the menu and the settings panel are
// summoned on demand, and immersive mode hides everything. `applyVisibility()` is the
// single place that maps this state onto the DOM — so leaving immersive can't resurrect
// a panel the user had closed.
let immersive = false;
let menuOpen = false;
let panelOpen = false;
function applyVisibility(): void {
	menuBtn.style.display = immersive ? "none" : "";
	menu.style.display = !immersive && menuOpen ? "" : "none";
	panel.el.style.display = !immersive && panelOpen ? "" : "none";
}
const setMenuOpen = (on: boolean): void => {
	menuOpen = on;
	applyVisibility();
};
const setPanelOpen = (on: boolean): void => {
	panelOpen = on;
	applyVisibility();
};

// ── Schema-driven control panel (hidden until summoned from the menu) ──────────
// `onClose` turns the panel's corner button into a ✕ that hides the whole panel
// (vs. the default ▾ that only collapses its body).
const panel = createControlPanel({
	config: handle.scene.config,
	onChange: (patch) => handle.update(patch),
	onClose: () => setPanelOpen(false),
	onShare: async () => {
		try {
			await navigator.clipboard.writeText(handle.permalink());
			flash("Permalink copied");
		} catch {
			flash("Copy failed");
		}
	},
});
document.body.append(panel.el);
// Keep the panel in sync with runtime-initiated changes (wheel scrubs speed).
handle.onConfigChange((cfg) => panel.set(cfg));

// ── ASCII renderer toggle — same DisplayList, different target ─────────────────
const pre = document.createElement("pre");
pre.id = "ascii";
document.body.append(pre);
const ascii = new AsciiRenderer({ cellWidth: 7, cellHeight: 12 });
const asciiAdapter: Renderer = {
	resize: (w, h) => ascii.resize(w, h),
	render: (list) => {
		ascii.render(list);
		pre.textContent = ascii.toString();
	},
};

// ── Pixel-art renderer — same DisplayList, painted low-res + dithered onto the same canvas ──
let pixelScale = 4;
const pixel = new PixelArtRenderer(handle.canvas, { pixelScale });

// ── Renderer mode switch (Canvas · ASCII · Pixel) ──────────────────────────────
type Mode = "canvas" | "ascii" | "pixel";
let mode: Mode = "canvas";
function setMode(next: Mode): void {
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
}
/** Toggle a mode on/off (off returns to Canvas). */
function toggleMode(m: Mode): void {
	setMode(mode === m ? "canvas" : m);
}
/**
 * Change the pixel-art block size (1 = fine … 12 = chunky). Only while the pixel view is active —
 * `pixel` shares the one canvas with the Canvas renderer, so re-sizing it off-screen would resize
 * that shared canvas behind the Canvas view's back.
 */
function adjustPixelScale(delta: number): void {
	if (mode !== "pixel") return;
	pixelScale = Math.max(1, Math.min(12, pixelScale + delta));
	pixel.setOptions({ pixelScale });
	flash(`Pixel size ${pixelScale}`);
}

// ── Hamburger menu — the only control visible by default (top-left) ───────────
// Holds every navigation control plus the trigger that summons the settings panel.
const menuBtn = document.createElement("button");
menuBtn.className = "cs-menu-btn";
menuBtn.textContent = "☰";
menuBtn.title = "Menu";
menuBtn.setAttribute("aria-label", "Menu");
menuBtn.addEventListener("click", (e) => {
	e.stopPropagation(); // don't let the outside-click handler immediately re-close it
	setMenuOpen(!menuOpen);
});

const menu = document.createElement("div");
menu.className = "cs-menu";

/** Build one menu row; picking it dismisses the menu, then runs the action. */
function menuItem(label: string, onPick: () => void): HTMLButtonElement {
	const b = document.createElement("button");
	b.className = "cs-menu-item";
	b.textContent = label;
	b.addEventListener("click", () => {
		setMenuOpen(false);
		onPick();
	});
	return b;
}

const asciiBtn = menuItem("ASCII view", () => toggleMode("ascii"));
const pixelBtn = menuItem("Pixel view", () => toggleMode("pixel"));
const fsBtn = menuItem("Fullscreen", () => setImmersive(true));
// Jump to the sibling nature example (same engine, different world).
const worldBtn = menuItem("🏞 Nature", () => (location.href = "../nature/"));
worldBtn.title = "Switch to the nature valley";
const settingsBtn = menuItem("⚙ Settings", () => setPanelOpen(true));

const hint = document.createElement("div");
hint.className = "cs-menu-hint";
hint.textContent =
	"move = parallax · wheel = speed · click = flash · keys: a / p / [ ] / m / h / f";

menu.append(asciiBtn, pixelBtn, fsBtn, worldBtn, settingsBtn, hint);
document.body.append(menuBtn, menu);

// ── Immersive view: hide every control and go fullscreen; Escape (or `f`) restores ──
function setImmersive(on: boolean): void {
	if (on === immersive) return;
	immersive = on;
	if (on) menuOpen = false; // don't leave a dangling menu to reappear on return
	applyVisibility();
	if (on) document.documentElement.requestFullscreen?.().catch(() => {});
	else if (document.fullscreenElement) {
		document.exitFullscreen?.().catch(() => {});
	}
}
// Leaving browser fullscreen (Escape, the window chrome, …) restores the controls.
document.addEventListener("fullscreenchange", () => {
	if (!document.fullscreenElement && immersive) setImmersive(false);
});
// Dismiss the menu on an outside click (the button stops its own click from bubbling).
document.addEventListener("click", (e) => {
	if (menuOpen && !menu.contains(e.target as Node)) setMenuOpen(false);
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
addEventListener("keydown", (e) => {
	if (
		e.target instanceof HTMLInputElement ||
		e.target instanceof HTMLSelectElement
	) {
		return;
	}
	if (e.key === "Escape") {
		if (menuOpen) setMenuOpen(false);
	} else if (e.key === "a") toggleMode("ascii");
	else if (e.key === "p") toggleMode("pixel");
	else if (e.key === "[") adjustPixelScale(-1);
	else if (e.key === "]") adjustPixelScale(1);
	else if (e.key === "m") setMenuOpen(!menuOpen);
	else if (e.key === "h") setPanelOpen(!panelOpen);
	else if (e.key === "f") setImmersive(!immersive);
});

// Render the initial state (hamburger only) and expose handles for console poking.
applyVisibility();
Object.assign(globalThis, { handle, panel });
