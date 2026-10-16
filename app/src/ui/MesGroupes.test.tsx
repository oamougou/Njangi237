// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MesGroupes } from "./MesGroupes";
import { fauxApi } from "../test/fauxApi";
import { stockageMemoire } from "../lib/horsLigne";

afterEach(cleanup);

describe("Mes groupes", () => {
  it("carte membre : à payer avec échéance ; carte trésorier : paiements à valider", async () => {
    const api = fauxApi();
    api.mesGroupes.mockResolvedValue([
      { membership_id: "m1", role: "membre", groupe: { id: "g1", name: "Tontine A", type: "tontine", amount: 5000, frequency: "mensuelle" },
        resume: { cycle: "Octobre 2026", echeance: "2026-10-30", montant: 5000, monEtat: "a_payer", aValider: 0 } },
      { membership_id: "m2", role: "tresorier", groupe: { id: "g2", name: "Cotisation B", type: "cotisation", amount: 2000, frequency: "mensuelle" },
        resume: { cycle: "Octobre 2026", echeance: null, montant: 2000, monEtat: "paye", aValider: 2 } },
    ]);
    render(<MesGroupes api={api} personId="u1" stockage={stockageMemoire()} />);
    expect(await screen.findByText("À payer : 5 000 FCFA avant le 30/10/2026")).toBeTruthy();
    expect(screen.getByText("2 paiements à valider")).toBeTruthy();
    expect(screen.getByText("Payé ✓")).toBeTruthy();
  });
});
