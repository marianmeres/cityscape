import { assert, assertEquals } from "@std/assert";
import {
	buildDefaults,
	CONFIG_SCHEMA,
	DEFAULT_CONFIG,
	normalizeConfig,
} from "../src/cityscape/config.ts";

Deno.test("schema keys and DEFAULT_CONFIG keys are in 1:1 correspondence", () => {
	const schemaKeys = CONFIG_SCHEMA.map((f) => f.key).sort();
	const defaultKeys = Object.keys(DEFAULT_CONFIG).sort();
	assertEquals(schemaKeys, defaultKeys);
	// No duplicate keys in the schema.
	assertEquals(schemaKeys.length, new Set(schemaKeys).size);
});

Deno.test("buildDefaults equals DEFAULT_CONFIG", () => {
	assertEquals(buildDefaults(), DEFAULT_CONFIG);
});

Deno.test("normalizeConfig clamps ranges", () => {
	const c = normalizeConfig({ cameraSpeed: 9999, darkness: -3 });
	assertEquals(c.cameraSpeed, 120);
	assertEquals(c.darkness, 0);
});

Deno.test("normalizeConfig falls back on invalid select / direction", () => {
	const c = normalizeConfig({ palette: "nonsense", cameraDirection: "sideways" });
	assertEquals(c.palette, "dawn"); // the default palette
	assertEquals(c.cameraDirection, "right");
});

Deno.test("normalizeConfig coerces toggles and seeds, drops unknown keys", () => {
	const c = normalizeConfig({
		audioEnabled: "true",
		seed: 12345,
		bogus: "x",
	});
	assertEquals(c.audioEnabled, true);
	assertEquals(c.seed, "12345");
	assert(!("bogus" in c));
});

Deno.test("normalizeConfig fills everything from defaults on empty input", () => {
	assertEquals(normalizeConfig({}), DEFAULT_CONFIG);
	assertEquals(normalizeConfig(null), DEFAULT_CONFIG);
});
