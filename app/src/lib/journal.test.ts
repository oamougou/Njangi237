import { describe, expect, it } from "vitest";
import { libelleJournal } from "./journal";
import type { EntreeJournal } from "./types";

const e = (action: string, details: Record<string, unknown>): EntreeJournal =>
  ({ id: 1, action, details, created_at: "2026-10-16T10:00:00Z", auteur: "Tina", visible: true });

describe("libellés du journal", () => {
  it("une phrase claire par action", () => {
    expect(libelleJournal(e("tirage_au_sort", { ordre: ["Bob", "Alice"] }))).toBe("Tirage au sort de l'ordre : 1. Bob, 2. Alice");
    expect(libelleJournal(e("tours_echanges", { a: "Alice", b: "Bob" }))).toBe("Tours échangés entre Alice et Bob");
    expect(libelleJournal(e("cagnotte_remise", { nom: "Tina", montant: 20000 }))).toBe("Cagnotte remise à Tina : 20 000 FCFA");
    expect(libelleJournal(e("cycle_clos", { cycle: "Octobre 2026", dettes: 2 }))).toBe("Cycle « Octobre 2026 » clos · 2 dettes");
    expect(libelleJournal(e("cycle_clos", { cycle: "Octobre 2026", dettes: 0 }))).toBe("Cycle « Octobre 2026 » clos");
    expect(libelleJournal(e("paiement_conteste", { nom: "Alice", montant: 5000, motif: "Référence introuvable" })))
      .toBe("Paiement d'Alice contesté (5 000 FCFA) : Référence introuvable");
    expect(libelleJournal(e("role_change", { nom: "Bob", role: "tresorier" }))).toBe("Bob devient trésorier");
    expect(libelleJournal(e("nouveau_tour", { tour: 2 }))).toBe("Nouveau tour (tour 2)");
    expect(libelleJournal(e("membre_rejoint", { nom: "Ines" }))).toBe("Ines a rejoint le groupe");
  });

  it("action inconnue ou détails manquants : jamais d'erreur", () => {
    expect(libelleJournal(e("action_future", {}))).toBe("action future");
    expect(libelleJournal(e("tirage_au_sort", {}))).toBe("Tirage au sort de l'ordre : ");
  });
  it("abonnements : demande, acceptation, refus, Pilote", () => {
    const e = (action: string, details: Record<string, unknown>) => ({ id: 1, action, details, created_at: "2026-10-18T10:00:00Z", auteur: "Tina", visible: false });
    expect(libelleJournal(e("abonnement_demande", { offre: "groupe", duree: 12, montant: 20000, devise: "XAF" })))
      .toBe("Demande d'abonnement Groupe (12 mois, 20 000 FCFA)");
    expect(libelleJournal(e("abonnement_accepte", { offre: "groupe", fin: "2027-10-18T10:00:00Z" }))).toBe("Abonnement Groupe activé jusqu'au 18/10/2027");
    expect(libelleJournal(e("abonnement_refuse", { offre: "groupe", motif: "Référence introuvable" }))).toBe("Demande d'abonnement refusée : Référence introuvable");
    expect(libelleJournal(e("abonnement_annule", { offre: "groupe" }))).toBe("Demande d'abonnement annulée");
    expect(libelleJournal(e("pilote_attribue", { fin: "2027-01-31T23:00:00Z" }))).toBe("Offre Pilote jusqu'au 31/01/2027");
  });
});
