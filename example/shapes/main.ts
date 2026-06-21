/**
 * Example app (shapes) — the interactive sibling. It wires the library exactly how a consumer
 * would: `mountShapes()` for the playable puzzle (canvas + HUD + start/solved screens), plus the
 * *same* generic schema-driven control panel the city and valley use, and a small menu. The puzzle
 * proves the engine, the renderer seam and the panel are domain-agnostic across a third, very
 * different kind of content. Bundle with:
 *
 *   deno task shapes:build      (or shapes:watch)
 */

import { mountShapes } from "../../src/runtime/mount-shapes.ts";
import { CONFIG_SCHEMA, type ShapesConfig } from "../../src/shapes/config.ts";
import { createControlPanel } from "../../src/ui/panel.ts";
import { ICONS } from "../../src/runtime/icons.ts";

const handle = mountShapes({ title: true, randomizeSeed: true });

// ── Settings panel (the generic panel, driven by the shapes schema) ──────────
const panel = createControlPanel<ShapesConfig>({
	config: handle.scene.config,
	schema: CONFIG_SCHEMA,
	title: "Shapes",
	onChange: (patch) => {
		handle.scene.setConfig(patch);
		panel.set(handle.scene.config);
	},
	onClose: () => setPanelOpen(false),
});
panel.el.style.display = "none";
document.body.append(panel.el);

// ── Menu ─────────────────────────────────────────────────────────────────────
let menuOpen = false;
let panelOpen = false;
const applyVisibility = (): void => {
	menu.style.display = menuOpen ? "flex" : "none";
	panel.el.style.display = panelOpen ? "" : "none";
};
function setPanelOpen(on: boolean): void {
	panelOpen = on;
	applyVisibility();
}

const menuBtn = document.createElement("button");
menuBtn.className = "shp-menu-btn";
menuBtn.innerHTML = ICONS.menu;
menuBtn.title = "Menu";
menuBtn.setAttribute("aria-label", "Menu");
menuBtn.onclick = () => {
	menuOpen = !menuOpen;
	applyVisibility();
};
document.body.append(menuBtn);

const menu = document.createElement("div");
menu.className = "shp-menu";

const newGame = menuItem(ICONS.refresh, "New puzzle", () => {
	handle.scene.setConfig({ seed: Math.random().toString(36).slice(2, 9) });
	panel.set(handle.scene.config);
	menuOpen = false;
	applyVisibility();
});
const settings = menuItem(ICONS.settings, "Settings", () => {
	setPanelOpen(!panelOpen);
	menuOpen = false;
	applyVisibility();
});
const worlds = document.createElement("a");
worlds.className = "shp-menu-item";
worlds.innerHTML = `${ICONS.back}<span>Worlds</span>`;
worlds.href = "../";

menu.append(newGame, settings, worlds);
document.body.append(menu);

function menuItem(icon: string, label: string, onClick: () => void): HTMLButtonElement {
	const b = document.createElement("button");
	b.className = "shp-menu-item";
	b.type = "button";
	b.innerHTML = `${icon}<span>${label}</span>`;
	b.onclick = onClick;
	return b;
}
