// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Avatar, Barre, couleurAvatar, initiales, prenom } from "./Decor";

afterEach(cleanup);

describe("Avatar", () => {
  it("même groupe, même couleur ; couleurs prises dans la palette", () => {
    expect(couleurAvatar("g1")).toBe(couleurAvatar("g1"));
    const vues = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(couleurAvatar));
    expect(vues.size).toBeGreaterThan(1);
    for (const c of vues) expect(c).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("initiales : deux premiers mots, une lettre si un seul mot, ? si vide", () => {
    expect(initiales("LE BON WEEKEND")).toBe("LB");
    expect(initiales("groupe test")).toBe("GT");
    expect(initiales("Njangi")).toBe("N");
    expect(initiales("  ")).toBe("?");
  });

  it("est décoratif (caché aux lecteurs d'écran)", () => {
    const { container } = render(<Avatar id="g1" nom="Groupe test" />);
    const el = container.firstElementChild!;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.textContent).toBe("GT");
  });
});

describe("Barre", () => {
  it("expose sa valeur et se limite à 0–100 %", () => {
    render(<><Barre valeur={62} libelle="Cagnotte" /><Barre valeur={140} libelle="Trop" /><Barre valeur={-5} libelle="Rien" /></>);
    const [a, b, c] = screen.getAllByRole("progressbar");
    expect(a.getAttribute("aria-valuenow")).toBe("62");
    expect(a.getAttribute("aria-label")).toBe("Cagnotte");
    expect(b.getAttribute("aria-valuenow")).toBe("100");
    expect(c.getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("prenom", () => {
  it("premier mot avec majuscule", () => {
    expect(prenom("cathy")).toBe("Cathy");
    expect(prenom("olivier amougou")).toBe("Olivier");
    expect(prenom("")).toBe("");
  });
});
