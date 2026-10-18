import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import { cloreCycle, ouvrirCycle, rouvrirCycle } from "./cycles";
import { ajouterMembre } from "./membres";

describe("moteur démo : cycles", () => {
  it("ouvre un cycle, verrouille l'ordre et désigne le premier bénéficiaire", () => {
    const w = monde();
    const id = ouvrirCycle(w.e, w.tina, w.groupId, " Septembre ", "2026-09-30");
    expect(w.e.cycles.find((c) => c.id === id)).toMatchObject({ label: "Septembre", round: 1, number: 1, amount_expected: 5000, status: "ouvert" });
    expect(w.e.groupes[0].order_locked).toBe(true);
    expect(w.e.remises).toEqual([expect.objectContaining({ cycle_id: id, membership_id: w.m.tina, amount_expected: 20000, status: "prevu" })]);
    expect(w.e.journal.at(-1)).toMatchObject({ action: "cycle_ouvert", visible: true, details: { cycle: "Septembre" } });
  });
  it("refuse un second cycle ouvert, un libellé vide et un membre non trésorier", () => {
    const w = monde();
    expect(() => ouvrirCycle(w.e, w.tina, w.groupId, "  ", null)).toThrow("Libellé du cycle obligatoire");
    expect(() => ouvrirCycle(w.e, w.alice, w.groupId, "Septembre", null)).toThrow("Réservé aux trésoriers du groupe");
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(() => ouvrirCycle(w.e, w.tina, w.groupId, "Octobre", null)).toThrow("Un cycle est déjà ouvert : clôturez-le d'abord");
  });
  it("à la clôture, crée une dette pour chaque membre compté (invité compris), pas pour un arrivé après l'ouverture", () => {
    const w = monde();
    const id = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    w.avancer();
    ajouterMembre(w.e, w.tina, w.groupId, "Zoé", "690000009");
    expect(cloreCycle(w.e, w.tina, id)).toEqual({ dettes: 4, montant: 20000 });
    expect(w.e.dettes.map((d) => d.membership_id).sort()).toEqual([w.m.alice, w.m.bob, w.m.ines, w.m.tina].sort());
    expect(w.e.cycles[0]).toMatchObject({ status: "clos" });
    expect(() => cloreCycle(w.e, w.tina, id)).toThrow("Ce cycle est déjà clos");
  });
  it("rouvre seulement le dernier cycle clos, et efface ses dettes", () => {
    const w = monde();
    const c1 = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    cloreCycle(w.e, w.tina, c1);
    expect(() => rouvrirCycle(w.e, w.tina, "inconnu")).toThrow("Cycle introuvable");
    rouvrirCycle(w.e, w.tina, c1);
    expect(w.e.dettes).toEqual([]);
    expect(w.e.cycles[0].status).toBe("ouvert");
    expect(() => rouvrirCycle(w.e, w.tina, c1)).toThrow("Ce cycle n'est pas clos");
    cloreCycle(w.e, w.tina, c1);
    const c2 = ouvrirCycle(w.e, w.tina, w.groupId, "Octobre", null);
    cloreCycle(w.e, w.tina, c2);
    expect(() => rouvrirCycle(w.e, w.tina, c1)).toThrow("Seul le dernier cycle peut être rouvert");
  });
  it("une cotisation n'a pas de bénéficiaire", () => {
    const w = monde();
    w.e.groupes[0].type = "cotisation";
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(w.e.remises).toEqual([]);
  });
});
