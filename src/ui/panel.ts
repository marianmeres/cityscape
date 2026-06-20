/**
 * The floating control panel — generated from the config schema.
 *
 * Built with **@marianmeres/vanilla**'s reactive core (`observable`/`reactTo`) for state and
 * styled with **@marianmeres/design-tokens** custom properties (with dark fallbacks so it works
 * standalone). Because the controls are derived from {@link CONFIG_SCHEMA}, adding a knob needs no
 * panel code. The panel builds its DOM with `document.createElement` rather than a `<template>` —
 * a schema-driven, variable-length control list doesn't fit a static template — and never uses
 * `innerHTML`, honouring vanilla's "no markup from strings" rule.
 *
 * @module
 */

import { observable, reactTo, type Unsubscribe } from "@marianmeres/vanilla";
import {
	type CityscapeConfig,
	CONFIG_SCHEMA,
	type ConfigField,
	type FieldGroup,
	GROUP_ORDER,
} from "../cityscape/config.ts";

/** Options for {@link createControlPanel}. */
export interface ControlPanelOptions {
	/** Current configuration to reflect. */
	config: CityscapeConfig;
	/** Called with a partial patch whenever the user changes a control. */
	onChange: (patch: Partial<CityscapeConfig>) => void;
	/** Schema to render (defaults to the full {@link CONFIG_SCHEMA}). */
	schema?: ConfigField[];
	/** Panel title. */
	title?: string;
	/** Start collapsed. */
	collapsed?: boolean;
	/** Optional "copy link" handler (the runtime supplies a permalink writer). */
	onShare?: () => void;
}

/** A live control panel. */
export interface ControlPanel {
	/** The panel root element (append it to the page). */
	readonly el: HTMLElement;
	/** Reflect an externally-changed config (e.g. wheel-scrub, permalink load) into the controls. */
	set(config: CityscapeConfig): void;
	/** Collapse/expand the body. Pass `true` to force-collapse, `false` to expand, omit to flip. */
	toggle(collapse?: boolean): void;
	/** Remove listeners + DOM. */
	destroy(): void;
}

const STYLE_ID = "cityscape-panel-style";

/** Build the floating control panel. */
export function createControlPanel(opts: ControlPanelOptions): ControlPanel {
	ensureStyles();
	const schema = opts.schema ?? CONFIG_SCHEMA;
	const unsubs: Unsubscribe[] = [];
	const setters = new Map<string, (v: unknown) => void>();

	// Reactive collapsed state — a small but real use of vanilla's core.
	const collapsed = observable(opts.collapsed ?? false);

	const root = el("div", "cityscape-panel");
	const header = el("div", "csp-header");
	const heading = el("div", "csp-title");
	heading.textContent = opts.title ?? "Cityscape";
	const spacer = el("div", "csp-spacer");

	const shuffleBtn = button("⟳", "Shuffle seed", () => {
		const seed = randomSeed();
		setters.get("seed")?.(seed);
		opts.onChange({ seed });
	});
	const shareBtn = opts.onShare
		? button("🔗", "Copy link", () => opts.onShare!())
		: null;
	const collapseBtn = button("▾", "Collapse", () => collapsed.update((c) => !c));

	header.append(heading, spacer, shuffleBtn);
	if (shareBtn) header.append(shareBtn);
	header.append(collapseBtn);

	const body = el("div", "csp-body");

	// Group fields in declared group order.
	const groups = opts.schema ? deriveGroups(schema) : GROUP_ORDER;
	for (const group of groups) {
		const fields = schema.filter((f) => f.group === group);
		if (fields.length === 0) continue;
		const section = el("div", "csp-group");
		const gh = el("div", "csp-group-title");
		gh.textContent = group;
		section.append(gh);
		for (const f of fields) {
			section.append(buildField(f, opts.config, opts.onChange, setters));
		}
		body.append(section);
	}

	root.append(header, body);

	// Wire collapse reactively.
	unsubs.push(
		reactTo([collapsed], () => {
			const c = collapsed.get();
			root.classList.toggle("csp-collapsed", c);
			collapseBtn.textContent = c ? "▸" : "▾";
			collapseBtn.title = c ? "Expand" : "Collapse";
		}),
	);

	return {
		el: root,
		set(config) {
			for (const f of schema) {
				setters.get(f.key)?.(config[f.key as keyof CityscapeConfig]);
			}
		},
		toggle(collapse) {
			collapsed.set(typeof collapse === "boolean" ? collapse : !collapsed.get());
		},
		destroy() {
			for (const u of unsubs) u();
			root.remove();
		},
	};
}

