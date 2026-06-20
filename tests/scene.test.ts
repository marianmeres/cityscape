import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { Camera } from "../src/engine/scene/camera.ts";
import { Layer } from "../src/engine/scene/layer.ts";
import { World } from "../src/engine/scene/world.ts";
import type { DrawContext, Entity, UpdateContext } from "../src/engine/scene/entity.ts";
import { rgb } from "../src/engine/math/color.ts";

type Env = { tag: string };

/** A trivial entity that records updates and draws a unit rect tagged with its id. */
class Marker implements Entity<Env> {
	depth: number;
	bounds = { x: 0, width: 1 };
	alive = true;
	updates = 0;
	constructor(public id: number, depth = 0.5) {
		this.depth = depth;
	}
	update(_ctx: UpdateContext<Env>): void {
		this.updates++;
	}
	draw(ctx: DrawContext): void {
		ctx.out.rect(this.id, 0, 1, 1, rgb(0, 0, 0));
	}
}

Deno.test("camera parallax endpoints", () => {
	const cam = new Camera({ minParallax: 0.2 });
	assertAlmostEquals(cam.parallaxAt(0), 0.2);
	assertAlmostEquals(cam.parallaxAt(1), 1);
});

Deno.test("camera project applies scroll and sway by depth", () => {
	const cam = new Camera({ minParallax: 0.5, speed: 0 });
	cam.scroll = 100;
	// near layer (depth 1): full scroll subtracted.
	assertEquals(cam.project(0, 1), -100);
	// far layer (depth 0, factor 0.5): half scroll.
	assertEquals(cam.project(0, 0), -50);
	cam.sway = 10;
	assertEquals(cam.project(0, 1), -90); // +sway*1
});

Deno.test("camera step advances scroll by speed", () => {
	const cam = new Camera({ speed: 50 });
	cam.step(1000); // 1s
	assertEquals(cam.scroll, 50);
});

Deno.test("camera isVisible with margin (world-unit coords, unit=height)", () => {
	const cam = new Camera({ minParallax: 1, speed: 0 });
	cam.resize(200, 100); // unit = 100 px per world-unit; viewport is 2 world-units wide
	assert(cam.isVisible(0.5, 0.2, 1)); // projects to [50, 70] px
	assert(!cam.isVisible(10, 0.2, 1)); // projects to 1000 px, off-screen
	assert(cam.isVisible(-0.1, 0.05, 1, 20)); // within the left margin
});

Deno.test("layer updates entities and compacts the dead", () => {
	const layer = new Layer<Env>("test", 0.5);
	const a = new Marker(1);
	const b = new Marker(2);
	layer.add(a);
	layer.add(b);
	b.alive = false;
	const ctx: UpdateContext<Env> = {
		dt: 16,
		time: 16,
		width: 100,
		height: 100,
		env: { tag: "x" },
	};
	layer.update(ctx);
	assertEquals(layer.entities.length, 1);
	assertEquals(layer.entities[0], a);
	assertEquals(a.updates, 1);
});

Deno.test("world draws layers far -> near and sorts by depth", () => {
	const world = new World<Env>();
	const near = new Layer<Env>("near", 0.9);
	const far = new Layer<Env>("far", 0.1);
	near.add(new Marker(2, 0.9));
	far.add(new Marker(1, 0.1));
	world.addLayer(near);
	world.addLayer(far); // added second but is farther
	const list = world.collect(100, 100);
	// Far layer's rect (id 1 → x=1) must be drawn before the near one (id 2 → x=2).
	assertEquals(list.commands.map((c) => (c.kind === "rect" ? c.x : -1)), [1, 2]);
});
