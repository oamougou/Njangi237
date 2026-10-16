import { describe, expect, it } from "vitest";
import { libelleParDefaut } from "./libelles";

describe("libelleParDefaut", () => {
  const d = new Date(2026, 9, 16);   // 16 octobre 2026
  it("mensuel : le mois avec majuscule", () => expect(libelleParDefaut(d, "mensuelle")).toBe("Octobre 2026"));
  it("hebdomadaire : la semaine", () => expect(libelleParDefaut(d, "hebdomadaire")).toBe("Semaine du 16/10/2026"));
  it("ponctuel : la date", () => expect(libelleParDefaut(d, "ponctuelle")).toBe("Cycle du 16/10/2026"));
});
