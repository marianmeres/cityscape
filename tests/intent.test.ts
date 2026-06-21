import { assert, assertEquals } from "@std/assert";
import { IntentState } from "../src/engine/input/intent.ts";

const MAP = { KeyR: "rotate", KeyF: "flip", Space: "drop" };

Deno.test("a key-down raises a press edge and marks the action held", () => {
	const s = new IntentState(MAP);
	s.keyDown("KeyR");
	assert(s.pressed("rotate"));
	assert(s.held("rotate"));
	assert(!s.pressed("flip"));
});

Deno.test("auto-repeat does not re-fire the press edge", () => {
	const s = new IntentState(MAP);
	s.keyDown("KeyR");
	s.tick();
	s.keyDown("KeyR"); // still held → no new press
	assert(!s.pressed("rotate"));
	assert(s.held("rotate"));
});

Deno.test("tick ages edges but preserves held state", () => {
	const s = new IntentState(MAP);
	s.keyDown("Space");
	assert(s.pressed("drop"));
	s.tick();
	assert(!s.pressed("drop"));
	assert(s.held("drop"));
});

Deno.test("key-up raises a release edge and clears held", () => {
	const s = new IntentState(MAP);
	s.keyDown("KeyF");
	s.tick();
	s.keyUp("KeyF");
	assert(s.released("flip"));
	assert(!s.held("flip"));
	s.tick();
	assert(!s.released("flip"));
});

Deno.test("unmapped keys are ignored", () => {
	const s = new IntentState(MAP);
	s.keyDown("KeyZ");
	assertEquals(s.consumePressed(), []);
});

Deno.test("a scripted sequence yields a deterministic pressed timeline", () => {
	const s = new IntentState(MAP);
	const timeline: string[][] = [];
	const step = (codes: { down?: string; up?: string }) => {
		if (codes.down) s.keyDown(codes.down);
		if (codes.up) s.keyUp(codes.up);
		timeline.push(s.consumePressed().sort());
		s.tick();
	};
	step({ down: "KeyR" });
	step({ down: "KeyF" });
	step({ up: "KeyR" });
	step({ down: "Space" });
	assertEquals(timeline, [["rotate"], ["flip"], [], ["drop"]]);
});

Deno.test("reset forgets all state", () => {
	const s = new IntentState(MAP);
	s.keyDown("KeyR");
	s.reset();
	assert(!s.held("rotate"));
	assert(!s.pressed("rotate"));
});
