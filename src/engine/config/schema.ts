/**
 * A tiny, generic, schema-driven configuration toolkit — the part of the config system that is
 * domain-agnostic and therefore lives in the engine.
 *
 * A domain (cityscape, naturescape, …) declares a `CONFIG_SCHEMA` — an array of typed field
 * descriptors with ranges, options and grouping — and a matching config interface. From that one
 * source this module derives the defaults ({@link buildDefaults}) and coerces arbitrary input back
 * onto a valid config ({@link normalizeConfig}), while the schema-driven control panel renders the
 * controls. Adding a knob is a one-line schema edit in the domain; nothing here changes.
 *
 * Pure and DOM-free.
 *
 * @module
 */

/** Shared fields of every config field descriptor. `group` is a free-form panel section label. */
export interface FieldBase {
	key: string;
	label: string;
	group: string;
	help?: string;
}

/** A numeric slider. */
export interface RangeField extends FieldBase {
	type: "range";
	min: number;
	max: number;
	step: number;
	default: number;
	unit?: string;
}

/** A single-choice dropdown. */
export interface SelectField extends FieldBase {
	type: "select";
	options: { value: string; label: string }[];
	default: string;
}

/** A boolean switch. */
export interface ToggleField extends FieldBase {
	type: "toggle";
	default: boolean;
}

/** A free-text seed (string; empty means "randomise at load"). */
export interface SeedField extends FieldBase {
	type: "seed";
	default: string;
}

/** Any config field descriptor. */
export type ConfigField = RangeField | SelectField | ToggleField | SeedField;

/** Build a fully-resolved config object from a schema's `default`s. */
export function buildDefaults<C>(schema: readonly ConfigField[]): C {
	const out: Record<string, unknown> = {};
	for (const f of schema) out[f.key] = f.default;
	return out as C;
}

/**
 * Coerce and clamp arbitrary input onto a valid config, field by field, against `schema`. Unknown
 * keys are dropped; out-of-range numbers clamp; invalid selects fall back to their default;
 * anything missing inherits the schema default.
 */
export function normalizeConfig<C>(schema: readonly ConfigField[], input: unknown): C {
	const src = (input && typeof input === "object" ? input : {}) as Record<
		string,
		unknown
	>;
	const out: Record<string, unknown> = {};
	for (const f of schema) out[f.key] = normalizeField(f, src[f.key]);
	return out as C;
}

function normalizeField(f: ConfigField, raw: unknown): unknown {
	switch (f.type) {
		case "range": {
			const n = typeof raw === "number" ? raw : Number(raw);
			if (!Number.isFinite(n)) return f.default;
			return Math.min(f.max, Math.max(f.min, n));
		}
		case "select": {
			const s = String(raw);
			return f.options.some((o) => o.value === s) ? s : f.default;
		}
		case "toggle":
			return typeof raw === "boolean"
				? raw
				: raw === "true" || raw === 1
				? true
				: raw === undefined
				? f.default
				: Boolean(raw);
		case "seed":
			return raw == null ? f.default : String(raw);
	}
}

/** The distinct group labels in a schema, in first-seen order (the panel's section order). */
export function deriveGroups(schema: readonly ConfigField[]): string[] {
	const seen: string[] = [];
	for (const f of schema) if (!seen.includes(f.group)) seen.push(f.group);
	return seen;
}
