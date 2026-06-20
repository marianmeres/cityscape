/**
 * The ASCII renderer — proof that the renderer seam is real.
 *
 * It consumes the very same {@link DisplayList} the Canvas renderer does, but rasterises it into a
 * low-resolution **character grid**: each {@link DrawCommand} blends its luminance into the cells
 * it covers (respecting paint order and alpha), and the grid is mapped to glyphs through a
 * dark→bright ramp. Because the output is a plain string, this renderer is completely DOM-free
 * and **unit-testable** — rendering a known list yields a known frame, which doubly verifies the
 * abstraction.
 *
 * @module
 */

import { type Color, luminance } from "../../engine/math/color.ts";
import type {
	DisplayList,
	DrawCommand,
	GradientStop,
} from "../../engine/render/draw-command.ts";
import type { Renderer } from "../../engine/render/renderer.ts";
import { clamp } from "../../engine/math/ease.ts";

/** Dark → bright glyph ramp. */
const RAMP = " .,:;-=+*oO%#@";

/** Options for {@link AsciiRenderer}. */
export interface AsciiOptions {
	/** Approx CSS px per character column (monospace advance). */
	cellWidth?: number;
	/** Approx CSS px per character row (monospace line height). */
	cellHeight?: number;
	/** Glyph ramp, dark → bright. */
	ramp?: string;
}

/** A {@link Renderer} that rasterises to a character grid. Headless and deterministic. */
export class AsciiRenderer implements Renderer {
	#cols = 0;
	#rows = 0;
	#cellW: number;
	#cellH: number;
	#ramp: string;
	#buf: Float32Array = new Float32Array(0);
	#vw = 0;
	#vh = 0;
	#offsetY = 0;

	constructor(opts: AsciiOptions = {}) {
		this.#cellW = opts.cellWidth ?? 7;
		this.#cellH = opts.cellHeight ?? 13;
		this.#ramp = opts.ramp ?? RAMP;
	}

	/** Grid columns. */
	get cols(): number {
		return this.#cols;
	}
	/** Grid rows. */
	get rows(): number {
		return this.#rows;
	}

	resize(width: number, height: number): void {
		this.#vw = width;
		this.#vh = height;
		this.#cols = Math.max(1, Math.round(width / this.#cellW));
		this.#rows = Math.max(1, Math.round(height / this.#cellH));
		this.#buf = new Float32Array(this.#cols * this.#rows);
	}

	render(list: DisplayList): void {
		// Map the list's layout space onto our grid (handles a list sized differently to resize()).
		if (list.width > 0) this.#vw = list.width;
		if (list.height > 0) this.#vh = list.height;
		this.#offsetY = list.offsetY;
		this.#buf.fill(0);
		for (const cmd of list.commands) this.#rasterize(cmd);
	}

