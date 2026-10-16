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
  it("sans code SQL (portail captif, page HTML, délai dépassé) : coupure, pas refus", () => {
    expect(versErreur({ message: "SyntaxError: Unexpected token '<'", code: "" })).toBeInstanceOf(ErreurReseau);
    expect(versErreur({ message: "AbortError: signal timed out" })).toBeInstanceOf(ErreurReseau);
    expect(estReseau(new DOMException("signal timed out", "TimeoutError"))).toBe(true);
  });
  it("session expirée ou appel parti sans session : à réessayer, pas un refus définitif", () => {
    expect(versErreur({ message: "JWT expired", code: "PGRST301" })).toBeInstanceOf(ErreurReseau);
    expect(versErreur({ message: "permission denied for function declarer_paiement", code: "42501" })).toBeInstanceOf(ErreurReseau);
    expect(versErreur({ message: "Vous n'êtes pas membre de ce groupe", code: "42501" })).not.toBeInstanceOf(ErreurReseau);
  });
});
