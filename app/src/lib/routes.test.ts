import { describe, expect, it } from "vitest";
import { lireRoute } from "./routes";

describe("routes", () => {
  it("liens d'invitation et de nouveau PIN", () => {
    expect(lireRoute("#/invitation/abc_DEF-1")).toEqual({ nom: "invitation", jeton: "abc_DEF-1" });
    expect(lireRoute("#/nouveau-pin/xyz")).toEqual({ nom: "nouveau-pin", jeton: "xyz" });
  });
  it("écrans et valeur par défaut", () => {
    expect(lireRoute("#/profil")).toEqual({ nom: "profil" });
    expect(lireRoute("#/admin")).toEqual({ nom: "admin" });
    expect(lireRoute("#/amorcer")).toEqual({ nom: "amorcer" });
    expect(lireRoute("#/groupe/abc-123")).toEqual({ nom: "groupe", id: "abc-123", onglet: "cycle" });
    expect(lireRoute("#/groupe/abc-123/membres")).toEqual({ nom: "groupe", id: "abc-123", onglet: "membres" });
    expect(lireRoute("#/groupe/abc-123/inconnu")).toEqual({ nom: "groupe", id: "abc-123", onglet: "cycle" });
    for (const h of ["", "#", "#/", "#/invitation", "#/inconnu"]) expect(lireRoute(h)).toEqual({ nom: "accueil" });
  });
});
