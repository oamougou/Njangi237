// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletCycle } from "./OngletCycle";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";

afterEach(cleanup);
const ligne = (nom: string) => screen.getByText(nom, { selector: "b" }).closest("li")!;

describe("onglet Cycle", () => {
  it("affiche le bilan et l'état de chaque membre", () => {
    render(<OngletCycle api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    expect(screen.getByText("Octobre 2026")).toBeTruthy();
    expect(screen.getByText("5 000 FCFA")).toBeTruthy();          // collecté
    expect(screen.getByText("25 %")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Cagnotte collectée" }).getAttribute("aria-valuenow")).toBe("25");
    expect(ligne("Tina").textContent).toContain("Payé");
    expect(ligne("Alice").textContent).toContain("À valider");
    expect(ligne("Bob").textContent).toContain("En retard");
  });

  it("valider une déclaration", async () => {
    const api = fauxApi(); const recharger = vi.fn();
    render(<OngletCycle api={api} vue={vueTest()} recharger={recharger} />);
    await userEvent.click(screen.getByRole("button", { name: "Valider le paiement d'Alice" }));
    expect(api.validerPaiement).toHaveBeenCalledWith("p-alice");
    expect(recharger).toHaveBeenCalled();
  });

  it("contester exige un motif", async () => {
    const api = fauxApi();
    render(<OngletCycle api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Contester le paiement d'Alice" }));
    const envoyer = screen.getByRole("button", { name: "Confirmer la contestation" });
    expect((envoyer as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Motif"), "Référence introuvable");
    await userEvent.click(envoyer);
    expect(api.contesterPaiement).toHaveBeenCalledWith("p-alice", "Référence introuvable");
  });

  it("espèces : montant proposé, un seul envoi même en cas de double clic", async () => {
    const api = fauxApi();
    let fini!: () => void;
    api.saisirEspeces.mockImplementation(() => new Promise<void>((r) => { fini = r; }));
    render(<OngletCycle api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Saisir des espèces pour Bob" }));
    const montant = screen.getByLabelText("Montant reçu (FCFA)") as HTMLInputElement;
    expect(montant.value).toBe("5000");
    const enregistrer = screen.getByRole("button", { name: "Enregistrer les espèces" });
    await userEvent.dblClick(enregistrer);
    expect(api.saisirEspeces).toHaveBeenCalledTimes(1);
    const [id, membre, cycle, somme] = api.saisirEspeces.mock.calls[0];
    expect([membre, cycle, somme]).toEqual(["m-bob", "c-oct", 5000]);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    fini();
  });

  it("relance : un retardataire par geste, puis plus personne", async () => {
    const ouvert = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<OngletCycle api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    const bouton = () => screen.getByRole("button", { name: /Relancer/ });
    await userEvent.click(bouton());
    expect(ouvert.mock.calls[0][0]).toContain("wa.me/237690000004");   // Bob
    expect(bouton().textContent).toContain("1 restant");
    await userEvent.click(bouton());
    expect(ouvert.mock.calls[1][0]).toContain("wa.me/237690000009");   // Ines
    expect(bouton().textContent).toBe("Relancer les retardataires");
    ouvert.mockRestore();
  });

  it("clôture bloquée tant qu'un paiement attend la validation", () => {
    render(<OngletCycle api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Clore le cycle" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/1 paiement à valider avant de clore/)).toBeTruthy();
  });

  it("clôture : confirmation avec le nombre de dettes, puis bilan", async () => {
    const vue = vueTest(); vue.paiements = vue.paiements.filter((p) => p.id !== "p-alice");
    const api = fauxApi(vue);
    render(<OngletCycle api={api} vue={vue} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Clore le cycle" }));
    expect(screen.getByText(/3 membres deviendront débiteurs/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Oui, clore" }));
    expect(api.cloreCycle).toHaveBeenCalledWith("c-oct");
  });

  it("aucun cycle ouvert : ouverture avec un libellé proposé", async () => {
    const vue = vueTest(); vue.cycles = []; vue.paiements = [];
    const api = fauxApi(vue);
    render(<OngletCycle api={api} vue={vue} recharger={vi.fn()} />);
    const libelle = screen.getByLabelText("Libellé du cycle") as HTMLInputElement;
    expect(libelle.value.length).toBeGreaterThan(3);
    await userEvent.clear(libelle); await userEvent.type(libelle, "Novembre 2026");
    await userEvent.click(screen.getByRole("button", { name: "Ouvrir le cycle" }));
    expect(api.ouvrirCycle).toHaveBeenCalledWith("g1", "Novembre 2026", null);
  });

  it("dettes : encaissement en espèces de la dette entière, après confirmation", async () => {
    const vue = vueTest();
    vue.cycles = [{ ...vue.cycles[0], id: "c-sep", label: "Septembre 2026", status: "clos", closed_at: "2026-09-30T20:00:00Z" }, ...vue.cycles];
    vue.dettes = [{ id: "d-bob", membership_id: "m-bob", cycle_id: "c-sep", amount: 5000, settled_at: null }];
    const api = fauxApi(vue);
    render(<OngletCycle api={api} vue={vue} recharger={vi.fn()} />);
    const dettes = screen.getByRole("region", { name: "Dettes à encaisser" });
    expect(within(dettes).getByText(/Septembre 2026/)).toBeTruthy();
    await userEvent.click(within(dettes).getByRole("button", { name: "Encaisser la dette de Bob" }));
    expect(api.saisirEspeces).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Encaisser la dette de Bob" }).textContent).toContain("5 000 FCFA");
    await userEvent.click(screen.getByRole("button", { name: "Oui, encaisser" }));
    const [, membre, cycle, somme, dette] = api.saisirEspeces.mock.calls[0];
    expect([membre, cycle, somme, dette]).toEqual(["m-bob", "c-sep", 5000, "d-bob"]);
  });

  it("dette déclarée par le membre : à valider, pas à encaisser", async () => {
    const vue = vueTest();
    vue.cycles = [{ ...vue.cycles[0], id: "c-sep", label: "Septembre 2026", status: "clos", closed_at: "2026-09-30T20:00:00Z" }, ...vue.cycles];
    vue.dettes = [{ id: "d-bob", membership_id: "m-bob", cycle_id: "c-sep", amount: 5000, settled_at: null }];
    vue.paiements.push({ id: "p-dette", cycle_id: "c-sep", membership_id: "m-bob", debt_id: "d-bob", amount: 5000, method: "orange_money",
      reference: "OM7", paid_on: "2026-10-12", status: "declare", contest_reason: null, created_at: "2026-10-12T09:00:00Z" });
    const api = fauxApi(vue);
    render(<OngletCycle api={api} vue={vue} recharger={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Encaisser la dette de Bob" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Valider le règlement de Bob" }));
    expect(api.validerPaiement).toHaveBeenCalledWith("p-dette");
  });

  it("membre arrivé après l'ouverture : ni relancé ni compté comme futur débiteur", async () => {
    const vue = vueTest();
    vue.membres = vue.membres.map((m) => (m.id === "m-ines" ? { ...m, created_at: "2026-10-10T00:00:00Z" } : m));
    vue.paiements = vue.paiements.map((p) => (p.id === "p-alice" ? { ...p, status: "valide" as const } : p));
    const ouvert = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<OngletCycle api={fauxApi(vue)} vue={vue} recharger={vi.fn()} />);
    expect(screen.getByText(/Pas concerné/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Relancer/ }));
    expect(ouvert).toHaveBeenCalledTimes(1);
    expect(ouvert.mock.calls[0][0]).toContain("wa.me/237690000004");
    expect(screen.getByRole("button", { name: /Relancer/ }).textContent).toBe("Relancer les retardataires");
    await userEvent.click(screen.getByRole("button", { name: "Clore le cycle" }));
    expect(screen.getByText(/1 membre deviendra débiteur/)).toBeTruthy();
    ouvert.mockRestore();
  });

  it("paiement partiel : pas de seconde saisie (refusée par la base), consigne affichée", () => {
    const vue = vueTest();
    vue.paiements.push({ id: "p-bob", cycle_id: "c-oct", membership_id: "m-bob", debt_id: null, amount: 3000, method: "especes",
      reference: null, paid_on: "2026-10-06", status: "valide", contest_reason: null, created_at: "2026-10-06T09:00:00Z" });
    render(<OngletCycle api={fauxApi(vue)} vue={vue} recharger={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Saisir des espèces pour Bob" })).toBeNull();
    expect(screen.getByText(/annulez ce paiement puis saisissez le montant total/)).toBeTruthy();
  });

  it("espèces : après un échec réseau, le nouvel essai réutilise le même identifiant", async () => {
    const api = fauxApi();
    api.saisirEspeces.mockRejectedValueOnce(new Error("Réseau indisponible"));
    render(<OngletCycle api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Saisir des espèces pour Bob" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les espèces" }));
    expect(screen.getAllByText("Réseau indisponible").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les espèces" }));
    expect(api.saisirEspeces).toHaveBeenCalledTimes(2);
    expect(api.saisirEspeces.mock.calls[1][0]).toBe(api.saisirEspeces.mock.calls[0][0]);
  });

  it("espèces : le bouton est désactivé pendant l'envoi", async () => {
    const api = fauxApi();
    let fini!: () => void;
    api.saisirEspeces.mockImplementation(() => new Promise<void>((r) => { fini = r; }));
    render(<OngletCycle api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Saisir des espèces pour Bob" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les espèces" }));
    expect((screen.getByRole("button", { name: "Enregistrer les espèces" }) as HTMLButtonElement).disabled).toBe(true);
    fini();
  });

  it("membre retiré avec une déclaration en attente : à valider, clôture bloquée", () => {
    const vue = vueTest();
    vue.membres = vue.membres.map((m) => (m.id === "m-ines" ? { ...m, status: "retire" as const } : m));
    vue.paiements.push({ id: "p-ines", cycle_id: "c-oct", membership_id: "m-ines", debt_id: null, amount: 5000, method: "mtn_momo",
      reference: "MP9", paid_on: "2026-10-07", status: "declare", contest_reason: null, created_at: "2026-10-07T09:00:00Z" });
    render(<OngletCycle api={fauxApi(vue)} vue={vue} recharger={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Valider le paiement d'Ines" })).toBeTruthy();
    expect(screen.getByText(/2 paiements à valider avant de clore/)).toBeTruthy();
  });
});
