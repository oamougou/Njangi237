// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletMembres } from "./OngletMembres";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";
import type { ContactBrut } from "../../lib/contacts";

/** Simule le sélecteur de contacts de Chrome Android. */
function carnet(contacts: ContactBrut[] | Error) {
  const select = vi.fn(async () => { if (contacts instanceof Error) throw contacts; return contacts; });
  Object.defineProperty(navigator, "contacts", { value: { select }, configurable: true });
  Object.defineProperty(window, "ContactsManager", { value: function ContactsManager() {}, configurable: true });
  return select;
}
afterEach(() => {
  cleanup();
  delete (navigator as unknown as Record<string, unknown>).contacts;
  delete (window as unknown as Record<string, unknown>).ContactsManager;
});

describe("import depuis les contacts", () => {
  it("bouton masqué quand le téléphone ne le permet pas (iPhone, ordinateur)", () => {
    render(<OngletMembres api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Importer depuis les contacts" })).toBeNull();
  });

  it("ajoute les contacts valides, écarte les autres, prépare une invitation par membre", async () => {
    const select = carnet([
      { name: ["Jean"], tel: ["+237 677 00 00 01"] },
      { name: ["Paul"], tel: ["1234"] },
      { name: ["Bob"], tel: ["690000004"] },
      { name: ["Marie"], tel: ["677000003"] },
    ]);
    const api = fauxApi(); const recharger = vi.fn();
    api.ajouterMembre.mockImplementation(async (_g: string, nom: string) => `m-${nom}`);
    api.inviter.mockImplementation(async (id: string) => ({ lien: `L-${id}`, whatsapp: `https://wa.me/x?text=${id}`, expire: "2026-10-23T10:00:00Z", nom: id }));
    render(<OngletMembres api={api} vue={vueTest()} recharger={recharger} />);
    await userEvent.click(screen.getByRole("button", { name: "Importer depuis les contacts" }));

    expect(select).toHaveBeenCalledWith(["name", "tel"], { multiple: true });
    expect(api.ajouterMembre.mock.calls).toEqual([["g1", "Jean", "237677000001"], ["g1", "Marie", "237677000003"]]);
    expect(api.inviter.mock.calls).toEqual([["m-Jean", "invitation"], ["m-Marie", "invitation"]]);
    const bilan = await screen.findByRole("region", { name: "Import des contacts" });
    expect(bilan.textContent).toContain("2 ajoutés");
    expect(bilan.textContent).toContain("2 ignorés");
    expect(bilan.textContent).toContain("Paul : numéro invalide");
    expect(bilan.textContent).toContain("Bob : déjà dans le groupe");
    expect(within(bilan).getByRole("link", { name: "Envoyer l'invitation à Jean sur WhatsApp" }).getAttribute("href")).toContain("m-Jean");
    expect(within(bilan).getByRole("link", { name: "Envoyer l'invitation à Marie sur WhatsApp" })).toBeTruthy();
    expect(recharger).toHaveBeenCalled();
  });

  it("un ajout refusé par la base n'arrête pas les suivants", async () => {
    carnet([{ name: ["Jean"], tel: ["677000001"] }, { name: ["Marie"], tel: ["677000003"] }]);
    const api = fauxApi();
    api.ajouterMembre.mockRejectedValueOnce(new Error("Nombre maximum de membres atteint (50)")).mockResolvedValueOnce("m-marie");
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Importer depuis les contacts" }));
    const bilan = await screen.findByRole("region", { name: "Import des contacts" });
    expect(bilan.textContent).toContain("1 ajouté");
    expect(bilan.textContent).toContain("Jean : Nombre maximum de membres atteint (50)");
    expect(api.inviter).toHaveBeenCalledWith("m-marie", "invitation");
  });

  it("sélection annulée : rien n'est ajouté", async () => {
    carnet(new Error("AbortError"));
    const api = fauxApi();
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Importer depuis les contacts" }));
    expect(api.ajouterMembre).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Import des contacts" })).toBeNull();
  });
});
