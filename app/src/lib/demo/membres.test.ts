import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import { ouvrirCycle } from "./cycles";
import { ajouterMembre, apercuRetrait, changerRole, retirerMembre } from "./membres";

describe("moteur démo : membres", () => {
  it("place le nouveau membre en dernière position, invité", () => {
    const w = monde();
    const id = ajouterMembre(w.e, w.tina, w.groupId, "Zoé", "690000009");
    expect(w.e.membres.find((m) => m.id === id)).toMatchObject({ position: 5, status: "invite", role: "membre", phone: "237690000009" });
  });
  it("refuse un numéro déjà dans le groupe, accepte le retour d'un membre retiré", () => {
    const w = monde();
    expect(() => ajouterMembre(w.e, w.tina, w.groupId, "Bob bis", "690000003")).toThrow("Ce numéro est déjà dans le groupe");
    retirerMembre(w.e, w.tina, w.m.bob);
    expect(ajouterMembre(w.e, w.tina, w.groupId, "Bob", "690000003")).toBe(w.m.bob);
    expect(w.e.membres.find((m) => m.id === w.m.bob)?.status).toBe("invite");
  });
  it("réserve les actions au trésorier et refuse un numéro invalide", () => {
    const w = monde();
    expect(() => ajouterMembre(w.e, w.alice, w.groupId, "Zoé", "690000009")).toThrow("Réservé aux trésoriers du groupe");
    expect(() => ajouterMembre(w.e, w.tina, w.groupId, "Zoé", "12")).toThrow("Numéro de téléphone invalide");
  });
  it("garde au moins un trésorier actif", () => {
    const w = monde();
    expect(() => changerRole(w.e, w.tina, w.m.tina, "membre")).toThrow("Le groupe doit garder au moins un trésorier actif");
    changerRole(w.e, w.tina, w.m.alice, "tresorier");
    changerRole(w.e, w.tina, w.m.tina, "membre");
    expect(w.e.membres.find((m) => m.id === w.m.tina)?.role).toBe("membre");
  });
  it("refuse de retirer le bénéficiaire du cycle ouvert", () => {
    const w = monde();
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);   // Tina, première, est bénéficiaire
    changerRole(w.e, w.tina, w.m.alice, "tresorier");
    expect(() => retirerMembre(w.e, w.alice, w.m.tina)).toThrow("Ce membre est bénéficiaire du cycle en cours : remplacez-le d'abord");
  });
  it("fige ce que doit le membre qui part et l'inscrit au journal", () => {
    const w = monde();
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(apercuRetrait(w.e, w.tina, w.m.bob)).toEqual({ deja_servi: false, cycles_restants: 1, montant_restant: 5000, dettes: 0 });
    retirerMembre(w.e, w.tina, w.m.bob);
    expect(w.e.membres.find((m) => m.id === w.m.bob)).toMatchObject({ status: "retire", position: null, left_balance: 5000 });
    expect(w.e.journal.slice(-2).map((j) => [j.action, j.visible])).toEqual([["membre_retire", true], ["solde_depart", false]]);
  });
});
