/**
 * The mood engine — one slow clock that resolves the whole palette + season into the colours of
 * the current frame.
 *
 * This is the naturescape's unifier, the direct analogue of the cityscape's mood: rather than
 * fading the sky, hills, water and foliage independently, a single day cycle drives them together.
 * A cyclic `phase` breathes the active {@link Palette} between its warm (golden-hour) and cool
 * (midday) ends, raises and lowers the sun along an arc, and brightens/dims the daylight — while a
 * second, much slower season clock blends the {@link Season} land colours. Everything visible
 * derives from the resulting {@link Mood} snapshot, so the day is inherently coherent. It stays
 * **light** at all times (the dawn/dusk floor never reaches night) — this is a day scene.
 *
 * Pure and DOM-free: `update()` is fed a time; it does not read a clock.
 *
 * @module
 */

import {
	type Color,
	darken,
	fromHex,
	mix,
	rgb,
	withAlpha,
} from "../engine/math/color.ts";
import type { GradientStop } from "../engine/render/draw-command.ts";
import { clamp, cosinePulse, lerp } from "../engine/math/ease.ts";
import { createNoise1D, type Noise1D } from "../engine/math/noise.ts";
import { getPalette, type MoodColors, type Palette } from "./palette.ts";
import { getSeason, SEASON_NAMES, type SeasonColors, SEASONS } from "./season.ts";
import type { NatureConfig } from "./config.ts";

/** A fully-resolved set of colours + light parameters for one instant. */
export interface Mood {
	/** Cyclic day phase `0..1` (0 = dawn, 0.5 = midday, 1 = dusk). */
	phase: number;
	/** Warmth `0..1` (1 = warm/golden end of the palette). */
	warmth: number;
	/** Daylight brightness `0..1` (peaks at midday; never reaches 0). */
	daylight: number;
	/** Sun horizontal position across the sky `0..1` (0 = east, 1 = west). */
	sunX: number;
	/** Sun height `0..1` (0 = on the horizon at dawn/dusk, 1 = high at noon). */
	sunHeight: number;
	/** Blend between the two active seasons `0..1` (for debugging / phase-linked effects). */
	seasonT: number;
	/** Resolved snow lying on peaks/roofs/ground `0..1`. */
	snow: number;
	/** Sky gradient, top → horizon. */
	sky: GradientStop[];
	/** Warm light pooling along the horizon. */
	sunGlow: Color;
	/** The sun disc. */
	sun: Color;
	/** Silhouette colour of the farthest mountains/hills (depth 0). */
	landFar: Color;
	/** Body colour of the nearest hills (depth 1). */
	landNear: Color;
	/** Atmospheric haze colour distant land fades toward (≈ sky near the horizon). */
	haze: Color;
	/** Calm water tone. */
	water: Color;
	/** Lit side of foliage. */
	foliage: Color;
	/** Shaded side of foliage. */
	foliageDeep: Color;
	/** Tree trunks / bare branches. */
	trunk: Color;
	/** Near grass / meadow. */
	ground: Color;
	/** Distant rolling-hill grass. */
	groundFar: Color;
	/** Blossom / wildflower / turning-leaf accent. */
	bloom: Color;
	/** Resolved snow tint (near-white, faintly warmed by the sun). */
	snowColor: Color;
}

/** Parsed (hex → {@link Color}) form of a {@link MoodColors}. */
type LightSet = { [K in keyof MoodColors]: Color };
/** Parsed (hex → {@link Color}) form of a season's land colours (snow stays numeric). */
type LandSet = { [K in Exclude<keyof SeasonColors, "snow">]: Color } & { snow: number };

function parseLight(c: MoodColors): LightSet {
	return {
		skyTop: fromHex(c.skyTop),
		skyMid: fromHex(c.skyMid),
		skyBottom: fromHex(c.skyBottom),
		sunGlow: fromHex(c.sunGlow),
		sun: fromHex(c.sun),
		landFar: fromHex(c.landFar),
		landNear: fromHex(c.landNear),
		water: fromHex(c.water),
		haze: fromHex(c.haze),
	};
}

