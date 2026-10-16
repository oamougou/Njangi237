import { describe, expect, it } from "vitest";
import { trierContacts } from "./contacts";

describe("trierContacts", () => {
  const existants = ["237690000004"];   // Bob, déjà membre

  it("garde le nom et le premier numéro valide, normalisé", () => {
    const t = trierContacts([{ name: ["  Jean Mbarga "], tel: ["12", "+237 6 77 00 00 01"] }], existants);
    expect(t.candidats).toEqual([{ nom: "Jean Mbarga", telephone: "237677000001" }]);
    expect(t.ignores).toEqual([]);
  });

  it("écarte sans nom, sans numéro valide, déjà membre et doublon dans la sélection", () => {
    const t = trierContacts([
      { name: [], tel: ["677000002"] },
      { name: ["Paul"], tel: ["1234"] },
      { name: ["Bob"], tel: ["00237 690 00 00 04"] },
      { name: ["Marie"], tel: ["677000003"] },
      { name: ["Marie bis"], tel: ["6 77 00 00 03"] },
    ], existants);
    expect(t.candidats).toEqual([{ nom: "Marie", telephone: "237677000003" }]);
    expect(t.ignores).toEqual([
      { nom: "677000002", raison: "sans nom" },
      { nom: "Paul", raison: "numéro invalide" },
      { nom: "Bob", raison: "déjà dans le groupe" },
      { nom: "Marie bis", raison: "en double dans la sélection" },
    ]);
  });

  it("sélection vide", () => {
    expect(trierContacts([], existants)).toEqual({ candidats: [], ignores: [] });
  });
});
