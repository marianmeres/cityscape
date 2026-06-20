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
import type { Renderer } from "../src/engine/render/renderer.ts";

// ── Mount the running cityscape (writes config to the URL hash for permalinks) ──
const handle = mountCityscape({ writeHash: true });
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
	toastTimer = setTimeout(() => toast.classList.remove("cs-toast-show"), 1400);
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

let asciiOn = false;
function setAscii(on: boolean): void {
	asciiOn = on;
	pre.style.display = on ? "block" : "none";
	handle.canvas.style.opacity = on ? "0" : "1";
	handle.setRenderer(on ? asciiAdapter : canvasRenderer);
	asciiBtn.textContent = on ? "Canvas view" : "ASCII view";
}

// ── Bottom bar (ASCII toggle + interaction hint) ──────────────────────────────
const bar = document.createElement("div");
bar.className = "cs-bar";
const asciiBtn = document.createElement("button");
asciiBtn.className = "cs-bar-btn";
asciiBtn.textContent = "ASCII view";
asciiBtn.addEventListener("click", () => setAscii(!asciiOn));
const hint = document.createElement("span");
hint.className = "cs-hint";
hint.textContent =
	"move = parallax · wheel = speed · click = flash windows · keys: a / h";
bar.append(asciiBtn, hint);
document.body.append(bar);

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
addEventListener("keydown", (e) => {
	if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
		return;
	}
	if (e.key === "a") setAscii(!asciiOn);
	else if (e.key === "h") panel.toggle();
});

// Expose for console poking.
Object.assign(globalThis, { handle, panel });
