import { describe, expect, it } from "vitest";
import { ALICE, etatDemo, TINA } from "./donnees";
import { mesGroupes } from "./vues";

const MAINTENANT = new Date("2026-10-17T10:00:00Z");

describe("données de démonstration", () => {
  const e = etatDemo(MAINTENANT);
  const tontine = e.groupes.find((g) => g.name === "Tontine des amis")!;
  const membres = e.membres.filter((m) => m.group_id === tontine.id);

  it("une tontine de 12 membres dont 2 invités, et une cotisation de 5", () => {
    expect(membres).toHaveLength(12);
    expect(membres.filter((m) => m.status === "invite")).toHaveLength(2);
    const cotisation = e.groupes.find((g) => g.name === "Cotisation du quartier")!;
    expect(cotisation.type).toBe("cotisation");
    expect(e.membres.filter((m) => m.group_id === cotisation.id)).toHaveLength(5);
  });
  it("un cycle clos avec une dette et une cagnotte remise, un cycle ouvert avec des paiements à valider", () => {
    const cycles = e.cycles.filter((c) => c.group_id === tontine.id);
    expect(cycles.map((c) => c.status)).toEqual(["clos", "ouvert"]);
    expect(e.dettes.filter((d) => d.group_id === tontine.id && !d.settled_at)).toEqual([expect.objectContaining({ amount: 5000 })]);
    expect(e.remises.filter((r) => r.group_id === tontine.id).map((r) => [r.status, r.amount])).toEqual([["remis", 120000], ["prevu", null]]);
    const ouvert = cycles[1];
    expect(e.paiements.filter((p) => p.cycle_id === ouvert.id && p.status === "declare")).toHaveLength(2);
    expect(e.paiements.filter((p) => p.cycle_id === ouvert.id && p.status === "conteste")).toHaveLength(1);
  });
  it("Alice a encore à payer ; Tina a deux paiements à valider", () => {
    const pourAlice = mesGroupes(e, ALICE);
    expect(pourAlice.map((g) => g.groupe.name)).toEqual(["Cotisation du quartier", "Tontine des amis"]);
    expect(pourAlice[1].resume).toMatchObject({ monEtat: "a_payer", montant: 10000 });
    expect(mesGroupes(e, TINA).find((g) => g.groupe.name === "Tontine des amis")?.resume?.aValider).toBe(2);
  });
  it("rien n'est daté après aujourd'hui", () => {
    const dates = [...e.journal.map((j) => j.created_at), ...e.paiements.map((p) => p.created_at), ...e.cycles.map((c) => c.opened_at)];
    expect(dates.every((d) => d <= MAINTENANT.toISOString())).toBe(true);
  });
});
