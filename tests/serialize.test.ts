import { assertEquals } from "@std/assert";
import { decodeFromHash, encodeToHash } from "../src/engine/config/serialize.ts";

Deno.test("encode/decode round-trips", () => {
	const obj = { palette: "navy", cameraSpeed: 22, audioEnabled: false, seed: "abc" };
	const hash = encodeToHash(obj);
	assertEquals(decodeFromHash(hash), obj);
	assertEquals(decodeFromHash("#" + hash), obj); // tolerates leading '#'
});

Deno.test("decode tolerates other hash params", () => {
	const obj = { a: 1 };
	const hash = `foo=bar&${encodeToHash(obj)}&baz=qux`;
	assertEquals(decodeFromHash(hash), obj);
});

Deno.test("decode returns null on missing key or garbage", () => {
	assertEquals(decodeFromHash(""), null);
	assertEquals(decodeFromHash("#nope=1"), null);
	assertEquals(decodeFromHash("cfg=%7Bnot json"), null);
});
