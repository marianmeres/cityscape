/**
 * The SPA entry — a tiny hash router over one mount point (`#app`). The chooser and the three
 * worlds are *routes* of a single installable app rather than separate pages, so switching worlds
 * is an in-document swap (no reload, never drops out of the home-screen full-screen shell on
 * mobile). Each route is a {@link ViewFactory} that builds itself into `#app` and hands back a
 * `destroy()` the router calls before navigating away — that teardown is what makes the swap leak-free.
 *
 * Hash routing (`#/`, `#/city`, …) needs no server rewrites, so the whole thing is static-hostable.
 * Bundle with:  deno task example:build      (or example:watch)
 */

import { createChooser } from "./chooser.ts";
import { createCityExample, createNatureExample } from "./worlds/scape.ts";
import { createShapesExample } from "./worlds/shapes.ts";
import type { View, ViewFactory } from "./view.ts";

interface Route {
	factory: ViewFactory;
	/** Drives the address-bar / status-bar tint (`<meta name="theme-color">`) for this route. */
	themeColor: string;
}

const ROUTES: Record<string, Route> = {
	"/": { factory: createChooser, themeColor: "#0a0f1e" },
	"/city": { factory: createCityExample, themeColor: "#0a0f1e" },
	"/nature": { factory: createNatureExample, themeColor: "#bfe0f5" },
	"/shapes": { factory: createShapesExample, themeColor: "#12161e" },
};

const mount = document.getElementById("app");
if (!mount) throw new Error("#app mount point missing");
const app: HTMLElement = mount; // narrowed once, so the router closure sees it non-null
const themeMeta = document.querySelector('meta[name="theme-color"]');

let current: View | null = null;
let currentKey = "";

/** The current route key (`/`, `/city`, …), or `null` if the hash names no known route. */
function routeKey(): string | null {
	const raw = location.hash.replace(/^#/, "") || "/";
	// `Object.hasOwn`, not `in` — otherwise `#constructor`, `#toString`, … resolve off the
	// prototype chain to a non-route and crash the router.
	return Object.hasOwn(ROUTES, raw) ? raw : null;
}

/** Tear down the live view and mount the one the hash points at. */
function render(): void {
	const key = routeKey();
	if (key === null) {
		location.hash = "#/"; // unknown route → normalise (re-fires hashchange)
		return;
	}
	if (key === currentKey && current) return; // already showing it
	current?.destroy();
	const route = ROUTES[key];
	themeMeta?.setAttribute("content", route.themeColor);
	current = route.factory(app);
	currentKey = key;
}

globalThis.addEventListener("hashchange", render);
render();

// ── PWA: register the service worker (best-effort — the app runs fine without it) ──
if ("serviceWorker" in navigator) {
	globalThis.addEventListener("load", () => {
		navigator.serviceWorker.register("./sw.js").catch(() => {});
	});
}