	/** The current frame as a newline-joined string of glyphs. */
	toString(): string {
		const ramp = this.#ramp;
		const last = ramp.length - 1;
		const out: string[] = [];
		for (let r = 0; r < this.#rows; r++) {
			let line = "";
			for (let c = 0; c < this.#cols; c++) {
				const v = clamp(this.#buf[r * this.#cols + c], 0, 1);
				line += ramp[Math.round(v * last)];
			}
			out.push(line);
		}
		return out.join("\n");
	}

	/** Raw per-cell brightness buffer (row-major) — for custom (e.g. coloured DOM) ASCII targets. */
	get buffer(): Float32Array {
		return this.#buf;
	}

	#toCol(x: number): number {
		return (x / this.#vw) * this.#cols;
	}
	#toRow(y: number): number {
		return ((y + this.#offsetY) / this.#vh) * this.#rows;
	}

	#blend(cx: number, cy: number, lum: number, a: number): void {
		if (cx < 0 || cy < 0 || cx >= this.#cols || cy >= this.#rows) return;
		const i = cy * this.#cols + cx;
		this.#buf[i] = this.#buf[i] * (1 - a) + lum * a;
	}

	#add(cx: number, cy: number, v: number): void {
		if (cx < 0 || cy < 0 || cx >= this.#cols || cy >= this.#rows) return;
		const i = cy * this.#cols + cx;
		this.#buf[i] = clamp(this.#buf[i] + v, 0, 1);
	}

	#fillRect(x: number, y: number, w: number, h: number, lum: number, a: number): void {
		const c0 = Math.max(0, Math.floor(this.#toCol(x)));
		const c1 = Math.min(this.#cols - 1, Math.ceil(this.#toCol(x + w)) - 1);
		const r0 = Math.max(0, Math.floor(this.#toRow(y)));
		const r1 = Math.min(this.#rows - 1, Math.ceil(this.#toRow(y + h)) - 1);
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) this.#blend(c, r, lum, a);
		}
	}

	#rasterize(cmd: DrawCommand): void {
		switch (cmd.kind) {
			case "rect":
				this.#fillRect(
					cmd.x,
					cmd.y,
					cmd.w,
					cmd.h,
					luminance(cmd.color),
					cmd.color.a,
				);
				return;
			case "gradient": {
				// Per grid-row sample of the (vertical) gradient; horizontal handled per column.
				const c0 = Math.max(0, Math.floor(this.#toCol(cmd.x)));
				const c1 = Math.min(
					this.#cols - 1,
					Math.ceil(this.#toCol(cmd.x + cmd.w)) - 1,
				);
				const r0 = Math.max(0, Math.floor(this.#toRow(cmd.y)));
				const r1 = Math.min(
					this.#rows - 1,
					Math.ceil(this.#toRow(cmd.y + cmd.h)) - 1,
				);
				for (let r = r0; r <= r1; r++) {
					for (let c = c0; c <= c1; c++) {
						const t = cmd.vertical
							? (r - r0) / Math.max(1, r1 - r0)
							: (c - c0) / Math.max(1, c1 - c0);
						const col = sampleStops(cmd.stops, t);
						this.#blend(c, r, luminance(col), col.a);
					}
				}
				return;
			}
			case "circle": {
				const rc = this.#toCol(cmd.x);
				const rr = this.#toRow(cmd.y);
				const radC = (cmd.r / this.#vw) * this.#cols;
				const radR = (cmd.r / this.#vh) * this.#rows;
				const lum = luminance(cmd.color);
				const c0 = Math.max(0, Math.floor(rc - radC));
				const c1 = Math.min(this.#cols - 1, Math.ceil(rc + radC));
				const r0 = Math.max(0, Math.floor(rr - radR));
				const r1 = Math.min(this.#rows - 1, Math.ceil(rr + radR));
				for (let r = r0; r <= r1; r++) {
					for (let c = c0; c <= c1; c++) {
						const dx = (c + 0.5 - rc) / Math.max(0.01, radC);
						const dy = (r + 0.5 - rr) / Math.max(0.01, radR);
						if (dx * dx + dy * dy <= 1) this.#blend(c, r, lum, cmd.color.a);
					}
				}
				return;
			}
			case "line": {
				const x0 = this.#toCol(cmd.x1);
				const y0 = this.#toRow(cmd.y1);
				const x1 = this.#toCol(cmd.x2);
				const y1 = this.#toRow(cmd.y2);
				const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
				const lum = luminance(cmd.color);
				for (let s = 0; s <= steps; s++) {
					const t = s / steps;
					this.#blend(
						Math.round(x0 + (x1 - x0) * t),
						Math.round(y0 + (y1 - y0) * t),
						lum,
						cmd.color.a,
					);
				}
				return;
			}
			case "glow": {
				const rc = this.#toCol(cmd.x);
				const rr = this.#toRow(cmd.y);
				const radC = (cmd.r / this.#vw) * this.#cols;
				const radR = (cmd.r / this.#vh) * this.#rows;
				const peak = luminance(cmd.color) * cmd.intensity * cmd.color.a;
				const c0 = Math.max(0, Math.floor(rc - radC));
				const c1 = Math.min(this.#cols - 1, Math.ceil(rc + radC));
				const r0 = Math.max(0, Math.floor(rr - radR));
				const r1 = Math.min(this.#rows - 1, Math.ceil(rr + radR));
				for (let r = r0; r <= r1; r++) {
					for (let c = c0; c <= c1; c++) {
						const dx = (c + 0.5 - rc) / Math.max(0.01, radC);
						const dy = (r + 0.5 - rr) / Math.max(0.01, radR);
						const d = dx * dx + dy * dy;
						if (d <= 1) this.#add(c, r, peak * (1 - d) * 0.5);
					}
				}
				return;
			}
			case "polygon":
				this.#fillPolygon(cmd.points, luminance(cmd.color), cmd.color.a);
				return;
			case "text":
				// Stamp the literal glyphs into the grid at full brightness.
				for (let i = 0; i < cmd.text.length; i++) {
					const c = Math.floor(this.#toCol(cmd.x)) + i;
					const r = Math.floor(this.#toRow(cmd.y));
					this.#blend(c, r, luminance(cmd.color), cmd.color.a);
				}
				return;
		}
	}

	#fillPolygon(points: number[], lum: number, a: number): void {
		let minY = Infinity;
		let maxY = -Infinity;
		const n = points.length / 2;
		for (let i = 0; i < n; i++) {
			const y = this.#toRow(points[i * 2 + 1]);
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
		const r0 = Math.max(0, Math.floor(minY));
		const r1 = Math.min(this.#rows - 1, Math.ceil(maxY));
		for (let r = r0; r <= r1; r++) {
			const yc = r + 0.5;
			const xs: number[] = [];
			for (let i = 0; i < n; i++) {
				const ax = this.#toCol(points[i * 2]);
				const ay = this.#toRow(points[i * 2 + 1]);
				const bx = this.#toCol(points[((i + 1) % n) * 2]);
				const by = this.#toRow(points[((i + 1) % n) * 2 + 1]);
				if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
					xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
				}
			}
			xs.sort((p, q) => p - q);
			for (let k = 0; k + 1 < xs.length; k += 2) {
				// Half-open span [xs[k], xs[k+1]) → inclusive cells [floor, ceil-1] (matches #fillRect).
				const c0 = Math.max(0, Math.floor(xs[k]));
				const c1 = Math.min(this.#cols - 1, Math.ceil(xs[k + 1]) - 1);
				for (let c = c0; c <= c1; c++) this.#blend(c, r, lum, a);
			}
		}
	}
}

/** Sample a piecewise-linear gradient (by `at`) at `t`, returning the blended {@link Color}. */
function sampleStops(stops: GradientStop[], t: number): Color {
	if (stops.length === 0) return { r: 0, g: 0, b: 0, a: 0 };
	if (t <= stops[0].at) return stops[0].color;
	const lastStop = stops[stops.length - 1];
	if (t >= lastStop.at) return lastStop.color;
	for (let i = 0; i + 1 < stops.length; i++) {
		const a = stops[i];
		const b = stops[i + 1];
		if (t >= a.at && t <= b.at) {
			const k = (t - a.at) / Math.max(1e-6, b.at - a.at);
			return {
				r: a.color.r + (b.color.r - a.color.r) * k,
				g: a.color.g + (b.color.g - a.color.g) * k,
				b: a.color.b + (b.color.b - a.color.b) * k,
				a: a.color.a + (b.color.a - a.color.a) * k,
			};
		}
	}
	return lastStop.color;
}
