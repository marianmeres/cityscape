import { assert, assertEquals } from "@std/assert";
import { createShapes } from "../src/shapes/scene.ts";
import { AsciiRenderer } from "../src/render/ascii/ascii-renderer.ts";

Deno.test("scene is drawable immediately and produces a non-trivial frame", () => {
	const scene = createShapes({ seed: "first" });
	scene.resize(800, 600);
	const list = scene.collect(800, 600);
	assert(list.commands.length > 0, "first frame must be drawable");
	assertEquals(list.commands[0].kind, "rect"); // background
});

Deno.test("same seed reproduces the exact first frame", () => {
	const a = createShapes({ seed: "repro" });
	const b = createShapes({ seed: "repro" });
	a.resize(640, 480);
	b.resize(640, 480);
	assertEquals(a.collect(640, 480).commands, b.collect(640, 480).commands);
});

Deno.test("different seeds generally differ", () => {
	const a = createShapes({ seed: "alpha" });
	const b = createShapes({ seed: "beta" });
	a.resize(640, 480);
	b.resize(640, 480);
	const ja = JSON.stringify(a.collect(640, 480).commands);
	const jb = JSON.stringify(b.collect(640, 480).commands);
	assert(ja !== jb);
});

Deno.test("the board renders to a non-empty ASCII frame (seam works headlessly)", () => {
	const scene = createShapes({ seed: "ascii" });
	scene.resize(160, 120);
	for (let i = 0; i < 5; i++) scene.update(16);
	const ascii = new AsciiRenderer({ cellWidth: 4, cellHeight: 6 });
	ascii.resize(160, 120);
	ascii.render(scene.collect(160, 120));
	const text = ascii.toString();
	assert(text.length > 0);
	assert(/[^\s]/.test(text), "expected some non-blank glyphs");
});

Deno.test("nextLevel advances and rebuilds; update ignores non-positive dt", () => {
	const scene = createShapes({ seed: "flow" });
	scene.resize(400, 700);
	assertEquals(scene.levelNumber, 1);
	scene.nextLevel();
	assertEquals(scene.levelNumber, 2);
	scene.update(0);
	scene.update(-5);
	assertEquals(scene.time, 0);
});

Deno.test("a generation-affecting config change rebuilds the level", () => {
	const scene = createShapes({ seed: "cfg" });
	scene.resize(500, 500);
	const before = scene.par;
	scene.setConfig({ palette: "candy" }); // non-structural → same level
	assertEquals(scene.par, before);
	scene.setConfig({ seed: "cfg-2" }); // structural → rebuild
	assert(scene.collect(500, 500).commands.length > 0);
});
