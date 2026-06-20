import { assert, assertEquals } from "@std/assert";
import { createNaturescape } from "../src/naturescape/scene.ts";
import type { DrawCommand } from "../src/engine/render/draw-command.ts";

function run(seed: string, frames: number): DrawCommand[] {
	const scene = createNaturescape({ seed, palette: "day" });
	scene.resize(800, 400);
	for (let i = 0; i < frames; i++) scene.update(16);
	return scene.collect(800, 400).commands;
}

Deno.test("nature scene is drawable immediately after resize, before any update()", () => {
	const scene = createNaturescape({ seed: "first-frame" });
	scene.resize(800, 400);
	const list = scene.collect(800, 400);
	assert(list.commands.length > 0, "first frame must be drawable");
	assertEquals(list.commands[0].kind, "gradient");
});

Deno.test("nature scene produces a non-trivial display list", () => {
	const cmds = run("hello", 30);
	assert(cmds.length > 20, `expected a rich frame, got ${cmds.length} commands`);
	assertEquals(cmds[0].kind, "gradient");
});

Deno.test("same seed + config reproduces the exact frame (full determinism)", () => {
	const a = run("repro", 45);
	const b = run("repro", 45);
	assertEquals(a, b);
});

Deno.test("different seeds produce different landscapes", () => {
	const a = run("alpha", 30);
	const b = run("beta", 30);
	assert(JSON.stringify(a) !== JSON.stringify(b));
});

Deno.test("live config changes don't throw and keep rendering", () => {
	const scene = createNaturescape({ seed: "live" });
	scene.resize(640, 360);
	for (let i = 0; i < 10; i++) scene.update(16);

	scene.setConfig({ palette: "golden" }); // non-structural
	scene.setConfig({ season: "winter", snowfall: 0.5, rain: 0.4 });
	scene.setConfig({ seasonCycle: true, rainbow: 0.8 });
	scene.setConfig({ parallaxLayers: 6 }); // structural → rebuild
	scene.setConfig({ seed: "live-2" }); // structural → rebuild

	for (let i = 0; i < 10; i++) scene.update(16);
	assert(scene.collect(640, 360).commands.length > 0);
});

Deno.test("poke is safe at any coordinate", () => {
	const scene = createNaturescape({ seed: "poke" });
	scene.resize(800, 400);
	for (let i = 0; i < 20; i++) scene.update(16);
	scene.poke(400, 380); // in the water
	scene.poke(-50, 9999);
	scene.poke(400, 10); // in the sky
	assert(scene.collect(800, 400).commands.length > 0);
});

Deno.test("nature update ignores non-positive dt", () => {
	const scene = createNaturescape({ seed: "dt" });
	scene.resize(400, 300);
	scene.update(0);
	scene.update(-16);
	assertEquals(scene.time, 0);
});
