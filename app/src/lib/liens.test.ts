import { describe, expect, it } from "vitest";
import { lienApp, lienWhatsApp, messageWhatsApp } from "./liens";

describe("liens", () => {
  const base = "https://v2.njangi237.pages.dev/";
  it("lien de l'application selon le type", () => {
    expect(lienApp(base, "invitation", "J")).toBe("https://v2.njangi237.pages.dev/#/invitation/J");
    expect(lienApp(base, "reinitialisation", "J")).toBe("https://v2.njangi237.pages.dev/#/nouveau-pin/J");
  });
  it("message WhatsApp pré-rempli et encodé", () => {
    const m = messageWhatsApp("invitation", "Tontine des amis", "Ines", "https://x/#/invitation/J");
    expect(m).toContain("Ines");
    expect(m).toContain("Tontine des amis");
    expect(m).toContain("https://x/#/invitation/J");
    expect(messageWhatsApp("reinitialisation", "T", "Ines", "L")).toContain("nouveau PIN");
    expect(lienWhatsApp("237690000009", "a & b")).toBe("https://wa.me/237690000009?text=a%20%26%20b");
  });
});
