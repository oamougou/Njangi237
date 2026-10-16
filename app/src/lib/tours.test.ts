import { describe, expect, it } from "vitest";
import { deplacer, estimerTour, etatTour, montantPropose } from "./tours";
import type { Cycle, Membre, OrdreTour, Remise } from "./types";

const o = (pos: number, extra: Partial<OrdreTour> = {}): OrdreTour => ({ membership_id: `m${pos}`, display_name: `M${pos}`, role: "membre",
  status: "actif", position: pos, is_me: false, servi: false, prevu: false, ...extra });
const OUVERT: Cycle = { id: "c1", round: 1, number: 2, label: "Novembre", due_date: null, amount_expected: 5000,
  status: "ouvert", opened_at: "2026-11-01T00:00:00Z", closed_at: null };

describe("estimerTour", () => {
  it("mensuel, un bénéficiaire : deux personnes avant moi après le cycle en cours → 3 mois", () => {
    const ordre = [o(1, { servi: true }), o(2, { prevu: true }), o(3), o(4), o(5, { is_me: true })];
    const e = estimerTour(ordre, 1, "mensuelle", OUVERT)!;
    expect(e.cyclesAvant).toBe(3);
    expect(e.date?.toISOString().slice(0, 10)).toBe("2027-02-01");
  });
  it("bénéficiaire du cycle en cours", () => {
    expect(estimerTour([o(1, { is_me: true, prevu: true })], 1, "mensuelle", OUVERT)?.cyclesAvant).toBe(0);
  });
  it("deux bénéficiaires par cycle, hebdomadaire, sans cycle ouvert", () => {
    const ordre = [o(1), o(2), o(3), o(4, { is_me: true })];
    const e = estimerTour(ordre, 2, "hebdomadaire", null, new Date("2026-10-16T00:00:00Z"))!;
    expect(e.cyclesAvant).toBe(2);
    expect(e.date?.toISOString().slice(0, 10)).toBe("2026-10-23");
  });
  it("déjà servi dans ce tour, ou fréquence ponctuelle", () => {
    expect(estimerTour([o(1, { is_me: true, servi: true })], 1, "mensuelle", OUVERT)).toBeNull();
    expect(estimerTour([o(1), o(2, { is_me: true })], 1, "ponctuelle", OUVERT)?.date).toBeNull();
  });
  it("sans cycle ouvert, premier de la liste : au prochain cycle (pas « ce cycle »)", () => {
    const e = estimerTour([o(1, { is_me: true })], 1, "mensuelle", null, new Date("2026-10-16T00:00:00Z"))!;
    expect(e.cyclesAvant).toBe(1);
    expect(e.date?.toISOString().slice(0, 10)).toBe("2026-10-16");
    expect(estimerTour([o(1, { is_me: true, prevu: true })], 1, "mensuelle", null)?.cyclesAvant).toBe(1);
  });
});

describe("réglage et état du tour", () => {
  const m = (id: string, position: number | null, status: Membre["status"] = "actif"): Membre => ({
    id, display_name: id.toUpperCase(), phone: "", role: "membre", status, position, person_id: null, left_balance: null,
    created_at: "2026-09-01T00:00:00Z" });
  const r = (id: string, membre: string, status: Remise["status"], round = 1): Remise => ({
    id, cycle_id: "c", round, membership_id: membre, amount_expected: 20000, amount: status === "remis" ? 20000 : null,
    status, paid_on: status === "remis" ? "2026-10-30" : null });

  it("deplacer : monte, descend, ignore les bords", () => {
    expect(deplacer(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(deplacer(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    const l = ["a", "b"];
    expect(deplacer(l, 0, -1)).toBe(l);
    expect(deplacer(l, 1, 1)).toBe(l);
  });

  it("etatTour : ordre par position, retirés exclus, servis et prévus du tour courant seulement", () => {
    const e = etatTour([m("c", 3), m("a", 1), m("x", 2, "retire"), m("b", 2, "invite")],
      [r("r1", "a", "remis"), r("r2", "b", "prevu"), r("r0", "c", "remis", 0)], 1);
    expect(e.lignes.map((l) => l.membre.id)).toEqual(["a", "b", "c"]);
    expect(e.lignes.map((l) => [Boolean(l.servi), Boolean(l.prevu)])).toEqual([[true, false], [false, true], [false, false]]);
    expect(e.aRemettre.map((x) => x.id)).toEqual(["r2"]);
    expect(e.termine).toBe(false);
  });

  it("etatTour : terminé quand chaque membre non retiré (invités compris) a reçu sa part", () => {
    const membres = [m("a", 1), m("b", 2, "invite"), m("x", 3, "retire")];
    expect(etatTour(membres, [r("r1", "a", "remis")], 1).termine).toBe(false);
    expect(etatTour(membres, [r("r1", "a", "remis"), r("r2", "b", "remis")], 1).termine).toBe(true);
    expect(etatTour([], [], 1).termine).toBe(false);
  });

  it("montantPropose : collecté ÷ k, sinon le montant attendu", () => {
    expect(montantPropose(r("r", "a", "prevu"), 15000, 2)).toBe(7500);
    expect(montantPropose(r("r", "a", "prevu"), 5001, 2)).toBe(2500);
    expect(montantPropose(r("r", "a", "prevu"), null, 1)).toBe(20000);
  });
});
