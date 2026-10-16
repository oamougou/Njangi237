import { describe, expect, it } from "vitest";
import { estimerTour } from "./tours";
import type { Cycle, OrdreTour } from "./types";

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
