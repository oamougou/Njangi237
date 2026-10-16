import type { Cycle, Membre, Paiement } from "./types";

export type Etat = "paye" | "partiel" | "declare" | "conteste" | "retard" | "hors";
export const LIBELLE_ETAT: Record<Etat, string> = {
  paye: "Payé", partiel: "Partiel", declare: "À valider", conteste: "Contesté", retard: "En retard", hors: "Pas concerné(e)",
};

export interface LigneCycle {
  membre: Membre; etat: Etat; valide: number;
  /** Compté dans le cycle (comme à la clôture en base : présent à l'ouverture et non retiré). */
  compte: boolean;
  /** Déclaration en attente de validation. */
  enAttente: Paiement | null;
  /** Dernier paiement validé (pour l'annuler en cas d'erreur). */
  dernierValide: Paiement | null;
}
export interface Bilan { lignes: LigneCycle[]; attendu: number; collecte: number; taux: number; aValider: number; enRetard: LigneCycle[] }

/**
 * État d'un cycle pour le trésorier, aligné sur clore_cycle : seuls comptent les membres non retirés présents
 * à l'ouverture (invités compris). Un membre arrivé ensuite est affiché « Pas concerné(e) » ; un membre retiré
 * n'apparaît que s'il a un paiement dans le cycle (une déclaration en attente bloquerait la clôture).
 */
export function bilanCycle(cycle: Cycle, membres: Membre[], paiements: Paiement[]): Bilan {
  const ouverture = new Date(cycle.opened_at).getTime();
  const duCycle = paiements.filter((p) => p.cycle_id === cycle.id && !p.debt_id);
  const lignes: LigneCycle[] = [];
  for (const membre of [...membres].sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.display_name.localeCompare(b.display_name, "fr"))) {
    const siens = duCycle.filter((p) => p.membership_id === membre.id);
    if (membre.status === "retire" && siens.length === 0) continue;
    const compte = membre.status !== "retire" && new Date(membre.created_at).getTime() <= ouverture;
    const valides = siens.filter((p) => p.status === "valide");
    const valide = valides.reduce((s, p) => s + p.amount, 0);
    const enAttente = siens.find((p) => p.status === "declare") ?? null;
    const etat: Etat = valide >= cycle.amount_expected ? "paye" : enAttente ? "declare" : valide > 0 ? "partiel"
      : !compte ? "hors" : siens.some((p) => p.status === "conteste") ? "conteste" : "retard";
    lignes.push({ membre, etat, valide, compte, enAttente, dernierValide: valides[valides.length - 1] ?? null });
  }
  const comptes = lignes.filter((l) => l.compte);
  const attendu = cycle.amount_expected * comptes.length;
  const collecte = lignes.reduce((s, l) => s + l.valide, 0);
  return {
    lignes, attendu, collecte,
    taux: attendu ? Math.round((collecte * 100) / attendu) : 0,
    aValider: lignes.filter((l) => l.enAttente).length,
    enRetard: comptes.filter((l) => l.etat === "retard" || l.etat === "partiel" || l.etat === "conteste"),
  };
}
