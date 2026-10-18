import type { Declaration, MoyenPaiement } from "../types";
import { aujourdhui, cycleDe, exigerTresorier, horodatage, journaliser, membreDe, refus, type Ctx, type DetteDemo, type EtatDemo } from "./etat";

const sansReference = (moyen: MoyenPaiement, reference: string | null) =>
  (moyen === "mtn_momo" || moyen === "orange_money") && !(reference ?? "").trim();

function detteAReglee(e: EtatDemo, detteId: string, membershipId: string, cycleId: string, montant: number): DetteDemo {
  const d = e.dettes.find((x) => x.id === detteId);
  if (!d || d.membership_id !== membershipId || d.cycle_id !== cycleId) return refus("Dette introuvable");
  if (d.settled_at) refus("Cette dette est déjà réglée");
  if (montant < d.amount) refus(`Le règlement doit couvrir toute la dette (${d.amount} FCFA)`);
  return d;
}
/** Index uniques de la base : un paiement non contesté par cycle et par membre, un par dette. */
function exigerUnique(e: EtatDemo, cycleId: string, membershipId: string, detteId: string | null) {
  const doublon = detteId
    ? e.paiements.some((p) => p.debt_id === detteId && p.status !== "conteste")
    : e.paiements.some((p) => p.cycle_id === cycleId && p.membership_id === membershipId && p.debt_id === null && p.status !== "conteste");
  if (doublon) refus("Un paiement est déjà enregistré pour ce cycle");
}
/** Idempotence : la file hors ligne peut renvoyer la même déclaration. */
function dejaRecu(e: EtatDemo, c: Ctx, id: string): boolean {
  const ancien = e.paiements.find((p) => p.id === id);
  if (!ancien) return false;
  return ancien.declared_by === c.acteur || refus("Identifiant de paiement déjà utilisé");
}

export function declarerPaiement(e: EtatDemo, c: Ctx, d: Declaration) {
  if (dejaRecu(e, c, d.id)) return;
  const cy = cycleDe(e, d.cycleId);
  const m = e.membres.find((x) => x.group_id === cy.group_id && x.person_id === c.acteur && x.status === "actif")
    ?? refus("Vous n'êtes pas membre de ce groupe");
  if (!(d.montant > 0)) refus("Montant invalide");
  if (sansReference(d.moyen, d.reference)) refus("Référence de transaction obligatoire pour MoMo et Orange Money");
  if (d.detteId === null) { if (cy.status !== "ouvert") refus("Ce cycle est clos"); }
  else detteAReglee(e, d.detteId, m.id, cy.id, d.montant);
  exigerUnique(e, cy.id, m.id, d.detteId);
  e.paiements.push({ id: d.id, group_id: cy.group_id, cycle_id: cy.id, membership_id: m.id, debt_id: d.detteId, amount: d.montant,
    method: d.moyen, reference: d.reference?.trim() || null, paid_on: d.date || aujourdhui(c), status: "declare",
    contest_reason: null, created_at: horodatage(c), declared_by: c.acteur });
}

export function saisirEspeces(e: EtatDemo, c: Ctx, id: string, membershipId: string, cycleId: string, montant: number, detteId?: string) {
  if (dejaRecu(e, c, id)) return;
  const m = membreDe(e, membershipId);
  exigerTresorier(e, m.group_id, c);
  const cy = e.cycles.find((x) => x.id === cycleId && x.group_id === m.group_id) ?? refus("Cycle introuvable");
  if (!(montant > 0)) refus("Montant invalide");
  let dette: DetteDemo | null = null;
  if (!detteId) {
    // Un membre retiré ne cotise plus, mais peut encore régler ses dettes
    if (m.status === "retire") refus("Ce membre est retiré");
    if (cy.status !== "ouvert") refus("Ce cycle est clos");
  } else dette = detteAReglee(e, detteId, m.id, cy.id, montant);
  exigerUnique(e, cy.id, m.id, detteId ?? null);
  e.paiements.push({ id, group_id: m.group_id, cycle_id: cy.id, membership_id: m.id, debt_id: detteId ?? null, amount: montant,
    method: "especes", reference: null, paid_on: aujourdhui(c), status: "valide", contest_reason: null,
    created_at: horodatage(c), declared_by: c.acteur });
  if (dette) dette.settled_at = horodatage(c);
}

export function validerPaiement(e: EtatDemo, c: Ctx, paiementId: string) {
  const p = e.paiements.find((x) => x.id === paiementId) ?? refus("Paiement introuvable");
  exigerTresorier(e, p.group_id, c);
  if (p.status !== "declare") refus("Ce paiement n'est pas en attente de validation");
  // Un paiement ordinaire ne peut pas entrer dans un cycle déjà clos (les dettes y sont déjà calculées)
  if (p.debt_id === null && cycleDe(e, p.cycle_id).status === "clos") refus("Ce cycle est clos");
  p.status = "valide";
  const dette = e.dettes.find((d) => d.id === p.debt_id);
  if (dette) dette.settled_at = horodatage(c);
}

export function contesterPaiement(e: EtatDemo, c: Ctx, paiementId: string, motif: string) {
  const p = e.paiements.find((x) => x.id === paiementId) ?? refus("Paiement introuvable");
  exigerTresorier(e, p.group_id, c);
  if (!motif.trim()) refus("Motif obligatoire");
  if (p.status === "conteste") refus("Ce paiement est déjà contesté");
  // Cycle clos : un paiement validé est figé, mais une déclaration arrivée trop tard doit pouvoir être écartée
  if (p.debt_id === null && cycleDe(e, p.cycle_id).status === "clos" && p.status === "valide") refus("Ce cycle est clos");
  p.status = "conteste"; p.contest_reason = motif.trim();
  const dette = e.dettes.find((d) => d.id === p.debt_id);
  if (dette) dette.settled_at = null;
  journaliser(e, c, p.group_id, "paiement_conteste", { nom: membreDe(e, p.membership_id).display_name, montant: p.amount, motif: motif.trim() });
}
