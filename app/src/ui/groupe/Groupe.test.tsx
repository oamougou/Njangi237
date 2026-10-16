// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Groupe } from "./Groupe";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";

afterEach(cleanup);

describe("espace du groupe", () => {
  it("un membre non trésorier ne voit aucune action de trésorier", async () => {
    const vue = { ...vueTest(), role: "membre" as const };
    render(<Groupe api={fauxApi(vue)} id="g1" onglet="cycle" />);
    expect(await screen.findByText(/espace membre arrive bientôt/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clore le cycle" })).toBeNull();
  });

  it("un rechargement raté garde l'écran, affiche l'erreur et propose de réessayer", async () => {
    const api = fauxApi();
    render(<Groupe api={api} id="g1" onglet="cycle" />);
    await screen.findByText("Octobre 2026");
    api.chargerGroupe.mockRejectedValueOnce(new Error("Réseau indisponible"));
    await userEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    expect(await screen.findByText(/Réseau indisponible/)).toBeTruthy();
    expect(screen.getByText("Octobre 2026")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(api.chargerGroupe).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(/Réseau indisponible/)).toBeNull();
  });
});
