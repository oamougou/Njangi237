import { describe, expect, it } from "vitest";
import { alerteAbonnement, finAffichee, joursRestants, montantTexte, prix } from "./abonnement";
import { etatAbonnementTest } from "../test/donnees";

const MAINTENANT = new Date("2026-10-18T10:00:00Z");

describe("abonnement", () => {
  it("prix : comme en base, moitié prix arrondie à l'unité supérieure", () => {
    expect(prix("groupe", 1, false)).toEqual({ montant: 2000, devise: "XAF" });
    expect(prix("association", 12, true)).toEqual({ montant: 37500, devise: "XAF" });
    expect(prix("diaspora", 1, true)).toEqual({ montant: 3, devise: "EUR" });
    expect(montantTexte(3, "EUR")).toBe("3 €");
    expect(montantTexte(20000, "XAF")).toBe("20 000 FCFA");
  });
  it("date de fin affichée : le dernier jour inclus, à Douala", () => {
    expect(finAffichee("2027-01-31T23:00:00Z")).toBe("31/01/2027");      // fin = 1er février 00:00 à Douala
    expect(finAffichee("2026-11-18T10:00:00Z")).toBe("18/11/2026");
  });
  it("jours restants, arrondis au jour supérieur ; aucun sans date de fin", () => {
    expect(joursRestants("2026-10-20T09:00:00Z", MAINTENANT)).toBe(2);
    expect(joursRestants(null, MAINTENANT)).toBeNull();
  });
  it("alerte : bloqué au-dessus de la limite, limite atteinte en Découverte, fin proche, sinon rien", () => {
    const e = etatAbonnementTest();
    expect(alerteAbonnement({ ...e, offre: "decouverte", limite: 10, fin: null, membres: 12 }, MAINTENANT)).toEqual({ niveau: "bloque",
      texte: "Votre groupe compte 12 membres, l'offre Découverte en permet 10 : pas de nouveau cycle ni de nouveau membre. Choisissez une offre." });
    expect(alerteAbonnement({ ...e, offre: "decouverte", limite: 10, fin: null, membres: 10 }, MAINTENANT)?.texte)
      .toBe("Limite de l'offre Découverte atteinte (10 membres) : passez à l'offre Groupe pour en ajouter.");
    expect(alerteAbonnement({ ...e, offre: "essai", fin: "2026-10-21T10:00:00Z" }, MAINTENANT))
      .toEqual({ niveau: "bientot", texte: "Essai gratuit : plus que 3 jours. Choisissez une offre pour continuer sans limite." });
    expect(alerteAbonnement({ ...e, offre: "groupe", fin: "2026-12-30T00:00:00Z" }, MAINTENANT)).toBeNull();
  });
});
