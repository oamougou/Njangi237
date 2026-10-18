// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fauxApi } from "../test/fauxApi";
import { Connexion } from "./Connexion";

afterEach(cleanup);

describe("Connexion", () => {
  it("propose la démo et le lien vers la v1", async () => {
    const onDemo = vi.fn();
    render(<Connexion api={fauxApi()} onConnecte={vi.fn()} onDemo={onDemo} />);
    await userEvent.click(screen.getByRole("button", { name: "Essayer la démo" }));
    expect(onDemo).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /ancienne version/ }).getAttribute("href")).toBe("v1/");
  });
});
