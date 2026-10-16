import type { Cycle, Membre, Paiement } from "./types";

export type Etat = "paye" | "partiel" | "declare" | "conteste" | "retard";
export const LIBELLE_ETAT: Record<Etat, string> = {
  paye: "Payé", partiel: "Partiel", declare: "À valider", conteste: "Contesté", retard: "En retard",
};

export interface LigneCycle {
  membre: Membre; etat: Etat; valide: number;
  /** Déclaration en attente de validation. */
  enAttente: Paiement | null;
  /** Dernier paiement validé (pour l'annuler en cas d'erreur). */
  dernierValide: Paiement | null;
}
export interface Bilan { lignes: LigneCycle[]; attendu: number; collecte: number; taux: number; aValider: number; enRetard: LigneCycle[] }

/** État d'un cycle pour le trésorier : membres comptés (invités compris), paiements ordinaires du cycle seulement. */
export function bilanCycle(cycle: Cycle, membres: Membre[], paiements: Paiement[]): Bilan {
  const comptes = membres.filter((m) => m.status !== "retire")
    .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.display_name.localeCompare(b.display_name, "fr"));
  const duCycle = paiements.filter((p) => p.cycle_id === cycle.id && !p.debt_id);
  const lignes = comptes.map((membre): LigneCycle => {
    const siens = duCycle.filter((p) => p.membership_id === membre.id);
    const valides = siens.filter((p) => p.status === "valide");
    const valide = valides.reduce((s, p) => s + p.amount, 0);
    const enAttente = siens.find((p) => p.status === "declare") ?? null;
    const conteste = siens.some((p) => p.status === "conteste");
    const etat: Etat = valide >= cycle.amount_expected ? "paye" : enAttente ? "declare" : valide > 0 ? "partiel" : conteste ? "conteste" : "retard";
    return { membre, etat, valide, enAttente, dernierValide: valides[valides.length - 1] ?? null };
  });
  const attendu = cycle.amount_expected * comptes.length;
  const collecte = lignes.reduce((s, l) => s + l.valide, 0);
  return {
    lignes, attendu, collecte,
    taux: attendu ? Math.round((collecte * 100) / attendu) : 0,
    aValider: lignes.filter((l) => l.etat === "declare").length,
    enRetard: lignes.filter((l) => l.etat === "retard" || l.etat === "partiel" || l.etat === "conteste"),
  };
}
