// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BandeauDemo } from "./BandeauDemo";

afterEach(cleanup);

describe("BandeauDemo", () => {
  it("dit qui l'on est et propose l'autre profil", async () => {
    const onChanger = vi.fn();
    render(<BandeauDemo profil="tina" onChanger={onChanger} onReinitialiser={vi.fn()} onQuitter={vi.fn()} />);
    expect(screen.getByText(/Tina \(trésorière\)/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Passer en Alice (membre)" }));
    expect(onChanger).toHaveBeenCalled();
  });
  it("demande une confirmation avant de tout remettre à zéro", async () => {
    const onReinitialiser = vi.fn();
    render(<BandeauDemo profil="alice" onChanger={vi.fn()} onReinitialiser={onReinitialiser} />);
    await userEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    expect(onReinitialiser).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer : tout remettre à zéro" }));
    expect(onReinitialiser).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Quitter la démo" })).toBeNull();
  });
});
