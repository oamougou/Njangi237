// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChampPin } from "./Champ";

afterEach(cleanup);

function PinTest() {
  const [v, setV] = useState("");
  return <ChampPin label="Choisissez un PIN (6 chiffres)" valeur={v} onChange={setV} />;
}

describe("ChampPin", () => {
  it("champ texte masqué, pas « password » : Safari n'y insère pas de mot de passe fort", () => {
    render(<PinTest />);
    const champ = screen.getByLabelText("Choisissez un PIN (6 chiffres)") as HTMLInputElement;
    expect(champ.type).toBe("text");
    expect(champ.inputMode).toBe("numeric");
    expect(champ.className).toContain("pin");
  });
  it("garde les seuls chiffres et dit combien il en manque", async () => {
    render(<PinTest />);
    expect(screen.getByText("0 / 6 chiffres")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Choisissez un PIN (6 chiffres)"), "12ab34");
    expect((screen.getByLabelText("Choisissez un PIN (6 chiffres)") as HTMLInputElement).value).toBe("1234");
    expect(screen.getByText("4 / 6 chiffres")).toBeTruthy();
  });
});
