import { assert, assertEquals } from "@std/assert";
import { foliageColor, landColor, MoodEngine } from "../src/naturescape/mood.ts";
import { DEFAULT_CONFIG } from "../src/naturescape/config.ts";
import { luminance } from "../src/engine/math/color.ts";

Deno.test("nature mood snapshot is well-formed", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	m.update(5000, DEFAULT_CONFIG);
	assertEquals(m.mood.sky.length, 3);
	assert(m.mood.warmth >= 0 && m.mood.warmth <= 1);
	assert(m.mood.daylight >= 0 && m.mood.daylight <= 1);
	assertEquals(m.mood.sky[0].at, 0);
	assertEquals(m.mood.sky[2].at, 1);
});

Deno.test("nature day stays light all cycle long (never night)", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	const cycle = DEFAULT_CONFIG.dayCycleSeconds * 1000;
	let min = 1;
	for (let i = 0; i <= 24; i++) {
		m.update((cycle * i) / 24, DEFAULT_CONFIG);
		min = Math.min(min, m.mood.daylight);
	}
	assert(min > 0.4, `daylight should never dip to night, got min ${min}`);
});

Deno.test("nature day cycles over time (warmth + sun height change)", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	const cycle = DEFAULT_CONFIG.dayCycleSeconds * 1000;
	m.update(0, DEFAULT_CONFIG);
	const w0 = m.mood.warmth;
	const h0 = m.mood.sunHeight;
	m.update(cycle * 0.5, DEFAULT_CONFIG);
	assert(Math.abs(w0 - m.mood.warmth) > 0.1, "warmth should move across the day");
	assert(Math.abs(h0 - m.mood.sunHeight) > 0.1, "the sun should change height");
});

Deno.test("landColor: distant hills hazier (lighter) than near", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	m.update(3000, DEFAULT_CONFIG);
	const far = landColor(m.mood, 0);
	const near = landColor(m.mood, 1);
	assert(
		luminance(near) <= luminance(far),
		"near land should be at least as dark as far",
	);
	// Foliage hazing too.
	assert(
		luminance(foliageColor(m.mood, 1)) <= luminance(foliageColor(m.mood, 0)) + 0.001,
	);
});

Deno.test("season resolves snow: winter snowy, summer bare", () => {
	const winter = new MoodEngine({ ...DEFAULT_CONFIG, season: "winter" }, 1);
	winter.update(1000, { ...DEFAULT_CONFIG, season: "winter" });
	const summer = new MoodEngine({ ...DEFAULT_CONFIG, season: "summer" }, 1);
	summer.update(1000, { ...DEFAULT_CONFIG, season: "summer" });
	assert(winter.mood.snow > 0.5, "winter should lie snow");
	assertEquals(summer.mood.snow, 0);
});

Deno.test("seasonCycle blends seasons over the year", () => {
	const cfg = { ...DEFAULT_CONFIG, season: "spring", seasonCycle: true };
	const m = new MoodEngine(cfg, 1);
	m.update(0, cfg);
	const t0 = m.mood.seasonT;
	m.update(cfg.seasonCycleSeconds * 1000 * 0.4, cfg);
	assert(t0 !== m.mood.seasonT, "season blend should advance when cycling");
});

Deno.test("setPalette swaps the resolved colours", () => {
	const m = new MoodEngine(DEFAULT_CONFIG, 1);
	m.update(1000, DEFAULT_CONFIG);
	const before = { ...m.mood.sky[0].color };
	m.setPalette("golden");
	m.update(1000, DEFAULT_CONFIG);
	const after = m.mood.sky[0].color;
	assert(
		before.r !== after.r || before.g !== after.g || before.b !== after.b,
		"palette switch should change colours",
	);
});

Deno.test("nature mood is deterministic", () => {
	const a = new MoodEngine(DEFAULT_CONFIG, 7);
	const b = new MoodEngine(DEFAULT_CONFIG, 7);
	a.update(1234, DEFAULT_CONFIG);
	b.update(1234, DEFAULT_CONFIG);
	assertEquals(a.mood.sky[1].color, b.mood.sky[1].color);
	assertEquals(a.mood.foliage, b.mood.foliage);
});
