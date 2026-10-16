import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1.0.13";
import { genererJeton, hashJeton, jetonValide } from "./jeton.ts";

Deno.test("jeton : 43 caractères base64url, jamais deux fois le même", () => {
  const a = genererJeton(), b = genererJeton();
  assertMatch(a, /^[A-Za-z0-9_-]{43}$/);
  assertNotEquals(a, b);
  assertEquals(jetonValide(a), true);
  for (const x of ["court", a + "x", a.slice(0, 42) + "=", 42, null]) assertEquals(jetonValide(x), false, String(x));
});

Deno.test("empreinte SHA-256 hexadécimale", async () => {
  assertEquals(await hashJeton("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
