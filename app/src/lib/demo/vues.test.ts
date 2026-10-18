import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import { ouvrirCycle } from "./cycles";
import { declarerPaiement, saisirEspeces } from "./paiements";
import { lireJournal, mesGroupes, vueGroupe, vueMembre } from "./vues";

function avecPaiements() {
  const w = monde();
  const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", "2026-09-30");
  saisirEspeces(w.e, w.tina, "e-bob", w.m.bob, c, 5000);
  declarerPaiement(w.e, w.alice, { id: "p-alice", groupId: w.groupId, cycleId: c, montant: 5000, moyen: "mtn_momo", reference: "MP1", date: "2026-09-02", detteId: null });
  return { ...w, c };
}

describe("moteur démo : lectures", () => {
  it("le trésorier voit tout le groupe", () => {
    const w = avecPaiements();
    const v = vueGroupe(w.e, "u-tina", w.groupId);
    expect(v.role).toBe("tresorier");
    expect(v.membres.map((m) => m.display_name)).toEqual(["Tina", "Alice", "Bob", "Ines"]);
    expect(v.paiements).toHaveLength(2);
    expect(v.remises).toHaveLength(1);
  });
  it("un membre ne voit que sa fiche, ses paiements et ses dettes, mais tout l'ordre des tours", () => {
    const w = avecPaiements();
    const v = vueMembre(w.e, "u-alice", w.groupId);
    expect(v.moi.display_name).toBe("Alice");
    expect(v.paiements.map((p) => p.id)).toEqual(["p-alice"]);
    expect(v.ordre.map((o) => [o.display_name, o.is_me, o.prevu])).toEqual([
      ["Tina", false, true], ["Alice", true, false], ["Bob", false, false], ["Ines", false, false]]);
    expect(v.recouvrement).toEqual([{ cycle_id: w.c, membres: 4, attendu: 20000, payes: 1, collecte: 5000 }]);
    expect(vueGroupe(w.e, "u-alice", w.groupId).membres.map((m) => m.display_name)).toEqual(["Alice"]);
    expect(() => vueMembre(w.e, "u-inconnu", w.groupId)).toThrow("Groupe introuvable");
  });
  it("Mes groupes résume le cycle ouvert pour chacun", () => {
    const w = avecPaiements();
    expect(mesGroupes(w.e, "u-alice")[0].resume).toMatchObject({ cycle: "Septembre", monEtat: "en_attente" });
    expect(mesGroupes(w.e, "u-bob")[0].resume).toMatchObject({ monEtat: "paye", montant: 0 });
    expect(mesGroupes(w.e, "u-tina")[0].resume).toMatchObject({ monEtat: "a_payer", aValider: 1 });
    expect(mesGroupes(w.e, "u-inconnu")).toEqual([]);
  });
  it("le journal : le membre ne lit que les entrées visibles, avec le nom de l'auteur, de la plus récente à la plus ancienne", () => {
    const w = avecPaiements();
    const pourTina = lireJournal(w.e, "u-tina", w.groupId);
    const pourAlice = lireJournal(w.e, "u-alice", w.groupId);
    expect(pourTina.some((j) => j.action === "membre_ajoute")).toBe(true);
    expect(pourAlice.some((j) => j.action === "membre_ajoute")).toBe(false);
    expect(pourAlice[0]).toMatchObject({ action: "cycle_ouvert", auteur: "Tina", visible: true });
    expect(pourTina.map((j) => j.id)).toEqual([...pourTina.map((j) => j.id)].sort((a, b) => b - a));
    expect(lireJournal(w.e, "u-tina", w.groupId, pourTina[1].id).map((j) => j.id)).toEqual(pourTina.slice(2).map((j) => j.id));
    expect(() => lireJournal(w.e, "u-inconnu", w.groupId)).toThrow("Réservé aux membres du groupe");
  });
});
