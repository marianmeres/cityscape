/**
 * Renderer-agnostic color: an `{r,g,b,a}` struct plus perceptual mixing.
 *
 * Colors live in the simulation as plain data (no CSS strings, no canvas) so the core stays
 * renderer-agnostic — a renderer turns a {@link Color} into whatever its target needs
 * (`rgba()` for canvas, a luminance bucket for ASCII). Mixing is done in **Oklab** space so the
 * slow mood transitions look perceptually even rather than muddying through grey (the same
 * reason `@marianmeres/design-tokens` mixes in oklab).
 *
 * @module
 */

import { clamp } from "./ease.ts";

/** An RGBA color. `r,g,b` are `0..255`; `a` is `0..1`. */
export interface Color {
	r: number;
	g: number;
	b: number;
	a: number;
}

/** Construct a {@link Color} (alpha defaults to opaque). Values are clamped. */
export function rgb(r: number, g: number, b: number, a = 1): Color {
	return {
		r: clamp(Math.round(r), 0, 255),
		g: clamp(Math.round(g), 0, 255),
		b: clamp(Math.round(b), 0, 255),
		a: clamp(a, 0, 1),
	};
}

/** Parse a `#rgb`, `#rrggbb`, or `#rrggbbaa` hex string into a {@link Color}. */
export function fromHex(hex: string): Color {
	let h = hex.trim().replace(/^#/, "");
	if (h.length === 3 || h.length === 4) {
		h = h.split("").map((c) => c + c).join("");
	}
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
	return rgb(r, g, b, a);
}

/** A copy of `c` with a new alpha. */
export function withAlpha(c: Color, a: number): Color {
	return { r: c.r, g: c.g, b: c.b, a: clamp(a, 0, 1) };
}

/** Multiply alpha by `factor` (clamped). */
export function fadeAlpha(c: Color, factor: number): Color {
	return withAlpha(c, c.a * factor);
}

/** CSS `rgba(...)` string for canvas / DOM renderers. */
export function toCss(c: Color): string {
	return `rgba(${c.r},${c.g},${c.b},${round3(c.a)})`;
}

/** Relative luminance `0..1` (Rec. 709) — used by the ASCII renderer to pick a glyph. */
export function luminance(c: Color): number {
	return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

/* -------------------------------------------------------------------------- *
 * Oklab perceptual mixing
 * -------------------------------------------------------------------------- */

function srgbToLinear(c: number): number {
	const x = c / 255;
	return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function linearToSrgb(x: number): number {
	const c = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
	return clamp(Math.round(c * 255), 0, 255);
}

type Oklab = { L: number; a: number; b: number };

function toOklab(c: Color): Oklab {
	const r = srgbToLinear(c.r);
	const g = srgbToLinear(c.g);
	const b = srgbToLinear(c.b);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return {
		L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	};
}

function fromOklab(o: Oklab, alpha: number): Color {
	const l_ = o.L + 0.3963377774 * o.a + 0.2158037573 * o.b;
	const m_ = o.L - 0.1055613458 * o.a - 0.0638541728 * o.b;
	const s_ = o.L - 0.0894841775 * o.a - 1.291485548 * o.b;
	const l = l_ * l_ * l_;
	const m = m_ * m_ * m_;
	const s = s_ * s_ * s_;
	return {
		r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
		a: clamp(alpha, 0, 1),
	};
}

/**
 * Perceptually mix `a`→`b` by `t` (`0`=a, `1`=b) in Oklab space. Alpha is lerped linearly.
 * This is the workhorse for the mood cycle and palette interpolation.
 */
export function mix(a: Color, b: Color, t: number): Color {
	const k = clamp(t, 0, 1);
	const oa = toOklab(a);
	const ob = toOklab(b);
	return fromOklab(
		{
			L: oa.L + (ob.L - oa.L) * k,
			a: oa.a + (ob.a - oa.a) * k,
			b: oa.b + (ob.b - oa.b) * k,
		},
		a.a + (b.a - a.a) * k,
	);
}

/** Darken `c` toward black by `amount` (`0..1`), in Oklab space. */
export function darken(c: Color, amount: number): Color {
	return mix(c, rgb(0, 0, 0, c.a), amount);
}

/** Lighten `c` toward white by `amount` (`0..1`), in Oklab space. */
export function lighten(c: Color, amount: number): Color {
	return mix(c, rgb(255, 255, 255, c.a), amount);
}

/** Build a {@link Color} from HSL (`h` 0..360, `s`/`l` 0..1). */
export function hsl(h: number, s: number, l: number, a = 1): Color {
	const hh = ((h % 360) + 360) % 360 / 360;
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const r = hueToRgb(p, q, hh + 1 / 3);
	const g = hueToRgb(p, q, hh);
	const b = hueToRgb(p, q, hh - 1 / 3);
	return rgb(r * 255, g * 255, b * 255, a);
}

function hueToRgb(p: number, q: number, t: number): number {
	let x = t;
	if (x < 0) x += 1;
	if (x > 1) x -= 1;
	if (x < 1 / 6) return p + (q - p) * 6 * x;
	if (x < 1 / 2) return q;
	if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
	return p;
}

function round3(n: number): number {
	return Math.round(n * 1000) / 1000;
}
