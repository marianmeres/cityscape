/**
 * The shapes world (route `#/shapes`) — the interactive sibling. Wires the library exactly how a
 * consumer would: `mountShapes()` for the playable puzzle (canvas + HUD + start/solved screens),
 * plus the *same* generic schema-driven control panel the scapes use, and a small corner menu.
 *
 * Adapted from the old `shapes/main.ts` for the SPA: everything is built into a `data-world` stage
 * and `destroy()` unwinds it so the router can leave the route cleanly (mountShapes' own handle
 * removes its loop, listeners, audio and DOM; we remove the panel + menu we added on top).
 */

import { mountShapes } from "../../src/runtime/mount-shapes.ts";
import { CONFIG_SCHEMA, type ShapesConfig } from "../../src/shapes/config.ts";
import { createControlPanel } from "../../src/ui/panel.ts";
import { ICONS } from "../../src/runtime/icons.ts";
import type { View } from "../view.ts";

/** Build the shapes puzzle into `host`. */
export function createShapesExample(host: HTMLElement): View {
	const stage = document.createElement("div");
	stage.className = "stage";
	stage.dataset.world = "shapes";
	host.append(stage);

	const handle = mountShapes({ container: stage, title: true, randomizeSeed: true });

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
	stage.append(panel.el);

	// ── Menu ─────────────────────────────────────────────────────────────────────
	let menuOpen = false;
	let panelOpen = false;
	const applyVisibility = (): void => {
		menu.style.display = menuOpen ? "flex" : "none";
		panel.el.style.display = panelOpen ? "" : "none";
	};
	const setPanelOpen = (on: boolean): void => {
		panelOpen = on;
		applyVisibility();
	};

	const menuBtn = document.createElement("button");
	menuBtn.className = "shp-menu-btn";
	menuBtn.innerHTML = ICONS.menu;
	menuBtn.title = "Menu";
	menuBtn.setAttribute("aria-label", "Menu");
	menuBtn.onclick = () => {
		menuOpen = !menuOpen;
		applyVisibility();
	};
	stage.append(menuBtn);

	const menu = document.createElement("div");
	menu.className = "shp-menu";

	const menuItem = (
		icon: string,
		label: string,
		onClick: () => void,
	): HTMLButtonElement => {
		const b = document.createElement("button");
		b.className = "shp-menu-item";
		b.type = "button";
		b.innerHTML = `${icon}<span>${label}</span>`;
		b.onclick = onClick;
		return b;
	};

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
	const worlds = menuItem(ICONS.back, "Worlds", () => (location.hash = "#/"));

	menu.append(newGame, settings, worlds);
	stage.append(menu);

	return {
		destroy() {
			panel.destroy();
			handle.destroy();
			stage.remove();
		},
	};
}
