import { assert, assertEquals } from "@std/assert";
import { oklabDistanceSq, rgb } from "../src/engine/math/color.ts";
import { makeBayer } from "../src/engine/render/pixel/dither.ts";
import {
	buildPaletteLut,
	ditherQuantize,
	extractPalette,
} from "../src/engine/render/pixel/palette.ts";

/** Build an RGBA buffer from `[r,g,b,a]` tuples. */
function buf(...px: number[][]): Uint8ClampedArray {
	const out = new Uint8ClampedArray(px.length * 4);
	px.forEach((p, i) => out.set(p, i * 4));
	return out;
}

Deno.test("oklabDistanceSq: zero for equal, ordered by perceptual distance", () => {
	const black = rgb(0, 0, 0);
	assertEquals(oklabDistanceSq(black, black), 0);
	assert(
		oklabDistanceSq(black, rgb(255, 255, 255)) >
			oklabDistanceSq(black, rgb(64, 64, 64)),
	);
});

Deno.test("extractPalette: median cut separates two dominant colours", () => {
	const pixels = buf(
		[255, 0, 0, 255],
		[255, 0, 0, 255],
		[0, 0, 255, 255],
		[0, 0, 255, 255],
	);
	const pal = extractPalette(pixels, { size: 2 });
	assertEquals(pal.length, 2);
	const hasRed = pal.some((c) => c.r > 200 && c.b < 60);
	const hasBlue = pal.some((c) => c.b > 200 && c.r < 60);
	assert(hasRed, "palette should contain a red");
	assert(hasBlue, "palette should contain a blue");
});

Deno.test("extractPalette: skips transparent pixels, falls back to black", () => {
	const pixels = buf([255, 255, 255, 0], [10, 20, 30, 0]);
	const pal = extractPalette(pixels, { size: 4 });
	assertEquals(pal, [{ r: 0, g: 0, b: 0, a: 1 }]);
});

Deno.test("extractPalette: never exceeds the requested size", () => {
	const px: number[][] = [];
	for (let i = 0; i < 64; i++) px.push([i * 4, 255 - i * 4, (i * 7) % 256, 255]);
	const pal = extractPalette(buf(...px), { size: 8 });
	assert(pal.length <= 8, `expected ≤8, got ${pal.length}`);
});

Deno.test("buildPaletteLut: cube corners map to the nearest palette colour", () => {
	const pal = [rgb(0, 0, 0), rgb(255, 255, 255)];
	const lut = buildPaletteLut(pal, 5);
	const n = 1 << lut.bits;
	const darkCell = 0; // (0,0,0)
	const brightCell = (n - 1) * n * n + (n - 1) * n + (n - 1);
	assertEquals(lut.a[darkCell * 3], 0); // black
	assertEquals(lut.a[brightCell * 3], 255); // white
});

Deno.test("ditherQuantize: flat mid-grey dithers across both palette tones", () => {
	const w = 8, h = 8;
	const data = new Uint8ClampedArray(w * h * 4);
	for (let i = 0; i < w * h; i++) data.set([128, 128, 128, 255], i * 4);
	const lut = buildPaletteLut([rgb(0, 0, 0), rgb(255, 255, 255)], 5);
	ditherQuantize(data, w, h, lut, makeBayer(3), 1);

	let black = 0, white = 0;
	for (let i = 0; i < w * h; i++) {
		const r = data[i * 4];
		assert(r === 0 || r === 255, `pixel ${i} not a palette tone: ${r}`);
		assertEquals(data[i * 4 + 3], 255); // alpha preserved
		if (r === 0) black++;
		else white++;
	}
	assert(black > 0 && white > 0, `expected a mix, got ${black} black / ${white} white`);
});

Deno.test("ditherQuantize: strength 0 collapses to flat nearest colour", () => {
	const w = 8, h = 8;
	const data = new Uint8ClampedArray(w * h * 4);
	for (let i = 0; i < w * h; i++) data.set([128, 128, 128, 255], i * 4);
	const lut = buildPaletteLut([rgb(0, 0, 0), rgb(255, 255, 255)], 5);
	ditherQuantize(data, w, h, lut, makeBayer(3), 0);

	const first = data[0];
	for (let i = 0; i < w * h; i++) assertEquals(data[i * 4], first); // uniform
});

Deno.test("ditherQuantize: leaves transparent pixels untouched", () => {
	const data = buf([128, 128, 128, 0]);
	const lut = buildPaletteLut([rgb(0, 0, 0), rgb(255, 255, 255)], 5);
	ditherQuantize(data, 1, 1, lut, makeBayer(3), 1);
	assertEquals(Array.from(data), [128, 128, 128, 0]);
});
