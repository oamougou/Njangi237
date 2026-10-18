import { fcfa } from "./format";
import type { Devise, EtatAbonnement, MoyenPaiement, Offre, OffrePayante } from "./types";

export const LIBELLE_OFFRE: Record<Offre, string> = {
  decouverte: "Découverte", essai: "Essai gratuit", groupe: "Groupe", association: "Association", diaspora: "Diaspora", pilote: "Pilote",
};
export const LIBELLE_MOYEN: Record<MoyenPaiement, string> = { mtn_momo: "MTN MoMo", orange_money: "Orange Money", especes: "Espèces", autre: "Autre" };

/** Mêmes montants que `prix_offre` en base. */
export const TARIFS: { offre: OffrePayante; nom: string; pourQui: string; mois: number; an: number; devise: Devise }[] = [
  { offre: "groupe", nom: "Groupe", pourQui: "jusqu'à 50 membres", mois: 2000, an: 20000, devise: "XAF" },
  { offre: "association", nom: "Association", pourQui: "jusqu'à 5 groupes de 50 membres", mois: 7500, an: 75000, devise: "XAF" },
  { offre: "diaspora", nom: "Diaspora", pourQui: "jusqu'à 50 membres, payé en euros", mois: 5, an: 50, devise: "EUR" },
];

export function prix(offre: OffrePayante, duree: 1 | 12, lancement: boolean): { montant: number; devise: Devise } {
  const t = TARIFS.find((x) => x.offre === offre)!;
  const base = duree === 12 ? t.an : t.mois;
  return { montant: Math.ceil(lancement ? base / 2 : base), devise: t.devise };
}

export const montantTexte = (montant: number, devise: Devise) => (devise === "EUR" ? `${montant} €` : fcfa(montant));

/** Une fin est exclusive (ex. 1er février 00:00) : on affiche le dernier jour inclus, à l'heure de Douala. */
export const finAffichee = (fin: string) =>
  new Date(new Date(fin).getTime() - 1).toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" });

export function joursRestants(fin: string | null, maintenant = new Date()): number | null {
  if (!fin) return null;
  return Math.ceil((new Date(fin).getTime() - maintenant.getTime()) / 86_400_000);
}

/** Message pour le trésorier : blocage (mêmes règles que la base) ou fin proche (7 jours). */
export function alerteAbonnement(e: EtatAbonnement, maintenant = new Date()): { niveau: "bloque" | "bientot"; texte: string } | null {
  const nom = LIBELLE_OFFRE[e.offre];
  if (e.membres > e.limite)
    return { niveau: "bloque", texte: `Votre groupe compte ${e.membres} membres, l'offre ${nom} en permet ${e.limite} : pas de nouveau cycle ni de nouveau membre. Choisissez une offre.` };
  if (e.offre === "decouverte" && e.membres >= e.limite)
    return { niveau: "bloque", texte: `Limite de l'offre ${nom} atteinte (${e.limite} membres) : passez à l'offre Groupe pour en ajouter.` };
  const j = joursRestants(e.fin, maintenant);
  if (j !== null && j >= 0 && j <= 7)
    return { niveau: "bientot", texte: `${nom} : plus que ${j} jour${j > 1 ? "s" : ""}. Choisissez une offre pour continuer sans limite.` };
  return null;
}
