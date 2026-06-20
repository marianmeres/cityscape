/**
 * Generic config ⇄ URL-hash round-tripping.
 *
 * A chosen look should be a shareable permalink: `#cfg=<encoded>` reproduces it exactly. This
 * module is pure string math (no `location`, no DOM) so it is testable; the runtime feeds it
 * `location.hash` and writes the result back. We keep the payload human-inspectable
 * (URI-encoded JSON) rather than base64 so a curious reader can see the knobs.
 *
 * @module
 */

/** The hash key under which config is stored: `#cfg=...`. */
export const HASH_KEY = "cfg";

/** Encode a plain object to the `cfg=...` hash fragment (without a leading `#`). */
export function encodeToHash(obj: object): string {
	return `${HASH_KEY}=${encodeURIComponent(JSON.stringify(obj))}`;
}

/**
 * Decode a config object from a hash string (`#cfg=...` or `cfg=...`). Returns `null` when the
 * key is absent or the payload is malformed — callers fall back to defaults.
 */
export function decodeFromHash(hash: string): Record<string, unknown> | null {
	if (!hash) return null;
	const clean = hash.replace(/^#/, "");
	for (const part of clean.split("&")) {
		const eq = part.indexOf("=");
		if (eq < 0) continue;
		if (part.slice(0, eq) !== HASH_KEY) continue;
		try {
			const parsed = JSON.parse(decodeURIComponent(part.slice(eq + 1)));
			return parsed && typeof parsed === "object" ? parsed : null;
		} catch {
			return null;
		}
	}
	return null;
}
