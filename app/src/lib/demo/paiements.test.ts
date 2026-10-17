import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import type { Declaration, MoyenPaiement } from "../types";
import { cloreCycle, ouvrirCycle } from "./cycles";
import { retirerMembre } from "./membres";
import { contesterPaiement, declarerPaiement, saisirEspeces, validerPaiement } from "./paiements";

const decl = (id: string, cycleId: string, moyen: MoyenPaiement = "mtn_momo", montant = 5000, detteId: string | null = null): Declaration =>
  ({ id, groupId: "g", cycleId, montant, moyen, reference: moyen === "mtn_momo" ? "MP42" : null, date: "2026-09-02", detteId });

describe("moteur démo : paiements", () => {
  it("exige la référence pour MoMo et Orange Money, et un membre actif du groupe", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(() => declarerPaiement(w.e, w.alice, { ...decl("p1", c), reference: " " }))
      .toThrow("Référence de transaction obligatoire pour MoMo et Orange Money");
    expect(() => declarerPaiement(w.e, w.ctx("u-inconnu"), decl("p1", c))).toThrow("Vous n'êtes pas membre de ce groupe");
    expect(() => declarerPaiement(w.e, w.alice, decl("p1", c, "especes", 0))).toThrow("Montant invalide");
  });
  it("un renvoi de la même déclaration est sans effet ; un second paiement pour le cycle est refusé", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    declarerPaiement(w.e, w.alice, decl("p1", c));
    declarerPaiement(w.e, w.alice, decl("p1", c));
    expect(w.e.paiements).toHaveLength(1);
    expect(() => declarerPaiement(w.e, w.bob, decl("p1", c))).toThrow("Identifiant de paiement déjà utilisé");
    expect(() => declarerPaiement(w.e, w.alice, decl("p2", c))).toThrow("Un paiement est déjà enregistré pour ce cycle");
    contesterPaiement(w.e, w.tina, "p1", "Référence introuvable");
    declarerPaiement(w.e, w.alice, decl("p2", c));
    expect(w.e.paiements.map((p) => p.status)).toEqual(["conteste", "declare"]);
  });
  it("bloque la clôture tant qu'une déclaration attend ; validée, elle évite la dette", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    declarerPaiement(w.e, w.alice, decl("p1", c));
    expect(() => cloreCycle(w.e, w.tina, c)).toThrow("1 paiement(s) à valider ou contester avant de clore");
    expect(() => validerPaiement(w.e, w.alice, "p1")).toThrow("Réservé aux trésoriers du groupe");
    validerPaiement(w.e, w.tina, "p1");
    expect(() => validerPaiement(w.e, w.tina, "p1")).toThrow("Ce paiement n'est pas en attente de validation");
    expect(cloreCycle(w.e, w.tina, c)).toEqual({ dettes: 3, montant: 15000 });
    expect(w.e.dettes.some((d) => d.membership_id === w.m.alice)).toBe(false);
  });
  it("une dette se règle en entier ; la validation la solde, la contestation la rouvre", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    cloreCycle(w.e, w.tina, c);
    const dette = w.e.dettes.find((d) => d.membership_id === w.m.alice)!;
    expect(() => declarerPaiement(w.e, w.alice, decl("r1", c, "especes", 3000, dette.id)))
      .toThrow("Le règlement doit couvrir toute la dette (5000 FCFA)");
    expect(() => declarerPaiement(w.e, w.bob, decl("r1", c, "especes", 5000, dette.id))).toThrow("Dette introuvable");
    declarerPaiement(w.e, w.alice, decl("r1", c, "especes", 5000, dette.id));
    validerPaiement(w.e, w.tina, "r1");
    expect(w.e.dettes.find((d) => d.id === dette.id)?.settled_at).not.toBeNull();
    contesterPaiement(w.e, w.tina, "r1", "Billets refusés");
    expect(w.e.dettes.find((d) => d.id === dette.id)?.settled_at).toBeNull();
    expect(w.e.journal.at(-1)).toMatchObject({ action: "paiement_conteste", visible: false, details: { nom: "Alice", montant: 5000 } });
  });
  it("les espèces saisies par le trésorier sont validées tout de suite ; un retiré ne cotise plus", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    saisirEspeces(w.e, w.tina, "e1", w.m.ines, c, 5000);
    expect(w.e.paiements[0]).toMatchObject({ status: "valide", method: "especes", membership_id: w.m.ines });
    retirerMembre(w.e, w.tina, w.m.bob);
    expect(() => saisirEspeces(w.e, w.tina, "e2", w.m.bob, c, 5000)).toThrow("Ce membre est retiré");
    expect(() => contesterPaiement(w.e, w.tina, "e1", " ")).toThrow("Motif obligatoire");
  });
  it("un paiement validé d'un cycle clos est figé", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    saisirEspeces(w.e, w.tina, "e1", w.m.alice, c, 5000);
    cloreCycle(w.e, w.tina, c);
    expect(() => contesterPaiement(w.e, w.tina, "e1", "Erreur")).toThrow("Ce cycle est clos");
    expect(() => declarerPaiement(w.e, w.bob, decl("p9", c))).toThrow("Ce cycle est clos");
  });
});
