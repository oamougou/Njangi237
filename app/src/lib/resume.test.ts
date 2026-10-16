import { describe, expect, it } from "vitest";
import { resumerGroupe } from "./resume";

const CYCLE = { id: "c1", label: "Octobre 2026", due_date: "2026-10-30", amount_expected: 5000, opened_at: "2026-10-01T00:00:00Z" };
const p = (status: string, amount = 5000, membership_id = "m1") => ({ cycle_id: "c1", membership_id, status, amount });

describe("resumerGroupe", () => {
  it("reste à payer, déduction faite d'un paiement partiel validé", () => {
    const r = resumerGroupe("membre", "m1", "2026-09-01T00:00:00Z", CYCLE, [p("valide", 2000)]);
    expect(r).toMatchObject({ cycleId: "c1", cycle: "Octobre 2026", monEtat: "a_payer", montant: 3000 });
  });
  it("arrivé après l'ouverture : pas concerné", () => {
    expect(resumerGroupe("membre", "m1", "2026-10-10T00:00:00Z", CYCLE, []).monEtat).toBe("hors");
  });
  it("payé, en attente, contesté ; trésorier : déclarations à valider", () => {
    expect(resumerGroupe("membre", "m1", "2026-09-01T00:00:00Z", CYCLE, [p("valide")]).monEtat).toBe("paye");
    expect(resumerGroupe("membre", "m1", "2026-09-01T00:00:00Z", CYCLE, [p("declare")]).monEtat).toBe("en_attente");
    expect(resumerGroupe("membre", "m1", "2026-09-01T00:00:00Z", CYCLE, [p("conteste")]).monEtat).toBe("conteste");
    const t = resumerGroupe("tresorier", "m1", "2026-09-01T00:00:00Z", CYCLE, [p("declare", 5000, "m2"), p("declare", 5000, "m3")]);
    expect(t.aValider).toBe(2);
  });
  it("pas de cycle ouvert", () => {
    expect(resumerGroupe("membre", "m1", "2026-09-01T00:00:00Z", null, [])).toEqual(
      { cycleId: null, cycle: null, echeance: null, montant: null, monEtat: null, aValider: 0 });
  });
});
