import { describe, expect, it } from "vitest";
import { csvCycle } from "./csv";
import { bilanCycle } from "./cycle";
import type { Cycle, Membre, Paiement } from "./types";

describe("csvCycle", () => {
  const CYCLE: Cycle = { id: "c1", round: 1, number: 1, label: "Octobre", due_date: null, amount_expected: 5000,
    status: "ouvert", opened_at: "2026-10-01T00:00:00Z", closed_at: null };
  const membres: Membre[] = [
    { id: "a", display_name: 'Alice "la grande"', phone: "237690000003", role: "membre", status: "actif", position: 1, person_id: null, left_balance: null },
    { id: "b", display_name: "Bob; fils", phone: "237690000004", role: "membre", status: "actif", position: 2, person_id: null, left_balance: null },
  ];
  const paiements: Paiement[] = [{ id: "p1", cycle_id: "c1", membership_id: "a", debt_id: null, amount: 5000, method: "mtn_momo",
    reference: "MP1", paid_on: "2026-10-10", status: "valide", contest_reason: null, created_at: "2026-10-10T10:00:00Z" }];
  const csv = csvCycle("Tontine", CYCLE, bilanCycle(CYCLE, membres, paiements));

  it("BOM, séparateur point-virgule, guillemets échappés", () => {
    const lignes = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(lignes[0]).toBe('"Membre";"Téléphone";"Statut";"Montant validé (FCFA)";"Moyen";"Référence";"Date"');
    expect(lignes[1]).toBe('"Alice ""la grande""";"6 90 00 00 03";"Payé";"5000";"MTN MoMo";"MP1";"10/10/2026"');
    expect(lignes[2]).toBe('"Bob; fils";"6 90 00 00 04";"En retard";"0";"";"";""');
  });
});
