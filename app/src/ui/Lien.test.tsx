// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Lien } from "./Lien";

afterEach(cleanup);
const envoi = { lien: "https://x/#/invitation/demo", whatsapp: "", expire: "2026-10-24T10:00:00Z", nom: "Inès" };

describe("Lien", () => {
  it("en démo : pas de bouton WhatsApp, un avertissement", () => {
    render(<Lien envoi={{ ...envoi, demo: true }} titre="Invitation" />);
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    expect(screen.getByText(/lien fictif/)).toBeTruthy();
  });
  it("en vrai : le bouton WhatsApp", () => {
    render(<Lien envoi={{ ...envoi, whatsapp: "https://wa.me/237690000011?text=x" }} titre="Invitation" />);
    expect(screen.getByRole("link", { name: "Envoyer à Inès sur WhatsApp" })).toBeTruthy();
  });
});
