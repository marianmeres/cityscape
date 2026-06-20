import { assert, assertEquals } from "@std/assert";
import {
	buildDefaults,
	CONFIG_SCHEMA,
	DEFAULT_CONFIG,
	normalizeConfig,
} from "../src/naturescape/config.ts";

Deno.test("nature: schema keys and DEFAULT_CONFIG keys are in 1:1 correspondence", () => {
	const schemaKeys = CONFIG_SCHEMA.map((f) => f.key).sort();
	const defaultKeys = Object.keys(DEFAULT_CONFIG).sort();
	assertEquals(schemaKeys, defaultKeys);
	assertEquals(schemaKeys.length, new Set(schemaKeys).size);
});

Deno.test("nature: buildDefaults equals DEFAULT_CONFIG", () => {
	assertEquals(buildDefaults(), DEFAULT_CONFIG);
});

Deno.test("nature: normalizeConfig clamps ranges", () => {
	const c = normalizeConfig({ cameraSpeed: 9999, brightness: -3, rain: 5 });
	assertEquals(c.cameraSpeed, 120);
	assertEquals(c.brightness, 0.3); // brightness floor
	assertEquals(c.rain, 1);
});

Deno.test("nature: normalizeConfig falls back on invalid selects", () => {
	const c = normalizeConfig({
		palette: "nonsense",
		season: "monsoon",
		cameraDirection: "sideways",
	});
	assertEquals(c.palette, "day");
	assertEquals(c.season, "summer");
	assertEquals(c.cameraDirection, "right");
});

Deno.test("nature: normalizeConfig coerces toggles/seeds, drops unknown keys", () => {
	const c = normalizeConfig({ seasonCycle: "true", seed: 99, bogus: "x" });
	assertEquals(c.seasonCycle, true);
	assertEquals(c.seed, "99");
	assert(!("bogus" in c));
});

Deno.test("nature: normalizeConfig fills everything from defaults on empty input", () => {
	assertEquals(normalizeConfig({}), DEFAULT_CONFIG);
	assertEquals(normalizeConfig(null), DEFAULT_CONFIG);
});
