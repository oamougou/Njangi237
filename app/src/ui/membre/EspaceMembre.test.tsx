// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EspaceMembre } from "./EspaceMembre";
import { fauxApi } from "../../test/fauxApi";
import { vueMembreTest } from "../../test/donnees";
import { lireFile, mettreEnFile, stockageMemoire } from "../../lib/horsLigne";
import { ErreurReseau } from "../../lib/erreurs";
import type { VueMembre } from "../../lib/types";

afterEach(cleanup);
const afficher = (vue: VueMembre = vueMembreTest(), api = fauxApi(), stockage = stockageMemoire(), personId = "u-alice") => {
  api.chargerVueMembre.mockResolvedValue(vue);
  render(<EspaceMembre api={api} groupId="g1" personId={personId} stockage={stockage} />);
  return { api, stockage };
};
const cycle = () => screen.getByRole("region", { name: "Cycle en cours" });

describe("espace membre", () => {
  it("cycle en cours à payer, bénéficiaire, taux du groupe", async () => {
    afficher();
    expect(await within(await screen.findByRole("region", { name: "Cycle en cours" })).findByText("Octobre 2026")).toBeTruthy();
    expect(cycle().textContent).toContain("À payer : 5 000 FCFA");
    expect(cycle().textContent).toContain("Bénéficiaire : Tina");
    expect(cycle().textContent).toContain("25 %");
  });

  it("déclarer MoMo : la référence est obligatoire, puis envoi avec un identifiant", async () => {
    const { api } = afficher();
    await userEvent.click(await screen.findByRole("button", { name: "Déclarer mon paiement" }));
    const envoyer = screen.getByRole("button", { name: "Envoyer la déclaration" });
    expect((screen.getByLabelText("Montant (FCFA)") as HTMLInputElement).value).toBe("5000");
    expect((envoyer as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Référence de la transaction"), "MP240912.1234");
    await userEvent.click(envoyer);
    const d = api.declarerPaiement.mock.calls[0][0];
    expect(d).toMatchObject({ groupId: "g1", cycleId: "c-oct", montant: 5000, moyen: "mtn_momo", reference: "MP240912.1234", detteId: null });
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("hors ligne : la déclaration est mise en file et l'écran l'indique", async () => {
    const api = fauxApi(); api.declarerPaiement.mockRejectedValueOnce(new ErreurReseau());
    const { stockage } = afficher(vueMembreTest(), api);
    await userEvent.click(await screen.findByRole("button", { name: "Déclarer mon paiement" }));
    await userEvent.selectOptions(screen.getByLabelText("Moyen de paiement"), "especes");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la déclaration" }));
    expect(lireFile(stockage, "u-alice").map((e) => e.declaration.moyen)).toEqual(["especes"]);
    expect(await screen.findByText(/envoyée automatiquement au retour du réseau/)).toBeTruthy();
    expect(cycle().textContent).toContain("En attente d'envoi");
    expect(screen.queryByRole("button", { name: "Déclarer mon paiement" })).toBeNull();
  });

  it("refus de la base : message affiché, rien en file", async () => {
    const api = fauxApi(); api.declarerPaiement.mockRejectedValueOnce(new Error("Ce cycle est clos"));
    const { stockage } = afficher(vueMembreTest(), api);
    await userEvent.click(await screen.findByRole("button", { name: "Déclarer mon paiement" }));
    await userEvent.selectOptions(screen.getByLabelText("Moyen de paiement"), "especes");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la déclaration" }));
    expect(await screen.findByText("Ce cycle est clos")).toBeTruthy();
    expect(lireFile(stockage, "u-alice")).toEqual([]);
  });

  it("en attente de validation, puis contesté avec motif et nouvelle déclaration possible", async () => {
    const vue = vueMembreTest();
    vue.paiements = [{ id: "p1", cycle_id: "c-oct", membership_id: "m-alice", debt_id: null, amount: 5000, method: "mtn_momo",
      reference: "MP1", paid_on: "2026-10-05", status: "declare", contest_reason: null, created_at: "2026-10-05T10:00:00Z" }];
    afficher(vue);
    expect(await within(await screen.findByRole("region", { name: "Cycle en cours" })).findByText(/En attente de validation/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Déclarer mon paiement" })).toBeNull();
    cleanup();
    vue.paiements[0] = { ...vue.paiements[0], status: "conteste", contest_reason: "Référence introuvable chez MTN" };
    afficher(vue);
    expect(await screen.findByText(/Référence introuvable chez MTN/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Déclarer mon paiement" })).toBeTruthy();
  });

  it("arrivé après l'ouverture : pas concerné, pas de bouton", async () => {
    const vue = vueMembreTest(); vue.moi = { ...vue.moi, created_at: "2026-10-20T00:00:00Z" };
    afficher(vue);
    expect(await screen.findByText(/rien à payer pour ce cycle/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Déclarer mon paiement" })).toBeNull();
  });

  it("dette : régler le montant entier", async () => {
    const { api } = afficher();
    const dettes = await screen.findByRole("region", { name: "Mes dettes" });
    expect(dettes.textContent).toContain("Septembre 2026");
    await userEvent.click(within(dettes).getByRole("button", { name: "Régler la dette de Septembre 2026" }));
    expect((screen.getByLabelText("Montant (FCFA)") as HTMLInputElement).readOnly).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText("Moyen de paiement"), "orange_money");
    await userEvent.type(screen.getByLabelText("Référence de la transaction"), "OM55");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la déclaration" }));
    expect(api.declarerPaiement.mock.calls[0][0]).toMatchObject({ cycleId: "c-sep", montant: 5000, detteId: "d-alice", moyen: "orange_money" });
  });

  it("ordre des tours : ma ligne en évidence, servi et bénéficiaire du cycle signalés, date estimée", async () => {
    afficher();
    const tours = await screen.findByRole("region", { name: "Ordre des tours" });
    const moi = within(tours).getByText("Alice").closest("li")!;
    expect(moi.className).toContain("moi");
    expect(within(tours).getByText("Bob").closest("li")!.textContent).toContain("a reçu");
    expect(within(tours).getByText("Tina").closest("li")!.textContent).toContain("ce cycle");
    expect(tours.textContent).toMatch(/Votre tour : dans 2 cycles/);
  });

  it("historique de mes paiements", async () => {
    const vue = vueMembreTest();
    vue.paiements = [{ id: "p0", cycle_id: "c-sep", membership_id: "m-alice", debt_id: null, amount: 2000, method: "especes",
      reference: null, paid_on: "2026-09-10", status: "valide", contest_reason: null, created_at: "2026-09-10T10:00:00Z" }];
    afficher(vue);
    const histo = await screen.findByRole("region", { name: "Mes paiements" });
    expect(histo.textContent).toContain("Septembre 2026");
    expect(histo.textContent).toContain("2 000 FCFA");
    expect(histo.textContent).toContain("Validé");
  });

  it("téléphone partagé : la déclaration en attente d'une autre personne n'apparaît pas", async () => {
    const stockage = stockageMemoire();
    mettreEnFile(stockage, "u-tina", { id: "x", groupId: "g1", cycleId: "c-oct", montant: 5000, moyen: "especes", reference: null, date: "2026-10-16", detteId: null });
    afficher(vueMembreTest(), fauxApi(), stockage, "u-alice");
    expect(await screen.findByRole("button", { name: "Déclarer mon paiement" })).toBeTruthy();
    expect(cycle().textContent).not.toContain("En attente d'envoi");
  });

  it("déclaration refusée en différé : motif affiché, puis « Compris » la retire", async () => {
    const stockage = stockageMemoire();
    stockage.ecrire("njangi.file.u-alice", JSON.stringify([{ etat: "rejete", erreur: "Ce cycle est clos",
      declaration: { id: "x", groupId: "g1", cycleId: "c-sep", montant: 5000, moyen: "especes", reference: null, date: "2026-09-20", detteId: null } }]));
    afficher(vueMembreTest(), fauxApi(), stockage);
    expect(await screen.findByText(/refusée : Ce cycle est clos/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Compris" }));
    expect(screen.queryByText(/refusée/)).toBeNull();
    expect(lireFile(stockage, "u-alice")).toEqual([]);
  });

  it("hors ligne : « Réessayer » renvoie la file sans attendre l'événement réseau", async () => {
    const api = fauxApi(); const stockage = stockageMemoire();
    api.chargerVueMembre.mockRejectedValueOnce(new ErreurReseau());
    stockage.ecrire("njangi.vue.u-alice.membre.g1", JSON.stringify({ donnees: vueMembreTest(), le: "2026-10-16T10:00:00Z" }));
    mettreEnFile(stockage, "u-alice", { id: "x", groupId: "g1", cycleId: "c-oct", montant: 5000, moyen: "especes", reference: null, date: "2026-10-16", detteId: null });
    render(<EspaceMembre api={api} groupId="g1" personId="u-alice" stockage={stockage} />);
    await userEvent.click(await screen.findByRole("button", { name: "Réessayer" }));
    await vi.waitFor(() => expect(api.declarerPaiement).toHaveBeenCalledTimes(1));
    expect(lireFile(stockage, "u-alice")).toEqual([]);
  });

  it("ni réseau ni données gardées : le dire au lieu de « Chargement… » sans fin", async () => {
    const api = fauxApi(); api.chargerVueMembre.mockRejectedValue(new ErreurReseau());
    render(<EspaceMembre api={api} groupId="g1" personId="u-alice" stockage={stockageMemoire()} />);
    expect(await screen.findByText(/aucune donnée enregistrée sur ce téléphone/)).toBeTruthy();
  });

  it("aucun cycle ouvert : pas de « ce cycle » dans l'estimation du tour", async () => {
    const vue = vueMembreTest();
    vue.cycles = vue.cycles.map((c) => ({ ...c, status: "clos" as const }));
    vue.ordre = vue.ordre.map((o) => ({ ...o, prevu: false }));
    afficher(vue);
    const tours = await screen.findByRole("region", { name: "Ordre des tours" });
    expect(tours.textContent).not.toContain("ce cycle !");
  });
});
