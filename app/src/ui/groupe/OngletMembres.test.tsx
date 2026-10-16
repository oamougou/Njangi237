// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletMembres } from "./OngletMembres";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";

afterEach(cleanup);

describe("onglet Membres", () => {
  it("liste les membres avec numéro, rôle et statut", () => {
    render(<OngletMembres api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    expect(screen.getByText("6 90 00 00 04")).toBeTruthy();
    expect(screen.getByText("Trésorier")).toBeTruthy();
    expect(screen.getByText(/Invitation en attente/)).toBeTruthy();
  });

  it("ajouter un membre puis l'inviter par WhatsApp", async () => {
    const api = fauxApi(); const recharger = vi.fn();
    render(<OngletMembres api={api} vue={vueTest()} recharger={recharger} />);
    await userEvent.type(screen.getByLabelText("Nom"), "Jean");
    await userEvent.type(screen.getByLabelText("Numéro"), "+237 677 00 00 01");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter et inviter" }));
    expect(api.ajouterMembre).toHaveBeenCalledWith("g1", "Jean", "+237 677 00 00 01");
    expect(api.inviter).toHaveBeenCalledWith("m-nouveau", "invitation");
    expect(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toContain("wa.me");
    expect(recharger).toHaveBeenCalled();
  });

  it("ajout : l'erreur de la base est affichée", async () => {
    const api = fauxApi();
    api.ajouterMembre.mockRejectedValueOnce(new Error("Ce numéro est déjà dans le groupe"));
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Nom"), "Bob bis");
    await userEvent.type(screen.getByLabelText("Numéro"), "690000004");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter et inviter" }));
    expect(screen.getByText("Ce numéro est déjà dans le groupe")).toBeTruthy();
    expect(api.inviter).not.toHaveBeenCalled();
  });

  it("renvoyer l'invitation d'un invité, nouveau PIN pour un membre actif", async () => {
    const api = fauxApi();
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Renvoyer l'invitation à Ines" }));
    expect(api.inviter).toHaveBeenLastCalledWith("m-ines", "invitation");
    await userEvent.click(screen.getByRole("button", { name: "Lien nouveau PIN pour Bob" }));
    expect(api.inviter).toHaveBeenLastCalledWith("m-bob", "reinitialisation");
  });

  it("nommer trésorier", async () => {
    const api = fauxApi();
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Nommer Alice trésorier" }));
    expect(api.changerRole).toHaveBeenCalledWith("m-alice", "tresorier");
  });

  it("retrait avec aperçu de ce qui reste dû", async () => {
    const api = fauxApi();
    api.apercuRetrait.mockResolvedValueOnce({ deja_servi: true, cycles_restants: 3, montant_restant: 15000, dettes: 5000 });
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Retirer Bob" }));
    expect(api.apercuRetrait).toHaveBeenCalledWith("m-bob");
    const dialogue = await screen.findByRole("dialog", { name: "Retirer Bob" });
    expect(dialogue.textContent).toContain("déjà reçu sa part");
    expect(dialogue.textContent).toContain("15 000 FCFA");
    expect(dialogue.textContent).toContain("5 000 FCFA");
    await userEvent.click(screen.getByRole("button", { name: "Oui, retirer" }));
    expect(api.retirerMembre).toHaveBeenCalledWith("m-bob");
  });
});
