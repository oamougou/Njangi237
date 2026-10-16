import { vi } from "vitest";
import type { Api, EntreeJournal, VueGroupe } from "../lib/types";
import { vueMembreTest, vueTest } from "./donnees";

/** Fausse Api : chaque méthode est un vi.fn() qui réussit ; chargerGroupe renvoie la vue fournie. */
export function fauxApi(vue: VueGroupe = vueTest()) {
  const lien = { lien: "https://x/#/invitation/J", whatsapp: "https://wa.me/237690000009?text=x", expire: "2026-10-23T10:00:00Z", nom: "Ines" };
  const api = {
    session: vi.fn(), connexion: vi.fn(), quitter: vi.fn(), apercu: vi.fn(), accepter: vi.fn(), nouveauPin: vi.fn(),
    changerPin: vi.fn(), amorcer: vi.fn(), mesGroupes: vi.fn(async () => []), creerGroupe: vi.fn(),
    inviter: vi.fn(async () => lien),
    chargerGroupe: vi.fn(async () => vue),
    ouvrirCycle: vi.fn(async () => {}), cloreCycle: vi.fn(async () => ({ dettes: 2, montant: 10000 })), rouvrirCycle: vi.fn(async () => {}),
    validerPaiement: vi.fn(async () => {}), contesterPaiement: vi.fn(async () => {}), saisirEspeces: vi.fn(async () => {}),
    ajouterMembre: vi.fn(async () => "m-nouveau"), changerRole: vi.fn(async () => {}),
    apercuRetrait: vi.fn(async () => ({ deja_servi: false, cycles_restants: 1, montant_restant: 5000, dettes: 0 })),
    retirerMembre: vi.fn(async () => {}),
    chargerVueMembre: vi.fn(async () => vueMembreTest()),
    declarerPaiement: vi.fn(async () => {}),
    abonner: vi.fn((_ids: string[], _cb: () => void) => () => {}),
    ordonnerTours: vi.fn(async () => {}),
    tirerAuSort: vi.fn(async () => ["Bob", "Tina", "Ines", "Alice"]),
    echangerTours: vi.fn(async () => {}),
    remplacerBeneficiaire: vi.fn(async () => {}),
    enregistrerRemise: vi.fn(async () => ({ ecart: 0 })),
    nouveauTour: vi.fn(async () => 2),
    lireJournal: vi.fn(async () => [] as EntreeJournal[]),
  } satisfies Api;
  return api;
}
