import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { emailInterne, normaliserTelephone, pinValide } from "./telephone.ts";

Deno.test("numéros saisis à la camerounaise", () => {
  for (const s of ["6 90 00 00 07", "+237 690 00 00 07", "00237690000007", "237-690-000-007", "690000007"])
    assertEquals(normaliserTelephone(s), "237690000007", s);
  assertThrows(() => normaliserTelephone("12345"), Error, "Numéro de téléphone invalide");
});

Deno.test("identifiant interne et PIN", () => {
  assertEquals(emailInterne("237690000007"), "237690000007@njangi237.local");
  assertEquals(pinValide("012345"), true);
  for (const p of ["12345", "1234567", "12a456", 123456, null]) assertEquals(pinValide(p), false, String(p));
});
