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

Deno.test("maxFps caps render but steps every frame; beat-safe on both cadences", () => {
	// 60 fps cap → min gap ~13.33ms (1000/60 * 0.8), chosen below one 16.7ms frame on purpose.
	const run = (spacingMs: number, frames: number) => {
		const { scheduler, frame } = manualScheduler();
		let steps = 0;
		let renders = 0;
		const engine = new Engine({
			scheduler,
			step: () => steps++,
			render: () => renders++,
			fixedStepMs: 10,
			maxFps: 60,
		});
		engine.start();
		for (let i = 0; i < frames; i++) frame(i * spacingMs);
		return { steps, renders };
	};

	// A 120 Hz panel (8.3ms frames): render drops to ~half, ~every other frame.
	const hi = run(1000 / 120, 60);
	assert(
		hi.renders >= 28 && hi.renders <= 32,
		`120Hz should render ~half of 60 frames, got ${hi.renders}`,
	);

	// A true-60 Hz panel (16.7ms frames): every frame must render — no beat-skip to 30.
	const lo = run(1000 / 60, 60);
	assertEquals(lo.renders, 60, "16.7ms cadence must render every frame");

	// The cap never touches the simulation: step keeps advancing on skipped frames too.
	assert(hi.steps > hi.renders, "step runs every frame regardless of the render cap");
});

Deno.test("no maxFps renders every frame (default loop unchanged)", () => {
	const { scheduler, frame } = manualScheduler();
	let renders = 0;
	const engine = new Engine({
		scheduler,
		step: () => {},
		render: () => renders++,
		fixedStepMs: 10,
	});
	engine.start();
	for (let i = 0; i < 30; i++) frame(i * (1000 / 120));
	assertEquals(renders, 30, "uncapped loop paints every scheduled frame");
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
