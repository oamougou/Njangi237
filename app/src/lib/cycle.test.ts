import { describe, expect, it } from "vitest";
import { bilanCycle } from "./cycle";
import type { Cycle, Membre, Paiement } from "./types";

const m = (id: string, nom: string, status: Membre["status"] = "actif", position = 1): Membre =>
  ({ id, display_name: nom, phone: "237690000000", role: "membre", status, position, person_id: null, left_balance: null });
const CYCLE: Cycle = { id: "c1", round: 1, number: 1, label: "Octobre", due_date: "2026-10-30", amount_expected: 5000,
  status: "ouvert", opened_at: "2026-10-01T00:00:00Z", closed_at: null };
const p = (id: string, membre: string, amount: number, status: Paiement["status"], debt_id: string | null = null): Paiement =>
  ({ id, cycle_id: "c1", membership_id: membre, debt_id, amount, method: "especes", reference: null, paid_on: "2026-10-10",
     status, contest_reason: null, created_at: "2026-10-10T10:00:00Z" });

describe("bilanCycle", () => {
  const membres = [m("a", "Alice", "actif", 1), m("b", "Bob", "actif", 2), m("c", "Carine", "invite", 3),
    m("d", "Didier", "actif", 4), m("e", "Eric", "actif", 5), m("r", "Retiré", "retire", 6)];
  const paiements = [
    p("p1", "a", 5000, "valide"),
    p("p2", "b", 5000, "declare"),
    p("p3", "c", 3000, "valide"),
    p("p4", "d", 5000, "conteste"),
    p("p5", "e", 5000, "valide", "dette-1"),   // règlement d'une dette : ne compte pas dans le cycle
  ];
  const b = bilanCycle(CYCLE, membres, paiements);

  it("donne l'état de chaque membre compté, dans l'ordre", () => {
    expect(b.lignes.map((l) => [l.membre.display_name, l.etat])).toEqual([
      ["Alice", "paye"], ["Bob", "declare"], ["Carine", "partiel"], ["Didier", "conteste"], ["Eric", "retard"]]);
    expect(b.lignes[1].enAttente?.id).toBe("p2");
  });
  it("totaux : seuls les paiements validés du cycle comptent", () => {
    expect(b.attendu).toBe(25000);
    expect(b.collecte).toBe(8000);
    expect(b.taux).toBe(32);
    expect(b.aValider).toBe(1);
    expect(b.enRetard.map((l) => l.membre.id)).toEqual(["c", "d", "e"]);
  });
  it("aucun membre : pas de division par zéro", () => {
    expect(bilanCycle(CYCLE, [], []).taux).toBe(0);
  });
});
