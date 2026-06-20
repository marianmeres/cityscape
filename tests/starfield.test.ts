import { assert, assertEquals } from "@std/assert";
import { Camera } from "../src/engine/scene/camera.ts";
import {
	DisplayListBuilder,
	type DrawCommand,
} from "../src/engine/render/draw-command.ts";
import { Starfield } from "../src/cityscape/sky/starfield.ts";
import { createRng } from "../src/engine/math/rng.ts";
import { rgb } from "../src/engine/math/color.ts";
import type { CityEnv } from "../src/cityscape/env.ts";
import type { UpdateContext } from "../src/engine/scene/entity.ts";

/** Render one starfield frame at a given viewport width and density; return the draw commands. */
function render(width: number, density: number): DrawCommand[] {
	const cam = new Camera({ speed: 0 });
	cam.resize(width, 800);
	const field = new Starfield(createRng(42));
	const env = {
		config: { starDensity: density },
		mood: { star: rgb(255, 255, 255) },
	} as unknown as CityEnv;
	field.update(
		{ dt: 16, time: 0, width, height: 800, env } as UpdateContext<CityEnv>,
	);
	const out = new DisplayListBuilder(width, 800);
	field.draw({ out, camera: cam, width, height: 800 });
	return out.commands;
}

Deno.test("starfield tiles across a viewport wider than its 1600px tile", () => {
	const xs = render(2400, 1)
		.filter((c) => c.kind === "circle")
		.map((c) => (c as { x: number }).x);
	assert(xs.length > 0, "expected stars to be drawn");
	// The regression: stars used to be confined to [0, 1600), leaving wide screens bare.
	assert(xs.some((x) => x > 1600), "expected stars beyond the first tile");
	assert(xs.some((x) => x < 800), "expected stars in the left region too");
	assert(xs.every((x) => x >= 0 && x < 2400), "stars stay within the viewport");
});

Deno.test("starfield draws nothing when density is 0", () => {
	const circles = render(2400, 0).filter((c) => c.kind === "circle");
	assertEquals(circles.length, 0);
});
