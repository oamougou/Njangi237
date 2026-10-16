import { describe, expect, it } from "vitest";
import { monEtat } from "./etatMembre";
import type { Cycle, Membre, Paiement } from "./types";
import type { EnFile } from "./horsLigne";

const CYCLE: Cycle = { id: "c1", round: 1, number: 1, label: "Octobre", due_date: null, amount_expected: 5000,
  status: "ouvert", opened_at: "2026-10-01T00:00:00Z", closed_at: null };
const MOI: Membre = { id: "m1", display_name: "Alice", phone: "237690000003", role: "membre", status: "actif", position: 2,
  person_id: "u1", left_balance: null, created_at: "2026-09-01T00:00:00Z" };
const p = (status: Paiement["status"], amount = 5000, extra: Partial<Paiement> = {}): Paiement => ({ id: `p-${status}`, cycle_id: "c1",
  membership_id: "m1", debt_id: null, amount, method: "mtn_momo", reference: "MP1", paid_on: "2026-10-05", status,
  contest_reason: status === "conteste" ? "Référence introuvable" : null, created_at: "2026-10-05T10:00:00Z", ...extra });

describe("monEtat", () => {
  it("à payer, payé, en attente de validation", () => {
    expect(monEtat(CYCLE, MOI, [], [])?.etat).toBe("a_payer");
    expect(monEtat(CYCLE, MOI, [p("valide")], [])?.etat).toBe("paye");
    expect(monEtat(CYCLE, MOI, [p("declare")], [])?.etat).toBe("en_attente");
  });
  it("contesté : motif affiché, à redéclarer", () => {
    expect(monEtat(CYCLE, MOI, [p("conteste")], [])).toEqual({ etat: "conteste", motif: "Référence introuvable", valide: 0 });
  });
  it("déclaration encore dans la file du téléphone", () => {
    const file: EnFile[] = [{ etat: "attente", declaration: { id: "x", groupId: "g1", cycleId: "c1", montant: 5000, moyen: "mtn_momo",
      reference: "MP1", date: "2026-10-16", detteId: null } }];
    expect(monEtat(CYCLE, MOI, [], file)?.etat).toBe("a_envoyer");
  });
  it("arrivé après l'ouverture : pas concerné ; règlement de dette ignoré pour le cycle", () => {
    expect(monEtat(CYCLE, { ...MOI, created_at: "2026-10-10T00:00:00Z" }, [], [])?.etat).toBe("hors");
    expect(monEtat(CYCLE, MOI, [p("valide", 5000, { debt_id: "d1" })], [])?.etat).toBe("a_payer");
  });
  it("aucun cycle ouvert", () => {
    expect(monEtat(null, MOI, [], [])).toBeNull();
  });
});
