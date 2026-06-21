/**
 * The chooser — the SPA's landing view (route `#/`). A small gallery of cards, one per world,
 * each an anchor to its hash route (`#/city`, `#/nature`, `#/shapes`) so the router handles the
 * navigation and the browser keeps real-link semantics (focus, middle-click, back).
 *
 * Ported from the old static `example/index.html`; styling lives in `app.css` (`.chooser`).
 */

import type { View } from "./view.ts";

interface CardSpec {
	route: string;
	cls: string;
	emoji: string;
	title: string;
	blurb: string;
	cta: string;
}

const CARDS: CardSpec[] = [
	{
		route: "#/city",
		cls: "card-city",
		emoji: "🌃",
		title: "Night city",
		blurb:
			"A calm, dark skyline scrolling across a reflective sea — moon, stars, drifting " +
			"clouds, lit windows and a lamp-lit shore.",
		cta: "Enter the city →",
	},
	{
		route: "#/nature",
		cls: "card-nature",
		emoji: "🏞️",
		title: "Nature valley",
		blurb:
			"A sunlit, day-cycling valley — rolling forested hills, snow-capped peaks, a lake " +
			"and cabins, with seasons, weather and wildlife.",
		cta: "Wander the valley →",
	},
	{
		route: "#/shapes",
		cls: "card-shapes",
		emoji: "🧩",
		title: "Shapes",
		blurb:
			"The interactive one: a polyomino puzzle. Rotate, flip and drag the scattered " +
			"pieces back into the figure — in the fewest moves.",
		cta: "Solve the figure →",
	},
];

/** Build the chooser into `host` (route `#/`). */
export function createChooser(host: HTMLElement): View {
	const root = document.createElement("div");
	root.className = "chooser";

	const header = document.createElement("header");
	header.className = "chooser-header";
	const h1 = document.createElement("h1");
	h1.textContent = "@marianmeres/cityscape";
	const tagline = document.createElement("p");
	tagline.className = "tagline";
	tagline.append(
		"Three worlds on one headless engine — two procedurally-generated parallax " +
			"animations and one interactive puzzle — all sharing the same swappable ",
	);
	const code = document.createElement("code");
	code.textContent = "Canvas · ASCII · Pixel";
	tagline.append(code, " renderer seam. Take your pick.");
	header.append(h1, tagline);

	const main = document.createElement("main");
	main.className = "cards";
	for (const c of CARDS) {
		const card = document.createElement("a");
		card.className = `card ${c.cls}`;
		card.href = c.route;
		const emoji = document.createElement("div");
		emoji.className = "emoji";
		emoji.textContent = c.emoji;
		const h2 = document.createElement("h2");
		h2.textContent = c.title;
		const p = document.createElement("p");
		p.textContent = c.blurb;
		const go = document.createElement("span");
		go.className = "go";
		go.textContent = c.cta;
		card.append(emoji, h2, p, go);
		main.append(card);
	}

	const footer = document.createElement("footer");
	footer.append("The animation is the demo; the ");
	const link = document.createElement("a");
	link.href = "https://github.com/marianmeres/cityscape";
	link.textContent = "architecture";
	footer.append(link, " is the point.");

	root.append(header, main, footer);
	host.append(root);

	return {
		destroy() {
			root.remove();
		},
	};
}
