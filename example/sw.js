/*
	Service worker for the example SPA — just enough to make the demo installable and
	offline-capable. Strategy is **network-first** for same-origin GETs: online visitors always
	get the freshest bundle (handy while developing), and the cached copy is the offline fallback.
	Navigations fall back to the app shell so any hash route resolves client-side when offline.

	Bump VERSION whenever you want to guarantee old caches are dropped on the next visit.
*/
const VERSION = "v1";
const CACHE = `cityscape-${VERSION}`;

const PRECACHE = [
	"./",
	"./index.html",
	"./app.css",
	"./theme/tokens.css",
	"./dist/bundle.js",
	"./manifest.webmanifest",
	"./icons/icon.svg",
	"./icons/icon-192.png",
	"./icons/icon-512.png",
	"./icons/icon-maskable-512.png",
	"./icons/apple-touch-180.png",
];

self.addEventListener("install", (event) => {
	event.waitUntil((async () => {
		const cache = await caches.open(CACHE);
		// Tolerate an individually-missing asset rather than failing the whole install.
		await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
		await self.skipWaiting();
	})());
});

self.addEventListener("activate", (event) => {
	event.waitUntil((async () => {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
		await self.clients.claim();
	})());
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	if (new URL(req.url).origin !== self.location.origin) return;

	event.respondWith((async () => {
		const cache = await caches.open(CACHE);
		try {
			const fresh = await fetch(req);
			if (fresh && fresh.ok) cache.put(req, fresh.clone());
			return fresh;
		} catch {
			const cached = await cache.match(req);
			if (cached) return cached;
			if (req.mode === "navigate") {
				const shell = (await cache.match("./index.html")) ??
					(await cache.match("./"));
				if (shell) return shell;
			}
			return Response.error();
		}
	})());
});
