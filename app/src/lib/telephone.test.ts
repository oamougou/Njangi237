import { describe, expect, it } from "vitest";
import { afficherTelephone, normaliserTelephone } from "./telephone";

describe("téléphone", () => {
  it("normalise comme la base et la fonction serveur", () => {
    expect(normaliserTelephone("+237 6 90 00 00 07")).toBe("237690000007");
    expect(() => normaliserTelephone("123")).toThrow("Numéro de téléphone invalide");
  });
  it("affiche un numéro lisible", () => {
    expect(afficherTelephone("237690000007")).toBe("6 90 00 00 07");
    expect(afficherTelephone("autre")).toBe("autre");
  });
});
