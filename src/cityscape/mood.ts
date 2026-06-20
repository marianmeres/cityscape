/**
 * The mood engine — one slow phase clock that resolves the entire palette into the colours of
 * the current frame.
 *
 * This is the unifier called out in the spec: rather than fading sky, buildings, and windows
 * independently, a single cyclic `warmth` (a calm cosine breath, lightly perturbed by noise)
 * interpolates the active {@link Palette}'s warm and cool ends, and a second slow oscillation
 * breathes the overall `darkness`. Everything visible derives from the resulting {@link Mood}
 * snapshot — so the transitions are inherently coherent.
 *
 * Pure and DOM-free: `update()` is fed a time; it does not read a clock.
 *
 * @module
 */

import { type Color, darken, fromHex, mix, withAlpha } from "../engine/math/color.ts";
import type { GradientStop } from "../engine/render/draw-command.ts";
import { clamp, cosinePulse } from "../engine/math/ease.ts";
import { createNoise1D, type Noise1D } from "../engine/math/noise.ts";
import { getPalette, type MoodColors, type Palette } from "./palette.ts";
import type { CityscapeConfig } from "./config.ts";

/** A fully-resolved set of colours for one instant. */
export interface Mood {
	/** Cyclic phase `0..1` (for subtle phase-linked effects / debugging). */
	phase: number;
	/** Warmth `0..1` (1 = warm end of the palette). */
	warmth: number;
	/** Resolved overall darkness `0..1`. */
	darkness: number;
	/** Sky gradient, top → horizon. */
	sky: GradientStop[];
	/** Glow band sitting at the base of the skyline (light pollution). */
	horizonGlow: Color;
	/** Silhouette colour of the farthest buildings (depth 0). */
	buildingFar: Color;
	/** Silhouette colour of the nearest buildings (depth 1). */
	buildingNear: Color;
	/** Colour the far buildings haze toward (≈ sky near the horizon). */
	haze: Color;
	/** Lit-window colour. */
	window: Color;
	/** Window glow colour (semi-transparent). */
	windowGlow: Color;
	/** Moon disc colour. */
	moon: Color;
	/** Star colour. */
	star: Color;
}

/** Parsed (hex → {@link Color}) form of a {@link MoodColors}. */
type ColorSet = { [K in keyof MoodColors]: Color };

function parse(c: MoodColors): ColorSet {
	return {
		skyTop: fromHex(c.skyTop),
		skyMid: fromHex(c.skyMid),
		skyBottom: fromHex(c.skyBottom),
		horizonGlow: fromHex(c.horizonGlow),
		buildingFar: fromHex(c.buildingFar),
		buildingNear: fromHex(c.buildingNear),
		window: fromHex(c.window),
		moon: fromHex(c.moon),
		star: fromHex(c.star),
	};
}

/**
 * Resolves the active {@link Palette} into a {@link Mood} for any given time. Reused in place
 * (the `mood` snapshot is mutated each `update`) to avoid per-frame allocation.
 */
export class MoodEngine {
	/** The current resolved snapshot (read by the whole scene). */
	readonly mood: Mood;

	#palette: Palette;
	#warm: ColorSet;
	#cool: ColorSet;
	#noise: Noise1D;

	constructor(config: CityscapeConfig, seed: number) {
		this.#palette = getPalette(config.palette);
		this.#warm = parse(this.#palette.warm);
		this.#cool = parse(this.#palette.cool);
		this.#noise = createNoise1D(seed ^ 0x6d0a17, 2);
		this.mood = {
			phase: 0,
			warmth: 1,
			darkness: config.darkness,
			sky: [
				{ at: 0, color: this.#warm.skyTop },
				{ at: 0.6, color: this.#warm.skyMid },
				{ at: 1, color: this.#warm.skyBottom },
			],
			horizonGlow: this.#warm.horizonGlow,
			buildingFar: this.#warm.buildingFar,
			buildingNear: this.#warm.buildingNear,
			haze: this.#warm.skyMid,
			window: this.#warm.window,
			windowGlow: withAlpha(this.#warm.window, 0.5),
			moon: this.#warm.moon,
			star: this.#warm.star,
		};
		this.update(0, config);
	}

	/** Switch palette (live, from the panel) without losing phase. */
	setPalette(name: string): void {
		this.#palette = getPalette(name);
		this.#warm = parse(this.#palette.warm);
		this.#cool = parse(this.#palette.cool);
	}

	/** Resolve the mood for `timeMs`, writing into {@link MoodEngine.mood}. */
	update(timeMs: number, config: CityscapeConfig): void {
		const cycleMs = Math.max(1, config.moodCycleSeconds * 1000);
		const cyclePos = timeMs / cycleMs;

		// Calm warm→cool→warm breath, lightly perturbed so it never feels mechanical.
		const breath = cosinePulse(cyclePos);
		const wander = (this.#noise.at(cyclePos * 0.5) - 0.5) * 0.18;
		// `t` is the warm→cool interpolation factor, biased by the temperature knob.
		const t = clamp(
			0.5 + (breath - 0.5) * 0.74 + (config.colorTemperature - 0.5) * 0.8 + wander,
			0,
			1,
		);
		const warmth = 1 - t;

		// A second, slower breath modulates overall darkness ("darker, slightly less dark").
		const darkBreath = cosinePulse(cyclePos * 0.5 + 0.3) - 0.5;
		const darkness = clamp(config.darkness + darkBreath * 0.12, 0, 0.95);

		const m = this.mood;
		const w = this.#warm;
		const c = this.#cool;
		const blend = (k: keyof ColorSet): Color => mix(w[k], c[k], t);

		const skyTop = darken(blend("skyTop"), darkness * 0.55);
		const skyMid = darken(blend("skyMid"), darkness * 0.5);
		const skyBottom = darken(blend("skyBottom"), darkness * 0.42);

		m.phase = cyclePos % 1;
		m.warmth = warmth;
		m.darkness = darkness;
		m.sky[0].color = skyTop;
		m.sky[1].color = skyMid;
		m.sky[2].color = skyBottom;
		m.horizonGlow = darken(blend("horizonGlow"), darkness * 0.35);
		m.buildingFar = darken(blend("buildingFar"), darkness * 0.5);
		m.buildingNear = darken(blend("buildingNear"), darkness * 0.55);
		m.haze = skyMid;
		m.window = blend("window");
		m.windowGlow = withAlpha(m.window, 0.5);
		m.moon = darken(blend("moon"), darkness * 0.2);
		m.star = blend("star");
	}
}

/**
 * The silhouette colour for a building at `depth`, blending near↔far and hazing distant
 * buildings toward the sky (atmospheric perspective). `0` = far, `1` = near.
 */
export function silhouetteColor(mood: Mood, depth: number): Color {
	const base = mix(mood.buildingFar, mood.buildingNear, depth);
	// Far layers fade toward the haze colour; near layers stay crisp.
	const haze = (1 - depth) * 0.55;
	return mix(base, mood.haze, haze);
}
