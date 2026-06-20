import { assert, assertEquals } from "@std/assert";
import { Engine, type FrameScheduler } from "../src/engine/loop/engine.ts";

/** A synthetic scheduler: capture the frame callback so the test can drive frames by hand. */
function manualScheduler(): { scheduler: FrameScheduler; frame: (t: number) => void } {
	let cb: ((t: number) => void) | null = null;
	return {
		scheduler: (fn) => {
			cb = fn;
			return () => {};
		},
		frame: (t) => cb?.(t),
	};
}

Deno.test("engine resumes without a catch-up jump after a long gap", () => {
	const { scheduler, frame } = manualScheduler();
	let steps = 0;
	const engine = new Engine({
		scheduler,
		step: () => steps++,
		render: () => {},
		fixedStepMs: 10,
		maxFrameDeltaMs: 250,
	});
	engine.start();

	frame(0); // baseline frame — no steps
	frame(10); // +1 step
	frame(20); // +1 step
	assertEquals(steps, 2);

	// Backgrounded ~5s: must NOT replay a burst of steps — resume cleanly with zero catch-up.
	frame(5020);
	assertEquals(steps, 2, "no catch-up steps after a long background gap");

	// The very next normal frame continues stepping smoothly.
	frame(5030);
	assertEquals(steps, 3);
});

Deno.test("engine still steps normally within the frame-delta clamp", () => {
	const { scheduler, frame } = manualScheduler();
	let steps = 0;
	const engine = new Engine({
		scheduler,
		step: () => steps++,
		render: () => {},
		fixedStepMs: 10,
		maxStepsPerFrame: 5,
		maxFrameDeltaMs: 250,
	});
	engine.start();
	frame(0);
	frame(40); // 40ms → 4 whole 10ms steps
	assertEquals(steps, 4);
	// A slow-but-real 100ms frame is clamped by maxStepsPerFrame, not skipped.
	frame(140);
	assert(steps > 4 && steps <= 4 + 5);
});
