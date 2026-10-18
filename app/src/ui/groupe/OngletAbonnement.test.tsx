// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fauxApi } from "../../test/fauxApi";
import { etatAbonnementTest } from "../../test/donnees";
import { OngletAbonnement } from "./OngletAbonnement";

afterEach(cleanup);

describe("OngletAbonnement", () => {
  it("montre l'offre, la limite, les prix et les numéros de paiement", async () => {
    render(<OngletAbonnement api={fauxApi()} groupId="g1" />);
    expect(await screen.findByText("Offre Essai gratuit")).toBeTruthy();
    expect(screen.getByText("4 membres sur 50")).toBeTruthy();
    expect(screen.getByText("677000001")).toBeTruthy();
    expect(screen.getByText("20 000 FCFA")).toBeTruthy();
  });
  it("envoie une demande ; la référence est obligatoire pour MoMo", async () => {
    const api = fauxApi();
    render(<OngletAbonnement api={api} groupId="g1" />);
    await screen.findByText("Offre Essai gratuit");
    const envoyer = screen.getByRole("button", { name: "Envoyer la demande" }) as HTMLButtonElement;
    expect(envoyer.disabled).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText("Durée"), "12");
    expect(screen.getByText(/Montant à payer/).textContent).toContain("20 000 FCFA");
    await userEvent.type(screen.getByLabelText("Référence de la transaction"), "MP123");
    await userEvent.click(envoyer);
    expect(api.demanderAbonnement).toHaveBeenCalledWith({ groupId: "g1", offre: "groupe", dureeMois: 12, moyen: "mtn_momo", reference: "MP123", precisions: null });
  });
  it("demande en attente : récapitulatif et annulation ; demande refusée : motif affiché", async () => {
    const api = fauxApi();
    const demande = { id: "d1", offre: "groupe" as const, duree_mois: 1 as const, montant: 2000, devise: "XAF" as const, moyen: "mtn_momo" as const,
      reference: "MP77", precisions: null, statut: "en_attente" as const, motif: null, created_at: "2026-10-18T09:00:00Z", traitee_le: null };
    api.etatAbonnement.mockResolvedValueOnce({ ...etatAbonnementTest(), demande });
    render(<OngletAbonnement api={api} groupId="g1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Annuler la demande" }));
    expect(api.annulerDemande).toHaveBeenCalledWith("d1");
    cleanup();
    api.etatAbonnement.mockResolvedValueOnce({ ...etatAbonnementTest(), demande: { ...demande, statut: "refusee", motif: "Référence introuvable" } });
    render(<OngletAbonnement api={api} groupId="g1" />);
    expect(await screen.findByText("Demande précédente refusée : Référence introuvable")).toBeTruthy();
  });
  it("démo : lecture seule, pas de formulaire", async () => {
    const api = fauxApi();
    api.etatAbonnement.mockResolvedValueOnce({ ...etatAbonnementTest(), offre: "groupe", fin: null, demo: true });
    render(<OngletAbonnement api={api} groupId="g1" />);
    expect(await screen.findByText(/Mode démo/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Envoyer la demande" })).toBeNull();
  });
});
