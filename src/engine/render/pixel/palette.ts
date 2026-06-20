/**
 * Palette extraction + colour quantisation — the pure core of the pixel-art look.
 *
 * Three pieces, all DOM-free and unit-tested:
 *
 *  1. {@link extractPalette} — reduce a frame's RGBA pixels to a small representative palette via
 *     **median cut**. Run on the scene *as rendered*, so the palette tracks the live mood (night →
 *     dawn) instead of being a fixed retro set, while still collapsing to a handful of tones.
 *  2. {@link buildPaletteLut} — precompute, for every cell of a coarse RGB cube, the *two* nearest
 *     palette colours (perceptual Oklab) and where the cell sits between them. One array lookup.
 *  3. {@link ditherQuantize} — map an RGBA buffer onto the palette in place, choosing per pixel
 *     between those two colours by an ordered-dither threshold so smooth ramps cross-hatch.
 *
 * The renderer owns the canvases and pixel readback; everything here is plain typed-array math.
 *
 * @module
 */

import { type Color, oklab } from "../../math/color.ts";
import { type BayerMatrix, bayerThreshold } from "./dither.ts";

/** Writable RGBA pixel buffer (e.g. an `ImageData.data`), 4 bytes per pixel. */
export type RgbaPixels = Uint8ClampedArray | Uint8Array;

/** Alpha (`0..255`) below which a pixel is treated as transparent and skipped. */
const MIN_OPAQUE_ALPHA = 8;

/** Options for {@link extractPalette}. */
export interface PaletteOptions {
	/** Target palette size (upper bound; median cut may return fewer). Default `32`. */
	size?: number;
	/** Sample every `sampleStride`-th pixel for speed (≥1). Default `1` (every pixel). */
	sampleStride?: number;
	/** Skip pixels whose alpha is below this (`0..255`). Default {@link MIN_OPAQUE_ALPHA} (8). */
	alphaThreshold?: number;
}

/**
 * Reduce RGBA pixel data to at most `size` representative colours via median cut: repeatedly split
 * the colour box with the widest channel range at its median, then average each final box. Nearly
 * transparent pixels are ignored. Deterministic for a given input.
 */
export function extractPalette(
	pixels: RgbaPixels,
	opts: PaletteOptions = {},
): Color[] {
	const size = Math.max(1, Math.floor(opts.size ?? 32));
	const stride = Math.max(1, Math.floor(opts.sampleStride ?? 1));
	const alphaMin = opts.alphaThreshold ?? MIN_OPAQUE_ALPHA;
	const step = 4 * stride;

	// Gather opaque samples as a flat r,g,b byte array.
	const samples: number[] = [];
	for (let i = 0; i + 3 < pixels.length; i += step) {
		if (pixels[i + 3] < alphaMin) continue;
		samples.push(pixels[i], pixels[i + 1], pixels[i + 2]);
	}
	if (samples.length === 0) return [{ r: 0, g: 0, b: 0, a: 1 }];
	return medianCut(Uint8Array.from(samples), size);
}

interface ColorBox {
	start: number;
	count: number;
}

/** Median-cut over a flat `[r,g,b,...]` byte array, returning ≤`maxColors` averaged colours. */
function medianCut(pts: Uint8Array, maxColors: number): Color[] {
	const n = pts.length / 3;
	const idx = new Int32Array(n);
	for (let i = 0; i < n; i++) idx[i] = i;

	const boxes: ColorBox[] = [{ start: 0, count: n }];

	// Widest channel (0=r,1=g,2=b) of a box and that range, scanning its index slice.
	const widest = (box: ColorBox): { channel: number; range: number } => {
		let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
		const end = box.start + box.count;
		for (let i = box.start; i < end; i++) {
			const p = idx[i] * 3;
			const r = pts[p], g = pts[p + 1], b = pts[p + 2];
			if (r < rmin) rmin = r;
			if (r > rmax) rmax = r;
			if (g < gmin) gmin = g;
			if (g > gmax) gmax = g;
			if (b < bmin) bmin = b;
			if (b > bmax) bmax = b;
		}
		const rr = rmax - rmin, gr = gmax - gmin, br = bmax - bmin;
		if (rr >= gr && rr >= br) return { channel: 0, range: rr };
		return gr >= br ? { channel: 1, range: gr } : { channel: 2, range: br };
	};

	while (boxes.length < maxColors) {
		// Pick the splittable box with the largest single-channel spread.
		let target = -1;
		let bestRange = 0;
		let bestChannel = 0;
		for (let i = 0; i < boxes.length; i++) {
			if (boxes[i].count < 2) continue;
			const w = widest(boxes[i]);
			if (w.range > bestRange) {
				bestRange = w.range;
				bestChannel = w.channel;
				target = i;
			}
		}
		if (target < 0) break; // every box is a single colour — done

		const box = boxes[target];
		// Sort the box's slice along its widest channel, then split at the median.
		const slice = Array.from(idx.subarray(box.start, box.start + box.count));
		slice.sort((a, b) => pts[a * 3 + bestChannel] - pts[b * 3 + bestChannel]);
		for (let i = 0; i < slice.length; i++) idx[box.start + i] = slice[i];
		const half = box.count >> 1;
		boxes.splice(
			target,
			1,
			{ start: box.start, count: half },
			{ start: box.start + half, count: box.count - half },
		);
	}

	return boxes.map((box) => {
		let r = 0, g = 0, b = 0;
		const end = box.start + box.count;
		for (let i = box.start; i < end; i++) {
			const p = idx[i] * 3;
			r += pts[p];
			g += pts[p + 1];
			b += pts[p + 2];
		}
		const c = Math.max(1, box.count);
		return {
			r: Math.round(r / c),
			g: Math.round(g / c),
			b: Math.round(b / c),
			a: 1,
		};
	});
}

