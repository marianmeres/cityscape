import { assertEquals } from "@std/assert";
import { DisplayListBuilder } from "../src/engine/render/draw-command.ts";
import { rgb } from "../src/engine/math/color.ts";

Deno.test("DisplayListBuilder records commands in order", () => {
	const b = new DisplayListBuilder(100, 50);
	b.rect(0, 0, 10, 10, rgb(1, 2, 3))
		.circle(5, 5, 2, rgb(4, 5, 6))
		.line(0, 0, 9, 9, 1, rgb(7, 8, 9));
	assertEquals(b.commands.length, 3);
	assertEquals(b.commands.map((c) => c.kind), ["rect", "circle", "line"]);
	assertEquals(b.width, 100);
	assertEquals(b.height, 50);
});

Deno.test("DisplayListBuilder gradient/glow/polygon/text shapes", () => {
	const b = new DisplayListBuilder(10, 10);
	b.gradient(0, 0, 10, 10, [{ at: 0, color: rgb(0, 0, 0) }], true);
	b.glow(1, 1, 4, rgb(255, 255, 255), 0.5);
	b.polygon([0, 0, 1, 0, 1, 1], rgb(1, 1, 1));
	b.text(2, 2, "hi", 8, rgb(9, 9, 9));
	assertEquals(b.commands.map((c) => c.kind), ["gradient", "glow", "polygon", "text"]);
});

Deno.test("DisplayListBuilder reset clears and resizes", () => {
	const b = new DisplayListBuilder(10, 10);
	b.rect(0, 0, 1, 1, rgb(0, 0, 0));
	b.reset(20, 30);
	assertEquals(b.commands.length, 0);
	assertEquals([b.width, b.height], [20, 30]);
});
