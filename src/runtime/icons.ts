/**
 * Inline SVG icons for the shapes HUD — a tiny hand-picked subset of open-source icon sets
 * (Feather, MIT · Lucide, ISC), so the controls render as crisp vector glyphs instead of unicode
 * characters. All share the 24×24 stroke aesthetic, so they sit together cleanly. Browser-only
 * chrome: each export is a static, trusted SVG string meant for `element.innerHTML`.
 *
 * @module
 */

/** Wrap raw `<path>`/`<polygon>` children in a stroke-styled 24×24 SVG (the Feather/Lucide look). */
function stroke(body: string, size = 22): string {
	return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
		`stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
		`stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** The HUD control glyphs. */
export const ICONS = {
	/** Lucide `rotate-cw`. */
	rotateCW: stroke(
		'<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
	),
	/** Lucide `flip-horizontal` (mirror). */
	flip: stroke(
		'<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/>' +
			'<path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>' +
			'<path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/>',
	),
	/** Lucide `undo-2`. */
	undo: stroke(
		'<path d="M9 14 4 9l5-5"/>' +
			'<path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>',
	),
	/** Lucide `lightbulb` (a hint). */
	hint: stroke(
		'<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8' +
			'c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
	),
	/** Feather `volume-2` (sound on). */
	volumeOn: stroke(
		'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
			'<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
	),
	/** Feather `volume-x` (muted). */
	volumeOff: stroke(
		'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
			'<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
	),
	/** Feather `menu` (hamburger). */
	menu: stroke(
		'<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/>' +
			'<line x1="3" y1="18" x2="21" y2="18"/>',
		20,
	),
	/** Feather `refresh-cw` (new puzzle). */
	refresh: stroke(
		'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>' +
			'<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
		16,
	),
	/** Feather `settings` (gear). */
	settings: stroke(
		'<circle cx="12" cy="12" r="3"/>' +
			'<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0' +
			"l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2" +
			"v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83" +
			"l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09" +
			"A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0" +
			"l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09" +
			"a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83" +
			"l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09" +
			'a1.65 1.65 0 0 0-1.51 1z"/>',
		16,
	),
	/** Feather `arrow-left` (back). */
	back: stroke(
		'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
		16,
	),
} as const;

/** A star glyph (Feather `star`): solid when `filled`, otherwise an outline. */
export function starIcon(filled: boolean): string {
	return `<svg viewBox="0 0 24 24" width="26" height="26" ` +
		`fill="${filled ? "currentColor" : "none"}" stroke="currentColor" ` +
		`stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">` +
		`<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 ` +
		`5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}
