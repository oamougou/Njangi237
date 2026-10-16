import { describe, expect, it } from "vitest";
import { messageRelance, prochaineRelance } from "./relances";

describe("relances", () => {
  it("message de relance poli, montant et échéance", () => {
    const m = messageRelance("Alice", "Tontine des amis", 5000, "2026-10-30");
    expect(m).toContain("Bonjour Alice");
    expect(m).toContain("5 000 FCFA");
    expect(m).toContain("Tontine des amis");
    expect(m).toContain("30/10/2026");
    expect(messageRelance("Bob", "T", 1000, null)).not.toContain("avant le");
  });
  it("un retardataire par geste, dans l'ordre, puis la file se vide", () => {
    let r = prochaineRelance(null, ["a", "b", "c"]);
    expect(r).toEqual({ suivant: "a", file: ["b", "c"] });
    r = prochaineRelance(r.file, ["b", "c"]);
    expect(r).toEqual({ suivant: "b", file: ["c"] });
    r = prochaineRelance(r.file, ["c"]);
    expect(r).toEqual({ suivant: "c", file: [] });
  });
  it("un membre qui a payé entre-temps est sauté", () => {
    expect(prochaineRelance(["a", "b"], ["b"])).toEqual({ suivant: "b", file: [] });
  });
  it("personne en retard : rien à faire", () => {
    expect(prochaineRelance(null, [])).toEqual({ suivant: null, file: [] });
  });
});
