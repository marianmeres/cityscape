import { assert, assertEquals } from "@std/assert";
import {
	darken,
	fromHex,
	hsl,
	lighten,
	luminance,
	mix,
	rgb,
	toCss,
	withAlpha,
} from "../src/engine/math/color.ts";

Deno.test("rgb clamps to byte range and alpha", () => {
	assertEquals(rgb(300, -5, 128, 2), { r: 255, g: 0, b: 128, a: 1 });
});

Deno.test("fromHex parses #rgb, #rrggbb, #rrggbbaa", () => {
	assertEquals(fromHex("#fff"), { r: 255, g: 255, b: 255, a: 1 });
	assertEquals(fromHex("#ff8800"), { r: 255, g: 136, b: 0, a: 1 });
	const a = fromHex("#00000080");
	assertEquals(a.r, 0);
	assert(Math.abs(a.a - 0.5) < 0.01);
});

Deno.test("mix endpoints and midpoint", () => {
	const black = rgb(0, 0, 0);
	const white = rgb(255, 255, 255);
	assertEquals(mix(black, white, 0), black);
	assertEquals(mix(black, white, 1), white);
	const mid = mix(black, white, 0.5);
	// Perceptual (Oklab) midpoint grey sits strictly between the ends — and, being perceptual
	// rather than naive sRGB, it is darker than 127.
	assert(mid.r > 50 && mid.r < 220, `mid grey ${mid.r}`);
	assert(mid.r === mid.g && mid.g === mid.b, "grey stays neutral");
});

Deno.test("mix is clamped on t", () => {
	const a = rgb(10, 20, 30);
	const b = rgb(200, 100, 50);
	assertEquals(mix(a, b, -1), a);
	assertEquals(mix(a, b, 5), b);
});

Deno.test("luminance ordering", () => {
	assert(luminance(rgb(255, 255, 255)) > luminance(rgb(0, 0, 0)));
	assertEquals(luminance(rgb(0, 0, 0)), 0);
	assert(Math.abs(luminance(rgb(255, 255, 255)) - 1) < 1e-9);
});

Deno.test("darken/lighten move toward black/white", () => {
	const c = rgb(120, 120, 120);
	assert(luminance(darken(c, 0.5)) < luminance(c));
	assert(luminance(lighten(c, 0.5)) > luminance(c));
});

Deno.test("withAlpha and toCss", () => {
	assertEquals(withAlpha(rgb(1, 2, 3), 0.25).a, 0.25);
	assertEquals(toCss(rgb(10, 20, 30, 0.5)), "rgba(10,20,30,0.5)");
});

Deno.test("hsl produces expected primaries", () => {
	assertEquals(hsl(0, 1, 0.5), rgb(255, 0, 0));
	assertEquals(hsl(120, 1, 0.5), rgb(0, 255, 0));
	assertEquals(hsl(240, 1, 0.5), rgb(0, 0, 255));
});
