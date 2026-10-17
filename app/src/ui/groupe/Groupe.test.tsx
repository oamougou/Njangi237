// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Groupe } from "./Groupe";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";
import { memoriser, stockageMemoire } from "../../lib/horsLigne";
import { ErreurReseau } from "../../lib/erreurs";

afterEach(cleanup);

describe("espace du groupe", () => {
  it("un membre non trésorier ne voit aucune action de trésorier", async () => {
    const vue = { ...vueTest(), role: "membre" as const };
    render(<Groupe api={fauxApi(vue)} id="g1" onglet="cycle" personId="u-tina" stockage={stockageMemoire()} />);
    expect(await screen.findByRole("region", { name: "Cycle en cours" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clore le cycle" })).toBeNull();
  });

  it("un rechargement raté garde l'écran, affiche l'erreur et propose de réessayer", async () => {
    const api = fauxApi();
    render(<Groupe api={api} id="g1" onglet="cycle" personId="u-tina" stockage={stockageMemoire()} />);
    await screen.findByText("Octobre 2026");
    api.chargerGroupe.mockRejectedValueOnce(new Error("Réseau indisponible"));
    await userEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    expect(await screen.findByText(/Réseau indisponible/)).toBeTruthy();
    expect(screen.getByText("Octobre 2026")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(api.chargerGroupe).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(/Réseau indisponible/)).toBeNull();
  });
  it("trésorier hors ligne : dernière vue affichée, actions désactivées", async () => {
    const stockage = stockageMemoire();
    const api = fauxApi();
    const { unmount } = render(<Groupe api={api} id="g1" onglet="cycle" personId="u-tina" stockage={stockage} />);
    await screen.findByText("Octobre 2026");
    unmount();
    api.chargerGroupe.mockRejectedValue(new ErreurReseau());
    render(<Groupe api={api} id="g1" onglet="cycle" personId="u-tina" stockage={stockage} />);
    expect(await screen.findByText(/Hors ligne/)).toBeTruthy();
    expect(screen.getByText("Octobre 2026")).toBeTruthy();
    // Désactivé par le fieldset parent : la propriété disabled du bouton reste fausse, :disabled est vrai
    expect(screen.getByRole("button", { name: "Valider le paiement d'Alice" }).matches(":disabled")).toBe(true);
  });

  it("temps réel : l'écran du trésorier s'abonne aux changements du groupe", async () => {
    const api = fauxApi();
    render(<Groupe api={api} id="g1" onglet="cycle" personId="u-tina" stockage={stockageMemoire()} />);
    await screen.findByText("Octobre 2026");
    expect(api.abonner).toHaveBeenCalledWith(["g1"], expect.any(Function));
  });
  it("trésorier d'une tontine : quatre onglets ; Tours masqué pour une cotisation", async () => {
    const api = fauxApi();
    render(<Groupe api={api} id="g1" onglet="tours" personId="u-tina" stockage={stockageMemoire()} />);
    expect(await screen.findByRole("list", { name: "Ordre des tours" })).toBeTruthy();
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(expect.arrayContaining(["Cycle", "Membres", "Tours", "Journal"]));
    cleanup();
    const v = vueTest();
    render(<Groupe api={fauxApi({ ...v, groupe: { ...v.groupe, type: "cotisation" } })} id="g1" onglet="journal" personId="u-tina"
      stockage={stockageMemoire()} />);
    expect(await screen.findByText("Aucune action enregistrée pour l'instant.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Tours" })).toBeNull();
  });

  it("vue gardée par une version précédente (sans remises) : Tours et Journal s'affichent sans planter", async () => {
    const stockage = stockageMemoire();
    const { remises: _r, ...ancienne } = vueTest();
    const { order_locked: _o, ...groupe } = ancienne.groupe;
    memoriser(stockage, "u-tina.groupe.g1", { ...ancienne, groupe });
    const api = fauxApi();
    api.chargerGroupe.mockReturnValue(new Promise(() => {}));   // réseau qui ne répond pas
    render(<Groupe api={api} id="g1" onglet="tours" personId="u-tina" stockage={stockage} />);
    expect(await screen.findByRole("list", { name: "Ordre des tours" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Monter/ })).toBeNull();   // ordre inconnu : traité comme verrouillé
    cleanup();
    render(<Groupe api={api} id="g1" onglet="journal" personId="u-tina" stockage={stockage} />);
    expect(await screen.findByText("Aucune action enregistrée pour l'instant.")).toBeTruthy();
  });
});
