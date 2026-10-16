import { describe, expect, it } from "vitest";
import { ErreurReseau, estReseau, versErreur } from "./erreurs";

describe("erreurs", () => {
  it("une coupure (pas de code, « Failed to fetch ») devient ErreurReseau", () => {
    expect(versErreur({ message: "TypeError: Failed to fetch" })).toBeInstanceOf(ErreurReseau);
    expect(versErreur({ message: "Load failed", code: "" })).toBeInstanceOf(ErreurReseau);
    expect(estReseau(new TypeError("Failed to fetch"))).toBe(true);
  });
  it("un refus de la base garde son message", () => {
    const e = versErreur({ message: "Ce cycle est clos", code: "P0001" });
    expect(e).not.toBeInstanceOf(ErreurReseau);
    expect(e.message).toBe("Ce cycle est clos");
    expect(estReseau(e)).toBe(false);
    expect(versErreur(null).message).toBe("Erreur inattendue, réessayez");
  });
});
