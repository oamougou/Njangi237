// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fauxApi } from "../test/fauxApi";
import { adminAbonnementsTest } from "../test/donnees";
import { AdminAbonnements } from "./AdminAbonnements";

afterEach(cleanup);

describe("AdminAbonnements", () => {
  it("demande : accepter, ou refuser avec un motif", async () => {
    const api = fauxApi();
    render(<AdminAbonnements api={api} />);
    const demande = await screen.findByRole("article", { name: "Demande de Tontine des amis" });
    expect(within(demande).getByText(/MP77/)).toBeTruthy();
    const refuser = within(demande).getByRole("button", { name: "Refuser" }) as HTMLButtonElement;
    expect(refuser.disabled).toBe(true);
    await userEvent.type(within(demande).getByLabelText("Motif du refus"), "Référence introuvable");
    await userEvent.click(refuser);
    expect(api.refuserDemande).toHaveBeenCalledWith("d1", "Référence introuvable");
    await userEvent.click(within(demande).getByRole("button", { name: "Accepter" }));
    expect(api.accepterDemande).toHaveBeenCalledWith("d1", []);
  });
  it("Association : jusqu'à 4 autres groupes cochés à l'acceptation", async () => {
    const api = fauxApi();
    const v = adminAbonnementsTest();
    api.adminAbonnements.mockResolvedValue({ ...v, demandes: [{ ...v.demandes[0], offre: "association", montant: 7500 }] });
    render(<AdminAbonnements api={api} />);
    const demande = await screen.findByRole("article", { name: "Demande de Tontine des amis" });
    await userEvent.click(within(demande).getByLabelText("LE BON WEEKEND"));
    await userEvent.click(within(demande).getByRole("button", { name: "Accepter" }));
    expect(api.accepterDemande).toHaveBeenCalledWith("d1", ["g2"]);
  });
  it("groupes : offre, compteur et bascule du prix de lancement", async () => {
    const api = fauxApi();
    render(<AdminAbonnements api={api} />);
    expect(await screen.findByText("Prix de lancement : 1 / 50")).toBeTruthy();
    await userEvent.click(screen.getByLabelText("Prix de lancement pour Tontine des amis"));
    expect(api.changerPrixLancement).toHaveBeenCalledWith("g1", true);
  });
  it("Pilote, Association et numéros de paiement", async () => {
    const api = fauxApi();
    render(<AdminAbonnements api={api} />);
    await screen.findByText("Prix de lancement : 1 / 50");
    await userEvent.selectOptions(screen.getByLabelText("Groupe pour l'offre Pilote"), "g1");
    await userEvent.click(screen.getByRole("button", { name: "Attribuer l'offre Pilote" }));
    expect(api.attribuerPilote).toHaveBeenCalledWith("g1", "2027-01-31");
    const asso = screen.getByRole("group", { name: "Groupes de l'offre Association" });
    await userEvent.click(within(asso).getByLabelText("Tontine des amis"));
    await userEvent.click(within(asso).getByLabelText("LE BON WEEKEND"));
    await userEvent.click(screen.getByRole("button", { name: "Créer l'offre Association" }));
    expect(api.creerAssociation).toHaveBeenCalledWith(["g1", "g2"], 12);
    const orange = screen.getByLabelText("Numéro Orange Money");
    await userEvent.type(orange, "699000002");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les numéros" }));
    expect(api.reglerPaiement).toHaveBeenCalledWith("677000001", "699000002", "Olivier A.");
  });
});
