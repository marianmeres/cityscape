/**
 * Example app — wires the library into a full-page background with a control panel and a live
 * Canvas ⇄ ASCII renderer toggle (the visible proof that the renderer seam is real).
 *
 * Written exactly how a consumer would: import the library, `mountCityscape()`, build the panel
 * from the schema, and swap renderers through the returned handle. Bundle with:
 *
 *   deno task example:build      (or example:watch)
 */

import { mountCityscape } from "../src/runtime/mount.ts";
import { createControlPanel } from "../src/ui/panel.ts";
import { AsciiRenderer } from "../src/render/ascii/ascii-renderer.ts";
import { PixelArtRenderer } from "../src/render/pixelart/pixelart-renderer.ts";
import type { Renderer } from "../src/engine/render/renderer.ts";

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

// ── Schema-driven control panel ───────────────────────────────────────────────
const panel = createControlPanel({
	config: handle.scene.config,
	onChange: (patch) => handle.update(patch),
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

// ── Bottom bar (ASCII toggle · fullscreen · interaction hint) ─────────────────
const bar = document.createElement("div");
bar.className = "cs-bar";
const asciiBtn = document.createElement("button");
asciiBtn.className = "cs-bar-btn";
asciiBtn.textContent = "ASCII view";
asciiBtn.addEventListener("click", () => toggleMode("ascii"));
const pixelBtn = document.createElement("button");
pixelBtn.className = "cs-bar-btn";
pixelBtn.textContent = "Pixel view";
pixelBtn.addEventListener("click", () => toggleMode("pixel"));
const fsBtn = document.createElement("button");
fsBtn.className = "cs-bar-btn";
fsBtn.textContent = "Fullscreen";
fsBtn.addEventListener("click", () => setImmersive(true));
const hint = document.createElement("span");
hint.className = "cs-hint";
hint.textContent =
	"move = parallax · wheel = speed · click = flash · keys: a / p / [ ] / h / f";
bar.append(asciiBtn, pixelBtn, fsBtn, hint);
document.body.append(bar);

// ── Immersive view: hide every control and go fullscreen; Escape (or `f`) restores ──
const controls: HTMLElement[] = [panel.el, bar];
let immersive = false;
function setImmersive(on: boolean): void {
	if (on === immersive) return;
	immersive = on;
	for (const el of controls) el.style.display = on ? "none" : "";
	if (on) document.documentElement.requestFullscreen?.().catch(() => {});
	else if (document.fullscreenElement) {
		document.exitFullscreen?.().catch(() => {});
	}
}
// Leaving browser fullscreen (Escape, the window chrome, …) restores the controls.
document.addEventListener("fullscreenchange", () => {
	if (!document.fullscreenElement && immersive) setImmersive(false);
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
addEventListener("keydown", (e) => {
	if (
		e.target instanceof HTMLInputElement ||
		e.target instanceof HTMLSelectElement
	) {
		return;
	}
	if (e.key === "a") toggleMode("ascii");
	else if (e.key === "p") toggleMode("pixel");
	else if (e.key === "[") adjustPixelScale(-1);
	else if (e.key === "]") adjustPixelScale(1);
	else if (e.key === "h") panel.toggle();
	else if (e.key === "f") setImmersive(!immersive);
});

// Expose for console poking.
Object.assign(globalThis, { handle, panel });
