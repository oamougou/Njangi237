// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletTours } from "./OngletTours";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";
import type { VueGroupe } from "../../lib/types";

afterEach(cleanup);
const ordre = () => within(screen.getByRole("list", { name: "Ordre des tours" })).getAllByRole("listitem").map((li) => li.textContent);
const nonVerrouille = (): VueGroupe => {
  const v = vueTest();
  return { ...v, groupe: { ...v.groupe, order_locked: false }, cycles: [], paiements: [], remises: [] };
};

describe("onglet Tours", () => {
  it("avant verrouillage : monter un membre puis enregistrer l'ordre", async () => {
    const api = fauxApi(); const recharger = vi.fn();
    render(<OngletTours api={api} vue={nonVerrouille()} recharger={recharger} />);
    expect((screen.getByRole("button", { name: "Enregistrer l'ordre" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Monter Bob" }));
    expect(ordre()[1]).toContain("Bob");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer l'ordre" }));
    expect(api.ordonnerTours).toHaveBeenCalledWith("g1", ["m-tina", "m-bob", "m-alice", "m-ines"]);
    expect(recharger).toHaveBeenCalled();
  });

  it("tirage au sort : confirmation, puis résultat affiché", async () => {
    const api = fauxApi();
    render(<OngletTours api={api} vue={nonVerrouille()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Tirer au sort" }));
    expect(api.tirerAuSort).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("dialog", { name: "Tirer au sort l'ordre ?" })).getByRole("button", { name: "Tirer au sort" }));
    expect(api.tirerAuSort).toHaveBeenCalledWith("g1");
    expect(await screen.findByText("Ordre tiré au sort : 1. Bob, 2. Tina, 3. Ines, 4. Alice")).toBeTruthy();
  });

  it("après verrouillage : pas de réglage, bénéficiaire affiché, échange entre membres non servis", async () => {
    const api = fauxApi();
    const v = vueTest();
    v.remises.push({ id: "r-sep", cycle_id: "c-sep", round: 1, membership_id: "m-bob", amount_expected: 20000, amount: 20000,
      status: "remis", paid_on: "2026-09-30" });
    render(<OngletTours api={api} vue={v} recharger={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Monter Bob" })).toBeNull();
    expect(ordre()[0]).toContain("Bénéficiaire · Octobre 2026");
    expect(ordre()[2]).toContain("A reçu sa part");
    await userEvent.click(screen.getByRole("button", { name: "Échanger deux tours" }));
    const premier = screen.getByLabelText("Premier membre") as HTMLSelectElement;
    expect([...premier.options].map((o) => o.text)).not.toContain("Bob");   // déjà servi
    await userEvent.selectOptions(premier, "m-alice");
    await userEvent.selectOptions(screen.getByLabelText("Second membre"), "m-ines");
    await userEvent.click(screen.getByRole("button", { name: "Échanger" }));
    expect(api.echangerTours).toHaveBeenCalledWith("m-alice", "m-ines");
  });

  it("remise : montant proposé, référence exigée pour MoMo, écart affiché", async () => {
    const api = fauxApi();
    api.enregistrerRemise.mockResolvedValueOnce({ ecart: -15000 });
    render(<OngletTours api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Remettre la cagnotte à Tina" }));
    expect((screen.getByLabelText("Montant remis (FCFA)") as HTMLInputElement).value).toBe("5000");   // collecté 5 000 ÷ 1
    await userEvent.selectOptions(screen.getByLabelText("Moyen"), "mtn_momo");
    const valider = screen.getByRole("button", { name: "Enregistrer la remise" }) as HTMLButtonElement;
    expect(valider.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Référence de la transaction"), "MP9");
    await userEvent.click(valider);
    expect(api.enregistrerRemise).toHaveBeenCalledWith("r-oct", 5000, "mtn_momo", "MP9");
    expect(await screen.findByText(/Cagnotte remise à Tina : 5 000 FCFA\. Écart avec le montant attendu : −15 000 FCFA/)).toBeTruthy();
  });

  it("remplacer le bénéficiaire par un membre non servi", async () => {
    const api = fauxApi();
    render(<OngletTours api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Remplacer Tina" }));
    await userEvent.selectOptions(screen.getByLabelText("Nouveau bénéficiaire"), "m-bob");
    await userEvent.click(screen.getByRole("button", { name: "Confirmer le remplacement" }));
    expect(api.remplacerBeneficiaire).toHaveBeenCalledWith("r-oct", "m-bob");
  });

  it("tour terminé : nouveau tour après confirmation", async () => {
    const api = fauxApi();
    const v = vueTest();
    v.cycles = [{ ...v.cycles[0]!, status: "clos", closed_at: "2026-10-30T20:00:00Z" }];
    v.remises = v.membres.map((m, i) => ({ id: `r${i}`, cycle_id: "c-oct", round: 1, membership_id: m.id, amount_expected: 20000,
      amount: 20000, status: "remis" as const, paid_on: "2026-10-30" }));
    render(<OngletTours api={api} vue={v} recharger={vi.fn()} />);
    expect(screen.getByText("Tour 1 terminé 🎉")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Commencer le tour 2" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Commencer le tour 2 ?" })).getByRole("button", { name: "Commencer" }));
    expect(api.nouveauTour).toHaveBeenCalledWith("g1");
  });

  it("refus de la base : message affiché", async () => {
    const api = fauxApi();
    api.ordonnerTours.mockRejectedValueOnce(new Error("L'ordre est verrouillé : utilisez l'échange de tours"));
    render(<OngletTours api={api} vue={nonVerrouille()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Descendre Tina" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer l'ordre" }));
    expect((await screen.findByRole("alert")).textContent).toContain("verrouillé");
  });

  it("tour terminé mais cycle encore ouvert : nouveau tour impossible tant que le cycle n'est pas clos", () => {
    const v = vueTest();
    v.remises = v.membres.map((m, i) => ({ id: `r${i}`, cycle_id: "c-oct", round: 1, membership_id: m.id, amount_expected: 20000,
      amount: 20000, status: "remis" as const, paid_on: "2026-10-30" }));
    render(<OngletTours api={fauxApi()} vue={v} recharger={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Commencer le tour 2" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Clôturez d'abord le cycle en cours (onglet Cycle).")).toBeTruthy();
  });

  it("ordre en cours de réglage puis changement par un autre trésorier : pas de plantage, ordre réel affiché", async () => {
    const api = fauxApi();
    const { rerender } = render(<OngletTours api={api} vue={nonVerrouille()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Monter Bob" }));
    const sansAlice = nonVerrouille();
    sansAlice.membres = sansAlice.membres.map((m) => (m.id === "m-alice" ? { ...m, status: "retire" as const } : m));
    rerender(<OngletTours api={api} vue={sansAlice} recharger={vi.fn()} />);
    expect(ordre().map((t) => t!.replace(/[↑↓]/g, ""))).toEqual(["1. Tina", "2. Bob", "3. Ines"]);
    expect((screen.getByRole("button", { name: "Enregistrer l'ordre" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Monter Bob" }));
    rerender(<OngletTours api={api} vue={vueTest()} recharger={vi.fn()} />);   // un cycle a été ouvert : ordre verrouillé
    expect(screen.queryByRole("button", { name: /^Monter/ })).toBeNull();
    expect(ordre()[1]).toContain("Alice");
  });

  it("téléphone : le formulaire de remise et le remplacement s'ouvrent dans la carte du bénéficiaire, le succès est annoncé", async () => {
    const api = fauxApi();
    render(<OngletTours api={api} vue={vueTest()} recharger={vi.fn()} />);
    const carte = () => screen.getByRole("button", { name: "Remplacer Tina" }).closest("li")!;
    await userEvent.click(screen.getByRole("button", { name: "Remettre la cagnotte à Tina" }));
    expect(within(carte()).getByLabelText("Montant remis (FCFA)")).toBeTruthy();
    await userEvent.click(within(carte()).getByRole("button", { name: "Enregistrer la remise" }));
    expect((await screen.findByRole("status")).textContent).toContain("Cagnotte remise à Tina");
    await userEvent.click(screen.getByRole("button", { name: "Remplacer Tina" }));
    expect(within(carte()).getByLabelText("Nouveau bénéficiaire")).toBeTruthy();
  });
});