/* -------------------------------------------------------------------------- *
 * Field builders
 * -------------------------------------------------------------------------- */

function buildField(
	f: ConfigField,
	config: CityscapeConfig,
	onChange: (patch: Partial<CityscapeConfig>) => void,
	setters: Map<string, (v: unknown) => void>,
): HTMLElement {
	const row = el("label", "csp-field");
	row.title = f.help ?? "";
	const labelRow = el("div", "csp-label");
	const name = el("span", "csp-name");
	name.textContent = f.label;
	const value = el("span", "csp-value");
	labelRow.append(name, value);

	const current = config[f.key as keyof CityscapeConfig];
	let control: HTMLElement;

	switch (f.type) {
		case "range": {
			const input = document.createElement("input");
			input.type = "range";
			input.min = String(f.min);
			input.max = String(f.max);
			input.step = String(f.step);
			input.value = String(current);
			value.textContent = fmt(Number(current), f.unit);
			input.addEventListener("input", () => {
				const v = Number(input.value);
				value.textContent = fmt(v, f.unit);
				onChange({ [f.key]: v } as Partial<CityscapeConfig>);
			});
			setters.set(f.key, (v) => {
				input.value = String(v);
				value.textContent = fmt(Number(v), f.unit);
			});
			control = input;
			break;
		}
		case "select": {
			const sel = document.createElement("select");
			for (const o of f.options) {
				const opt = document.createElement("option");
				opt.value = o.value;
				opt.textContent = o.label;
				sel.append(opt);
			}
			sel.value = String(current);
			sel.addEventListener(
				"change",
				() => onChange({ [f.key]: sel.value } as Partial<CityscapeConfig>),
			);
			setters.set(f.key, (v) => (sel.value = String(v)));
			control = sel;
			break;
		}
		case "toggle": {
			const input = document.createElement("input");
			input.type = "checkbox";
			input.className = "csp-toggle";
			input.checked = Boolean(current);
			input.addEventListener(
				"change",
				() => onChange({ [f.key]: input.checked } as Partial<CityscapeConfig>),
			);
			setters.set(f.key, (v) => (input.checked = Boolean(v)));
			control = input;
			break;
		}
		case "seed": {
			const input = document.createElement("input");
			input.type = "text";
			input.className = "csp-seed";
			input.value = String(current);
			input.spellcheck = false;
			input.addEventListener(
				"change",
				() => onChange({ [f.key]: input.value } as Partial<CityscapeConfig>),
			);
			setters.set(f.key, (v) => (input.value = String(v)));
			control = input;
			break;
		}
	}

	row.append(labelRow, control);
	return row;
}

/* -------------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------------- */

function el(tag: string, className: string): HTMLElement {
	const e = document.createElement(tag);
	e.className = className;
	return e;
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
	const b = document.createElement("button");
	b.type = "button";
	b.className = "csp-btn";
	b.textContent = label;
	b.title = title;
	b.addEventListener("click", onClick);
	return b;
}

function fmt(v: number, unit?: string): string {
	const n = Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : Math.round(v * 100) / 100;
	return unit ? `${n}${unit}` : String(n);
}

function randomSeed(): string {
	return Math.random().toString(36).slice(2, 9);
}

function deriveGroups(schema: ConfigField[]): FieldGroup[] {
	const seen: FieldGroup[] = [];
	for (const f of schema) if (!seen.includes(f.group)) seen.push(f.group);
	return seen;
}

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = PANEL_CSS;
	document.head.append(style);
}

