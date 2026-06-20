import { assert, assertEquals } from "@std/assert";
import { AsciiRenderer } from "../src/render/ascii/ascii-renderer.ts";
import { DisplayListBuilder } from "../src/engine/render/draw-command.ts";
import { rgb } from "../src/engine/math/color.ts";
import type { DisplayList } from "../src/engine/render/draw-command.ts";

Deno.test("ascii grid dimensions follow cell size", () => {
	const r = new AsciiRenderer({ cellWidth: 10, cellHeight: 10 });
	r.resize(30, 30);
	assertEquals(r.cols, 3);
	assertEquals(r.rows, 3);
});

Deno.test("a full white rect renders the brightest glyph everywhere", () => {
	const r = new AsciiRenderer({ cellWidth: 10, cellHeight: 10 });
	r.resize(30, 30);
	const list: DisplayList = {
		width: 30,
		height: 30,
		offsetY: 0,
		commands: [{ kind: "rect", x: 0, y: 0, w: 30, h: 30, color: rgb(255, 255, 255) }],
	};
	r.render(list);
	assertEquals(r.toString(), "@@@\n@@@\n@@@");
});

Deno.test("an empty list renders all spaces", () => {
	const r = new AsciiRenderer({ cellWidth: 10, cellHeight: 10 });
	r.resize(30, 30);
	r.render({ width: 30, height: 30, offsetY: 0, commands: [] });
	assertEquals(r.toString(), "   \n   \n   ");
});

Deno.test("paint order: a bright window overwrites a dark building", () => {
	const r = new AsciiRenderer({ cellWidth: 10, cellHeight: 10 });
	r.resize(30, 30);
	const list: DisplayList = {
		width: 30,
		height: 30,
		offsetY: 0,
		commands: [
			{ kind: "rect", x: 0, y: 0, w: 30, h: 30, color: rgb(0, 0, 0) }, // dark bg
			{ kind: "rect", x: 10, y: 10, w: 10, h: 10, color: rgb(255, 255, 255) }, // window
		],
	};
	r.render(list);
	const lines = r.toString().split("\n");
	assertEquals(lines[1][1], "@"); // center cell is bright
	assertEquals(lines[0][0], " "); // corner stays dark
});

Deno.test("ascii rendering is deterministic and consumes the same DisplayList", () => {
	const builder = new DisplayListBuilder(40, 20);
	builder.gradient(0, 0, 40, 20, [
		{ at: 0, color: rgb(0, 0, 0) },
		{ at: 1, color: rgb(60, 60, 90) },
	], true);
	builder.rect(15, 8, 6, 6, rgb(255, 230, 160));
	const r1 = new AsciiRenderer();
	const r2 = new AsciiRenderer();
	r1.resize(40, 20);
	r2.resize(40, 20);
	r1.render(builder);
	r2.render(builder);
	assertEquals(r1.toString(), r2.toString());
	assert(r1.toString().includes("\n"), "should be a multi-line frame");
});
