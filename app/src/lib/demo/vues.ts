import { resumerGroupe } from "../resume";
import type { EntreeJournal, MonGroupe, OrdreTour, Recouvrement, VueGroupe, VueMembre } from "../types";
import { comptes, estMembre, estTresorier, groupeDe, refus, type EtatDemo, type MembreDemo } from "./etat";

/** Comme `order by position nulls last, display_name`. */
const parPositionPuisNom = (a: MembreDemo, b: MembreDemo) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.display_name.localeCompare(b.display_name, "fr");
const cyclesDu = (e: EtatDemo, groupId: string) =>
  e.cycles.filter((x) => x.group_id === groupId).sort((a, b) => a.round - b.round || a.number - b.number);
const parDate = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at);

/** RLS : trésorier, tout le groupe ; membre, sa fiche, ses paiements et ses dettes. */
export function vueGroupe(e: EtatDemo, acteur: string, groupId: string): VueGroupe {
  if (!estMembre(e, groupId, acteur)) refus("Groupe introuvable");
  const tresorier = estTresorier(e, groupId, acteur);
  const miens = new Set(e.membres.filter((m) => m.group_id === groupId && m.person_id === acteur).map((m) => m.id));
  const visible = (membershipId: string) => tresorier || miens.has(membershipId);
  return {
    role: tresorier ? "tresorier" : "membre",
    groupe: groupeDe(e, groupId),
    membres: e.membres.filter((m) => m.group_id === groupId && visible(m.id)).sort(parPositionPuisNom),
    cycles: cyclesDu(e, groupId),
    paiements: e.paiements.filter((p) => p.group_id === groupId && visible(p.membership_id)).sort(parDate),
    dettes: e.dettes.filter((d) => d.group_id === groupId && visible(d.membership_id)),
    remises: e.remises.filter((r) => r.group_id === groupId),
  };
}

function ordreTours(e: EtatDemo, acteur: string, groupId: string): OrdreTour[] {
  const tour = groupeDe(e, groupId).current_round;
  const remise = (id: string, statut: "prevu" | "remis") => e.remises.some((r) => r.membership_id === id && r.round === tour && r.status === statut);
  return comptes(e, groupId).sort(parPositionPuisNom).map((m) => ({
    membership_id: m.id, display_name: m.display_name, role: m.role, status: m.status, position: m.position,
    is_me: m.person_id === acteur, servi: remise(m.id, "remis"), prevu: remise(m.id, "prevu"),
  }));
}

function recouvrement(e: EtatDemo, groupId: string): Recouvrement[] {
  return cyclesDu(e, groupId).map((cy) => {
    const membres = comptes(e, groupId).filter((m) => m.created_at <= cy.opened_at).length;
    const valides = e.paiements.filter((p) => p.cycle_id === cy.id && p.debt_id === null && p.status === "valide");
    return { cycle_id: cy.id, membres, attendu: cy.amount_expected * membres,
      payes: new Set(valides.map((p) => p.membership_id)).size, collecte: valides.reduce((s, p) => s + p.amount, 0) };
  });
}

export function vueMembre(e: EtatDemo, acteur: string, groupId: string): VueMembre {
  if (!estMembre(e, groupId, acteur)) refus("Groupe introuvable");
  const moi = e.membres.find((m) => m.group_id === groupId && m.person_id === acteur)!;
  return {
    groupe: groupeDe(e, groupId), moi, cycles: cyclesDu(e, groupId),
    paiements: e.paiements.filter((p) => p.membership_id === moi.id).sort(parDate),
    dettes: e.dettes.filter((d) => d.membership_id === moi.id),
    remises: e.remises.filter((r) => r.group_id === groupId),
    ordre: ordreTours(e, acteur, groupId), recouvrement: recouvrement(e, groupId),
  };
}

export function mesGroupes(e: EtatDemo, acteur: string): MonGroupe[] {
  return e.membres.filter((m) => m.person_id === acteur && m.status === "actif")
    .map((m) => ({ m, g: groupeDe(e, m.group_id) }))
    .sort((a, b) => a.g.name.localeCompare(b.g.name, "fr"))
    .map(({ m, g }) => {
      const cy = e.cycles.find((x) => x.group_id === g.id && x.status === "ouvert") ?? null;
      const paiements = cy ? e.paiements.filter((p) => p.cycle_id === cy.id && p.debt_id === null
        && (m.role === "tresorier" || p.membership_id === m.id)) : [];
      return {
        membership_id: m.id, role: m.role,
        groupe: { id: g.id, name: g.name, type: g.type, amount: g.amount, frequency: g.frequency },
        resume: resumerGroupe(m.role, m.id, m.created_at, cy, paiements),
      };
    });
}

/** 50 entrées au plus, de la plus récente à la plus ancienne ; trésorier : tout, membre : entrées visibles. */
export function lireJournal(e: EtatDemo, acteur: string, groupId: string, avant?: number): EntreeJournal[] {
  if (!estMembre(e, groupId, acteur)) refus("Réservé aux membres du groupe");
  const tresorier = estTresorier(e, groupId, acteur);
  return e.journal
    .filter((j) => j.group_id === groupId && (tresorier || j.visible) && (avant === undefined || j.id < avant))
    .sort((a, b) => b.id - a.id).slice(0, 50)
    .map((j) => ({ id: j.id, action: j.action, details: j.details, created_at: j.created_at, visible: j.visible,
      auteur: e.personnes.find((p) => p.id === j.actor)?.full_name ?? null }));
}
