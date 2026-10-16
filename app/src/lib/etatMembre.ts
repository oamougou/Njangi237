import type { EnFile } from "./horsLigne";
import type { Cycle, Membre, Paiement } from "./types";

export type MonEtat = "paye" | "en_attente" | "a_envoyer" | "conteste" | "a_payer" | "hors";
export interface EtatMembre { etat: MonEtat; motif?: string; valide: number }

/** Situation du membre pour le cycle ouvert (paiements ordinaires seulement ; les règlements de dette sont à part). */
export function monEtat(cycle: Cycle | null, moi: Membre, paiements: Paiement[], file: EnFile[]): EtatMembre | null {
  if (!cycle) return null;
  const siens = paiements.filter((p) => p.cycle_id === cycle.id && !p.debt_id && p.membership_id === moi.id);
  const valide = siens.filter((p) => p.status === "valide").reduce((s, p) => s + p.amount, 0);
  if (valide >= cycle.amount_expected) return { etat: "paye", valide };
  if (siens.some((p) => p.status === "declare")) return { etat: "en_attente", valide };
  if (file.some((e) => e.etat === "attente" && e.declaration.cycleId === cycle.id && !e.declaration.detteId)) return { etat: "a_envoyer", valide };
  if (new Date(moi.created_at).getTime() > new Date(cycle.opened_at).getTime()) return { etat: "hors", valide };
  const conteste = [...siens].reverse().find((p) => p.status === "conteste");
  if (conteste && valide === 0) return { etat: "conteste", motif: conteste.contest_reason ?? undefined, valide };
  return { etat: "a_payer", valide };
}
