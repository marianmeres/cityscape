import { assert, assertEquals } from "@std/assert";
import { MoodEngine, silhouetteColor } from "../src/cityscape/mood.ts";
import { DEFAULT_CONFIG } from "../src/cityscape/config.ts";
import { luminance } from "../src/engine/math/color.ts";

Deno.test("mood snapshot is well-formed", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	m.update(5000, DEFAULT_CONFIG);
	assertEquals(m.mood.sky.length, 3);
	assert(m.mood.warmth >= 0 && m.mood.warmth <= 1);
	assert(m.mood.darkness >= 0 && m.mood.darkness <= 1);
	assertEquals(m.mood.sky[0].at, 0);
	assertEquals(m.mood.sky[2].at, 1);
});

Deno.test("mood cycles over time (warmth changes)", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	m.update(0, DEFAULT_CONFIG);
	const w0 = m.mood.warmth;
	m.update(DEFAULT_CONFIG.moodCycleSeconds * 1000 * 0.5, DEFAULT_CONFIG);
	const wHalf = m.mood.warmth;
	assert(Math.abs(w0 - wHalf) > 0.1, "warmth should move across the cycle");
});

Deno.test("silhouetteColor: near buildings darker than far (atmospheric haze)", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	m.update(3000, DEFAULT_CONFIG);
	const far = silhouetteColor(m.mood, 0);
	const near = silhouetteColor(m.mood, 1);
	assert(luminance(near) <= luminance(far), "near should be at least as dark as far");
});

Deno.test("setPalette swaps the resolved colours", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	m.update(1000, DEFAULT_CONFIG);
	const before = { ...m.mood.moon };
	m.setPalette("vaporwave");
	m.update(1000, DEFAULT_CONFIG);
	const after = m.mood.moon;
	assert(
		before.r !== after.r || before.g !== after.g || before.b !== after.b,
		"palette switch should change colours",
	);
});

Deno.test("mood is deterministic", () => {
	const a = new MoodEngine(DEFAULT_CONFIG, 7);
	const b = new MoodEngine(DEFAULT_CONFIG, 7);
	a.update(1234, DEFAULT_CONFIG);
	b.update(1234, DEFAULT_CONFIG);
	assertEquals(a.mood.window, b.mood.window);
	assertEquals(a.mood.sky[1].color, b.mood.sky[1].color);
});
