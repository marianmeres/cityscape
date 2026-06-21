/**
 * The renderer-agnostic drawing vocabulary — the heart of the architecture.
 *
 * The simulation never talks to a canvas. Instead, every entity describes *what* to draw as a
 * list of {@link DrawCommand}s (screen-space primitives), and a {@link Renderer} decides *how* to
 * realise them on its target. Swapping Canvas2D → ASCII → DOM is swapping the consumer of this
 * same list. Keeping this union small and purely declarative is what makes the seam real.
 *
 * Coordinates are **screen-space**, already projected by the {@link Camera}; renderers do no
 * world math. Commands are appended in paint order (painter's algorithm: far → near).
 *
 * @module
 */

import type { Color } from "../math/color.ts";

/** A gradient color stop; `at` is `0..1` along the gradient axis. */
export interface GradientStop {
	at: number;
	color: Color;
}

/** An axis-aligned filled rectangle. */
export interface RectCommand {
	kind: "rect";
	x: number;
	y: number;
	w: number;
	h: number;
	color: Color;
	/**
	 * Optional corner radius in screen pixels (each corner clamped to half the shorter side by the
	 * rasteriser). A single number rounds all four corners uniformly; a `[tl, tr, br, bl]` tuple
	 * rounds each corner independently — used to round only a shape's exterior silhouette while
	 * leaving the corners shared with a neighbour square. Omitted/0 = sharp. Raster renderers round
	 * the corners; text-only renderers (ASCII) ignore it — they have no sub-cell geometry to round.
	 */
	radius?: number | [number, number, number, number];
}

/** A filled polygon; `points` is a flat `[x0,y0,x1,y1,...]` array (screen-space). */
export interface PolygonCommand {
	kind: "polygon";
	points: number[];
	color: Color;
}

/** A filled circle. */
export interface CircleCommand {
	kind: "circle";
	x: number;
	y: number;
	r: number;
	color: Color;
}

/** A linear gradient fill over a rect (vertical by default, else horizontal). */
export interface GradientCommand {
	kind: "gradient";
	x: number;
	y: number;
	w: number;
	h: number;
	stops: GradientStop[];
	vertical: boolean;
}

/** A stroked line segment. */
export interface LineCommand {
	kind: "line";
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	width: number;
	color: Color;
}

/**
 * A soft radial light (window glow, moon halo, light pollution). `intensity` 0..1 scales the
 * brightness; renderers that cannot do soft falloff (ASCII) may approximate or ignore it.
 */
export interface GlowCommand {
	kind: "glow";
	x: number;
	y: number;
	r: number;
	color: Color;
	intensity: number;
}

/** A run of text (mainly meaningful to text-targeting renderers like ASCII). */
export interface TextCommand {
	kind: "text";
	x: number;
	y: number;
	text: string;
	size: number;
	color: Color;
}

/** The closed set of primitives a renderer must understand. */
export type DrawCommand =
	| RectCommand
	| PolygonCommand
	| CircleCommand
	| GradientCommand
	| LineCommand
	| GlowCommand
	| TextCommand;

/**
 * A frame's worth of draw commands plus the target dimensions they were laid out for. This is
 * the single value handed across the renderer seam each frame.
 */
export interface DisplayList {
	width: number;
	height: number;
	/**
	 * A whole-frame vertical translation in pixels (the camera's vertical movement). Renderers
	 * shift the painted frame by this amount; command coordinates themselves are unshifted.
	 */
	offsetY: number;
	commands: DrawCommand[];
}

/**
 * A thin append-only builder over a {@link DisplayList}. Entities receive one of these in their
 * `draw()` and push primitives; it keeps call sites terse and the union construction in one place.
 */
export class DisplayListBuilder implements DisplayList {
	width: number;
	height: number;
	offsetY = 0;
	readonly commands: DrawCommand[] = [];

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
	}

	/** Reset for reuse across frames (avoids per-frame allocation of the list itself). */
	reset(width: number, height: number): this {
		this.width = width;
		this.height = height;
		this.offsetY = 0;
		this.commands.length = 0;
		return this;
	}

	/** Append a fully-formed command (escape hatch). */
	push(cmd: DrawCommand): this {
		this.commands.push(cmd);
		return this;
	}

	rect(
		x: number,
		y: number,
		w: number,
		h: number,
		color: Color,
		radius?: number | [number, number, number, number],
	): this {
		this.commands.push({ kind: "rect", x, y, w, h, color, radius });
		return this;
	}

	polygon(points: number[], color: Color): this {
		this.commands.push({ kind: "polygon", points, color });
		return this;
	}

	circle(x: number, y: number, r: number, color: Color): this {
		this.commands.push({ kind: "circle", x, y, r, color });
		return this;
	}

	gradient(
		x: number,
		y: number,
		w: number,
		h: number,
		stops: GradientStop[],
		vertical = true,
	): this {
		this.commands.push({ kind: "gradient", x, y, w, h, stops, vertical });
		return this;
	}

	line(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		width: number,
		color: Color,
	): this {
		this.commands.push({ kind: "line", x1, y1, x2, y2, width, color });
		return this;
	}

	glow(x: number, y: number, r: number, color: Color, intensity = 1): this {
		this.commands.push({ kind: "glow", x, y, r, color, intensity });
		return this;
	}

	text(x: number, y: number, text: string, size: number, color: Color): this {
		this.commands.push({ kind: "text", x, y, text, size, color });
		return this;
	}
}
