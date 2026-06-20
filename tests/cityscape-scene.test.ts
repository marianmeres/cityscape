import { assert, assertEquals } from "@std/assert";
import { createCityscape } from "../src/cityscape/scene.ts";
import type { DrawCommand } from "../src/engine/render/draw-command.ts";

function run(seed: string, frames: number): DrawCommand[] {
	const scene = createCityscape({ seed, palette: "navy" });
	scene.resize(800, 400);
	for (let i = 0; i < frames; i++) scene.update(16);
	return scene.collect(800, 400).commands;
}

Deno.test("scene is drawable immediately after resize, before any update()", () => {
	// Regression: the render loop can paint a frame before its first fixed update step (a 0ms
	// first delta dispatches no steps). resize() must prime the scene so collect() is valid.
	const scene = createCityscape({ seed: "first-frame" });
	scene.resize(800, 400);
	const list = scene.collect(800, 400); // no update() yet
	assert(list.commands.length > 0, "first frame must be drawable");
	assertEquals(list.commands[0].kind, "gradient");
});

Deno.test("scene produces a non-trivial display list", () => {
	const cmds = run("hello", 30);
	assert(cmds.length > 20, `expected a rich frame, got ${cmds.length} commands`);
	// First command is the full-screen sky gradient.
	assertEquals(cmds[0].kind, "gradient");
});

Deno.test("same seed + config reproduces the exact frame (full determinism)", () => {
	const a = run("repro", 45);
	const b = run("repro", 45);
	assertEquals(a, b);
});

Deno.test("different seeds produce different cities", () => {
	const a = run("alpha", 30);
	const b = run("beta", 30);
	// Overwhelmingly likely the command stream differs.
	assert(JSON.stringify(a) !== JSON.stringify(b));
});

Deno.test("live config changes don't throw and keep rendering", () => {
	const scene = createCityscape({ seed: "live" });
	scene.resize(640, 360);
	for (let i = 0; i < 10; i++) scene.update(16);

	scene.setConfig({ palette: "vaporwave" }); // non-structural
	scene.setConfig({ cameraDirection: "left", cameraSpeed: 40 });
	scene.setConfig({ parallaxLayers: 6 }); // structural → rebuild
	scene.setConfig({ seed: "live-2" }); // structural → rebuild

	for (let i = 0; i < 10; i++) scene.update(16);
	assert(scene.collect(640, 360).commands.length > 0);
});

Deno.test("poke is safe at any coordinate", () => {
	const scene = createCityscape({ seed: "poke" });
	scene.resize(800, 400);
	for (let i = 0; i < 20; i++) scene.update(16);
	scene.poke(400, 300);
	scene.poke(-50, 9999);
	assert(scene.collect(800, 400).commands.length > 0);
});

Deno.test("update ignores non-positive dt", () => {
	const scene = createCityscape({ seed: "dt" });
	scene.resize(400, 300);
	scene.update(0);
	scene.update(-16);
	assertEquals(scene.time, 0);
});
