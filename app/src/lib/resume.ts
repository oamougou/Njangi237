import type { ResumeGroupe, RoleGroupe } from "./types";

interface CycleResume { id: string; label: string; due_date: string | null; amount_expected: number; opened_at: string }
interface PaiementResume { cycle_id: string; membership_id: string; status: string; amount: number }

/** Résumé d'une carte « Mes groupes », avec les mêmes règles que l'espace membre et que la clôture en base. */
export function resumerGroupe(role: RoleGroupe, membershipId: string, membreCreeLe: string, cycle: CycleResume | null,
  paiements: PaiementResume[]): ResumeGroupe {
  if (!cycle) return { cycleId: null, cycle: null, echeance: null, montant: null, monEtat: null, aValider: 0 };
  const duCycle = paiements.filter((p) => p.cycle_id === cycle.id);
  const miens = duCycle.filter((p) => p.membership_id === membershipId);
  const valide = miens.filter((p) => p.status === "valide").reduce((s, p) => s + p.amount, 0);
  const monEtat: ResumeGroupe["monEtat"] = valide >= cycle.amount_expected ? "paye"
    : miens.some((p) => p.status === "declare") ? "en_attente"
    : new Date(membreCreeLe).getTime() > new Date(cycle.opened_at).getTime() ? "hors"
    : valide === 0 && miens.some((p) => p.status === "conteste") ? "conteste" : "a_payer";
  return {
    cycleId: cycle.id, cycle: cycle.label, echeance: cycle.due_date, montant: Math.max(cycle.amount_expected - valide, 0), monEtat,
    aValider: role === "tresorier" ? duCycle.filter((p) => p.status === "declare").length : 0,
  };
}
