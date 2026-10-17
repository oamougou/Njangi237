// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletJournal } from "./OngletJournal";
import { fauxApi } from "../../test/fauxApi";
import type { EntreeJournal } from "../../lib/types";

afterEach(cleanup);
const entree = (id: number, action = "cycle_ouvert", visible = true): EntreeJournal =>
  ({ id, action, details: { cycle: `C${id}` }, created_at: "2026-10-16T09:05:00Z", auteur: id % 2 ? "Tina" : null, visible });

describe("onglet Journal", () => {
  it("phrases lisibles, auteur, mention « visible des membres »", async () => {
    const api = fauxApi();
    api.lireJournal.mockResolvedValueOnce([entree(3), entree(2, "cycle_rouvert", false)]);
    render(<OngletJournal api={api} groupId="g1" />);
    expect(await screen.findByText("Cycle « C3 » ouvert")).toBeTruthy();
    expect(screen.getByText("Cycle « C2 » rouvert")).toBeTruthy();
    expect(screen.getByText(/Tina/)).toBeTruthy();
    expect(screen.getAllByText("Visible des membres")).toHaveLength(1);
    expect(api.lireJournal).toHaveBeenCalledWith("g1", undefined);
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull();
  });

  it("50 entrées : « Voir plus » charge la suite avant la dernière affichée", async () => {
    const api = fauxApi();
    api.lireJournal.mockResolvedValueOnce(Array.from({ length: 50 }, (_, i) => entree(100 - i)))
      .mockResolvedValueOnce([entree(10)]);
    render(<OngletJournal api={api} groupId="g1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Voir plus" }));
    expect(api.lireJournal).toHaveBeenLastCalledWith("g1", 51);
    expect(await screen.findByText("Cycle « C10 » ouvert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull();
  });

  it("journal vide, puis erreur de chargement", async () => {
    const api = fauxApi();
    render(<OngletJournal api={api} groupId="g1" />);
    expect(await screen.findByText("Aucune action enregistrée pour l'instant.")).toBeTruthy();
    cleanup();
    api.lireJournal.mockRejectedValueOnce(new Error("Pas de réseau : réessayez quand la connexion revient"));
    render(<OngletJournal api={api} groupId="g1" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Pas de réseau");
  });
});