/**
 * A precomputed ordered-dither lookup over a `2^bits`-per-channel RGB cube. For each cell it holds
 * the two nearest palette colours (`a` = nearest, `b` = second) and `t`, how far the cell sits from
 * `a` toward `b` (`0..255`). {@link ditherQuantize} picks `a` or `b` per pixel by comparing the
 * Bayer threshold to `t`, which dithers cleanly across the whole `a`→`b` transition.
 */
export interface PaletteLut {
	/** Bits per channel (cube side = `2^bits`). */
	bits: number;
	/** Nearest palette RGB per cube cell: `[r,g,b]` × `(2^bits)³`. */
	a: Uint8Array;
	/** Second-nearest palette RGB per cube cell: `[r,g,b]` × `(2^bits)³`. */
	b: Uint8Array;
	/** Mix fraction toward `b` per cube cell, `0..255`. */
	t: Uint8Array;
}

/**
 * Precompute, for every cell of a `2^bits`-per-channel RGB cube, the two nearest palette colours
 * (perceptual Oklab) and the cell's position between them. `bits` 5 → a 32³ (32768-cell) cube, a
 * good speed/quality balance. Rebuild only when the palette changes; per-pixel dithering then costs
 * one lookup + one compare.
 */
export function buildPaletteLut(palette: Color[], bits = 5): PaletteLut {
	const bb = Math.max(1, Math.min(8, Math.floor(bits)));
	const n = 1 << bb;
	const shift = 8 - bb;
	const half = shift > 0 ? 1 << (shift - 1) : 0;
	const pal = palette.length > 0 ? palette : [{ r: 0, g: 0, b: 0, a: 1 }];
	const palOk = pal.map(oklab);
	const cells = n * n * n;
	const a = new Uint8Array(cells * 3);
	const b = new Uint8Array(cells * 3);
	const t = new Uint8Array(cells);

	for (let r = 0; r < n; r++) {
		for (let g = 0; g < n; g++) {
			for (let bl = 0; bl < n; bl++) {
				// Use the cell centre as its representative colour.
				const o = oklab({
					r: (r << shift) + half,
					g: (g << shift) + half,
					b: (bl << shift) + half,
					a: 1,
				});
				// Nearest (i1) and second-nearest (i2) palette entries, in Oklab.
				let i1 = 0, d1 = Infinity, i2 = -1, d2 = Infinity;
				for (let p = 0; p < palOk.length; p++) {
					const po = palOk[p];
					const dL = o.L - po.L, da = o.a - po.a, db = o.b - po.b;
					const d = dL * dL + da * da + db * db;
					if (d < d1) {
						d2 = d1;
						i2 = i1;
						d1 = d;
						i1 = p;
					} else if (d < d2) {
						d2 = d;
						i2 = p;
					}
				}
				if (i2 < 0) i2 = i1; // single-colour palette
				// Project o onto the i1→i2 segment to get the mix fraction toward i2.
				const p1 = palOk[i1], p2 = palOk[i2];
				const vL = p2.L - p1.L, va = p2.a - p1.a, vb = p2.b - p1.b;
				const vv = vL * vL + va * va + vb * vb;
				let tt = vv > 1e-9
					? ((o.L - p1.L) * vL + (o.a - p1.a) * va + (o.b - p1.b) * vb) / vv
					: 0;
				tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;

				const cell = (r * n + g) * n + bl;
				const c3 = cell * 3;
				const ca = pal[i1], cb = pal[i2];
				a[c3] = ca.r;
				a[c3 + 1] = ca.g;
				a[c3 + 2] = ca.b;
				b[c3] = cb.r;
				b[c3 + 1] = cb.g;
				b[c3 + 2] = cb.b;
				t[cell] = Math.round(tt * 255);
			}
		}
	}
	return { bits: bb, a, b, t };
}

/**
 * Quantise an RGBA buffer onto a palette **in place**, using ordered (Bayer) dithering. For each
 * pixel the LUT yields its two nearest palette colours and the mix fraction `t` between them; the
 * pixel takes the second colour when its {@link bayerThreshold} falls below `t`, so smooth ramps
 * cross-hatch between tones instead of banding. `strength` scales the dithering: `0` collapses to
 * the nearest colour (flat bands), `1` is full cross-hatch. Alpha is preserved; nearly transparent
 * pixels are left untouched.
 */
export function ditherQuantize(
	data: RgbaPixels,
	width: number,
	height: number,
	lut: PaletteLut,
	bayer: BayerMatrix,
	strength = 1,
): void {
	const n = 1 << lut.bits;
	const shift = 8 - lut.bits;
	const { a, b, t } = lut;
	const s = strength < 0 ? 0 : strength > 1 ? 1 : strength;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			if (data[i + 3] < MIN_OPAQUE_ALPHA) continue;
			const cell = ((data[i] >> shift) * n + (data[i + 1] >> shift)) * n +
				(data[i + 2] >> shift);
			const frac = (t[cell] / 255) * s;
			const src = bayerThreshold(bayer, x, y) < frac ? b : a;
			const c3 = cell * 3;
			data[i] = src[c3];
			data[i + 1] = src[c3 + 1];
			data[i + 2] = src[c3 + 2];
		}
	}
}