function parseLand(c: SeasonColors): LandSet {
	return {
		foliage: fromHex(c.foliage),
		foliageDeep: fromHex(c.foliageDeep),
		trunk: fromHex(c.trunk),
		ground: fromHex(c.ground),
		groundFar: fromHex(c.groundFar),
		bloom: fromHex(c.bloom),
		snow: c.snow,
	};
}

const SNOW_BASE = rgb(244, 248, 252);

/**
 * Phase offset so a fresh load (time 0) opens on a bright late morning rather than the dim dawn at
 * phase 0 — a friendlier first impression. The full day still breathes through dawn↔midday↕dusk.
 */
const START_PHASE = 0.28;

/**
 * Resolves the active {@link Palette} + {@link Season} into a {@link Mood} for any given time.
 * Reused in place (the `mood` snapshot is mutated each `update`) to avoid per-frame allocation.
 */
export class MoodEngine {
	/** The current resolved snapshot (read by the whole scene). */
	readonly mood: Mood;

	#palette: Palette;
	#warm: LightSet;
	#cool: LightSet;
	#seasons: Record<string, LandSet>;
	#noise: Noise1D;

	constructor(config: NatureConfig, seed: number) {
		this.#palette = getPalette(config.palette);
		this.#warm = parseLight(this.#palette.warm);
		this.#cool = parseLight(this.#palette.cool);
		// All four seasons parsed once; the two active ones are blended each tick.
		this.#seasons = {};
		for (const name of SEASON_NAMES) {
			this.#seasons[name] = parseLand(SEASONS[name].colors);
		}
		this.#noise = createNoise1D((seed ^ 0x5ea50f) >>> 0, 2);

		const land = this.#seasons[getSeason(config.season).name] ?? this.#seasons.summer;
		this.mood = {
			phase: 0.5,
			warmth: 0.4,
			daylight: config.brightness,
			sunX: 0.5,
			sunHeight: 1,
			seasonT: 0,
			snow: land.snow,
			sky: [
				{ at: 0, color: this.#cool.skyTop },
				{ at: 0.55, color: this.#cool.skyMid },
				{ at: 1, color: this.#cool.skyBottom },
			],
			sunGlow: this.#cool.sunGlow,
			sun: this.#cool.sun,
			landFar: this.#cool.landFar,
			landNear: this.#cool.landNear,
			haze: this.#cool.haze,
			water: this.#cool.water,
			foliage: land.foliage,
			foliageDeep: land.foliageDeep,
			trunk: land.trunk,
			ground: land.ground,
			groundFar: land.groundFar,
			bloom: land.bloom,
			snowColor: SNOW_BASE,
		};
		this.update(0, config);
	}

	/** Switch palette (live, from the panel) without losing phase. */
	setPalette(name: string): void {
		this.#palette = getPalette(name);
		this.#warm = parseLight(this.#palette.warm);
		this.#cool = parseLight(this.#palette.cool);
	}

	/** Resolve the mood for `timeMs`, writing into {@link MoodEngine.mood}. */
	update(timeMs: number, config: NatureConfig): void {
		const cycleMs = Math.max(1, config.dayCycleSeconds * 1000);
		const phase = (timeMs / cycleMs + START_PHASE) % 1;

		// `breath` peaks at midday (phase 0.5) and bottoms at dawn/dusk (phase 0,1).
		const breath = cosinePulse(phase);
		const wander = (this.#noise.at(phase * 0.5 + timeMs / cycleMs * 0.13) - 0.5) *
			0.12;
		// Warmth: golden at the ends, cool at noon, biased by the warmth knob.
		const warmth = clamp(
			0.5 + (0.5 - breath) * 0.82 + (config.warmth - 0.5) * 0.9 + wander,
			0,
			1,
		);
		// Daylight: bright at noon, gently dimmed (never dark) at the golden ends.
		const daylight = clamp(config.brightness * (0.72 + 0.28 * breath), 0.2, 1);
		const shade = (1 - daylight) * 0.32;

		// Sun arc: crosses east → west over the day, riding high at noon.
		const sunX = phase;
		const sunHeight = clamp(Math.sin(phase * Math.PI), 0, 1);

		// Season blend: a much slower clock when cycling, else the fixed selection.
		const { land, seasonT } = this.#resolveSeason(timeMs, config);

		const t = 1 - warmth; // 0 = warm end, 1 = cool end
		const w = this.#warm;
		const c = this.#cool;
		const blendLight = (k: keyof LightSet): Color => mix(w[k], c[k], t);

		const skyTop = darken(blendLight("skyTop"), shade);
		const skyMid = darken(blendLight("skyMid"), shade * 0.8);
		const skyBottom = darken(blendLight("skyBottom"), shade * 0.5);

		const m = this.mood;
		m.phase = phase;
		m.warmth = warmth;
		m.daylight = daylight;
		m.sunX = sunX;
		m.sunHeight = sunHeight;
		m.seasonT = seasonT;
		m.snow = clamp(land.snow, 0, 1);
		m.sky[0].color = skyTop;
		m.sky[1].color = skyMid;
		m.sky[2].color = skyBottom;
		m.sunGlow = blendLight("sunGlow");
		m.sun = blendLight("sun");
		m.haze = darken(blendLight("haze"), shade * 0.5);
		m.landFar = darken(blendLight("landFar"), shade * 0.6);
		m.landNear = darken(blendLight("landNear"), shade * 0.7);
		m.water = darken(blendLight("water"), shade * 0.6);
		m.foliage = darken(land.foliage, shade * 0.7);
		m.foliageDeep = darken(land.foliageDeep, shade * 0.7);
		m.trunk = darken(land.trunk, shade * 0.5);
		m.ground = darken(land.ground, shade * 0.6);
		m.groundFar = darken(land.groundFar, shade * 0.5);
		m.bloom = land.bloom;
		m.snowColor = mix(SNOW_BASE, m.sunGlow, 0.14 * warmth);
	}

	/** Resolve the two active seasons + blend factor, then mix their land colours. */
	#resolveSeason(
		timeMs: number,
		config: NatureConfig,
	): { land: LandSet; seasonT: number } {
		const base = Math.max(0, SEASON_NAMES.indexOf(config.season));
		if (!config.seasonCycle) {
			return { land: this.#seasons[SEASON_NAMES[base]], seasonT: 0 };
		}
		const yearMs = Math.max(1, config.seasonCycleSeconds * 1000);
		const pos = base + (timeMs / yearMs);
		const idx = Math.floor(pos) % SEASON_NAMES.length;
		const seasonT = pos - Math.floor(pos);
		const a = this.#seasons[SEASON_NAMES[idx]];
		const b = this.#seasons[SEASON_NAMES[(idx + 1) % SEASON_NAMES.length]];
		return { land: blendLand(a, b, seasonT), seasonT };
	}
}

/** Mix two parsed season colour sets by `t`. */
function blendLand(a: LandSet, b: LandSet, t: number): LandSet {
	return {
		foliage: mix(a.foliage, b.foliage, t),
		foliageDeep: mix(a.foliageDeep, b.foliageDeep, t),
		trunk: mix(a.trunk, b.trunk, t),
		ground: mix(a.ground, b.ground, t),
		groundFar: mix(a.groundFar, b.groundFar, t),
		bloom: mix(a.bloom, b.bloom, t),
		snow: lerp(a.snow, b.snow, t),
	};
}

/**
 * The silhouette colour of a hill/mountain at `depth`, blending near↔far and hazing distant land
 * toward the sky (atmospheric perspective). `0` = far, `1` = near.
 */
export function landColor(mood: Mood, depth: number): Color {
	const base = mix(mood.landFar, mood.landNear, depth);
	const haze = (1 - depth) * 0.6;
	return mix(base, mood.haze, haze);
}

/** Foliage colour at `depth`, hazed toward the sky on far bands. `lit` picks the lit vs shaded side. */
export function foliageColor(mood: Mood, depth: number, lit = true): Color {
	const base = lit ? mood.foliage : mood.foliageDeep;
	const haze = (1 - depth) * 0.5;
	return mix(base, mood.haze, haze);
}

/** A snow tint at `depth`, hazed toward the sky on far bands (for distant peaks). */
export function snowAt(mood: Mood, depth: number): Color {
	return mix(mood.snowColor, mood.haze, (1 - depth) * 0.45);
}

/** A semi-transparent water-surface highlight derived from the sun glow. */
export function sheen(mood: Mood, alpha: number): Color {
	return withAlpha(mix(mood.sunGlow, mood.snowColor, 0.3), alpha);
}