const PANEL_CSS = `
.cityscape-panel, .cityscape-panel * { box-sizing: border-box; }
.cityscape-panel {
	position: fixed;
	top: 16px;
	right: 16px;
	z-index: 10;
	width: 248px;
	max-height: calc(100vh - 32px);
	display: flex;
	flex-direction: column;
	font: 12px/1.4 ui-sans-serif, system-ui, sans-serif;
	color: var(--app-color-foreground, #dbe4ff);
	background: var(--app-color-surface, rgba(14, 20, 38, 0.82));
	border: 1px solid var(--app-color-border, rgba(120, 140, 200, 0.22));
	border-radius: 12px;
	backdrop-filter: blur(10px);
	box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
	overflow: hidden;
	user-select: none;
}
.csp-header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 10px 12px;
	border-bottom: 1px solid var(--app-color-border, rgba(120, 140, 200, 0.18));
}
.csp-title { font-weight: 600; letter-spacing: 0.02em; }
.csp-spacer { flex: 1; }
.csp-btn {
	width: 26px; height: 26px;
	display: inline-flex; align-items: center; justify-content: center;
	border: 1px solid var(--app-color-border, rgba(120, 140, 200, 0.22));
	border-radius: 7px;
	background: var(--app-color-muted, rgba(255, 255, 255, 0.05));
	color: inherit; cursor: pointer; font-size: 13px; line-height: 1;
}
.csp-btn:hover { background: var(--app-color-muted-hover, rgba(255, 255, 255, 0.12)); }
.csp-body {
	padding: 10px 12px 14px;
	overflow-y: auto;
	overflow-x: hidden;
	display: flex; flex-direction: column; gap: 14px;
}
.cityscape-panel.csp-collapsed .csp-body { display: none; }
.csp-group { display: flex; flex-direction: column; gap: 8px; }
.csp-group-title {
	font-size: 10px; text-transform: uppercase; letter-spacing: 0.09em;
	color: var(--app-color-muted-foreground, #8a96c0);
}
.csp-field { display: flex; flex-direction: column; gap: 4px; cursor: default; }
.csp-label { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.csp-name { color: var(--app-color-foreground, #cfd8f5); }
.csp-value {
	font-variant-numeric: tabular-nums;
	color: var(--app-color-muted-foreground, #8a96c0); font-size: 11px;
}
.csp-field input[type="range"] {
	width: 100%; height: 4px; appearance: none; -webkit-appearance: none;
	background: var(--app-color-border, rgba(120, 140, 200, 0.25));
	border-radius: 99px; outline: none; cursor: pointer;
}
.csp-field input[type="range"]::-webkit-slider-thumb {
	appearance: none; -webkit-appearance: none; width: 13px; height: 13px;
	border-radius: 50%; background: var(--app-color-primary, #7aa2ff); cursor: pointer;
	box-shadow: 0 0 0 3px var(--app-color-primary-soft, rgba(122, 162, 255, 0.2));
}
.csp-field input[type="range"]::-moz-range-thumb {
	width: 13px; height: 13px; border: none; border-radius: 50%;
	background: var(--app-color-primary, #7aa2ff); cursor: pointer;
}
.csp-field select, .csp-seed {
	width: 100%; font: inherit; padding: 5px 7px;
	color: inherit;
	background: var(--app-color-input, rgba(255, 255, 255, 0.06));
	border: 1px solid var(--app-color-border, rgba(120, 140, 200, 0.22));
	border-radius: 7px; outline: none; cursor: pointer;
}
.csp-seed { cursor: text; }
.csp-field:has(.csp-toggle) { flex-direction: row; align-items: center; justify-content: space-between; }
.csp-field:has(.csp-toggle) .csp-label { flex: 1; }
.csp-toggle { width: 16px; height: 16px; accent-color: var(--app-color-primary, #7aa2ff); cursor: pointer; }
`;
