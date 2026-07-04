/**
 * Architecture guardrail: the `engine/` and `cityscape/` layers must stay pure — no DOM, no
 * browser globals, and no imports from the renderer/runtime/ui/audio layers or browser libs.
 * This makes the "DOM-free, unit-testable core" claim a *tested* invariant rather than a promise.
 */
import { assert } from "@std/assert";

const PURE_ROOTS = ["src/engine", "src/cityscape", "src/naturescape"];

/**
 * Browser/DOM tokens that must never appear in pure code. Note `window` is matched only as the
 * global (`window.`), not the domain concept (building windows, `mood.window`).
 */
const FORBIDDEN_TOKENS: RegExp[] = [
	/\bdocument\b/,
	/(^|[^.\w])window\s*\./,
	/\bnavigator\b/,
	/\blocalStorage\b/,
	/\bsessionStorage\b/,
	/requestAnimationFrame/,
	/cancelAnimationFrame/,
	/devicePixelRatio/,
	/addEventListener/,
	/HTMLCanvasElement/,
	/CanvasRenderingContext2D/,
	/\bHTMLElement\b/,
	/AudioContext/,
	/\.getContext\(/,
];

/**
 * Imports that would couple the core to outer layers / browser libraries. (Importing the engine's
 * own pure `engine/render/` seam is fine — only the renderer *implementations* and the
 * runtime/ui/audio layers are forbidden.)
 */
const FORBIDDEN_IMPORTS: RegExp[] = [
	/from\s+["'][^"']*\/render\/(canvas|ascii|pixelart)\//,
	/from\s+["'][^"']*\/(runtime|ui|audio)\//,
	/from\s+["']@marianmeres\/vanilla["']/,
	/from\s+["']@marianmeres\/design-tokens["']/,
];

function stripComments(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, "") // block comments
		.replace(/(^|[^:])\/\/.*$/gm, "$1"); // line comments (guard `://`)
}

function* walk(dir: string): Generator<string> {
	for (const entry of Deno.readDirSync(dir)) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory) yield* walk(path);
		else if (entry.isFile && entry.name.endsWith(".ts")) yield path;
	}
}

Deno.test("the pure core layers (engine + domains) contain no DOM or browser usage", () => {
	const offenders: string[] = [];
	for (const root of PURE_ROOTS) {
		for (const file of walk(root)) {
			const code = stripComments(Deno.readTextFileSync(file));
			for (const re of FORBIDDEN_TOKENS) {
				if (re.test(code)) offenders.push(`${file}: token ${re}`);
			}
			for (const re of FORBIDDEN_IMPORTS) {
				if (re.test(code)) offenders.push(`${file}: import ${re}`);
			}
		}
	}
	assert(
		offenders.length === 0,
		`pure core touched the DOM:\n  ${offenders.join("\n  ")}`,
	);
});
