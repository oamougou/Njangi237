import { normaliserTelephone } from "../telephone";
import type { ApercuRetrait, NouveauGroupe, RoleGroupe } from "../types";
import {
  comptes, exigerTresorier, garderUnTresorier, groupeDe, horodatage, journaliser, membreDe, refus, type Ctx, type EtatDemo,
} from "./etat";

/** Création d'un groupe par la plateforme (en démo : seulement pour bâtir les données). Le trésorier est invité, position 1. */
export function creerGroupe(e: EtatDemo, c: Ctx, g: NouveauGroupe): { groupId: string; membershipId: string } {
  if (!g.nom.trim()) refus("Nom du groupe obligatoire");
  if (!g.tresorier_nom.trim()) refus("Nom du trésorier obligatoire");
  if (!(g.montant > 0)) refus("Montant invalide");
  if (!(g.beneficiaires >= 1)) refus("Nombre de bénéficiaires par cycle invalide");
  const groupId = c.id();
  e.groupes.push({ id: groupId, name: g.nom.trim(), type: g.type, amount: g.montant, frequency: g.frequence,
    beneficiaries_per_cycle: g.beneficiaires, current_round: 1, order_locked: false, max_members: 50 });
  const membershipId = c.id();
  e.membres.push({ id: membershipId, group_id: groupId, display_name: g.tresorier_nom.trim(), phone: normaliserTelephone(g.tresorier_telephone),
    role: "tresorier", status: "invite", position: 1, person_id: null, left_balance: null, created_at: horodatage(c) });
  journaliser(e, c, groupId, "groupe_cree", { nom: g.nom.trim() }, true);
  return { groupId, membershipId };
}

/** Invitation acceptée (= finaliser_invitation) : `c.acteur` est la personne, déjà présente dans `e.personnes`. */
export function rejoindre(e: EtatDemo, c: Ctx, membershipId: string) {
  const m = membreDe(e, membershipId);
  if (m.status !== "invite") refus("Lien invalide ou expiré");
  m.person_id = c.acteur; m.status = "actif";
  journaliser(e, c, m.group_id, "membre_rejoint", { nom: m.display_name }, true);
}

export function ajouterMembre(e: EtatDemo, c: Ctx, groupId: string, nom: string, telephone: string): string {
  const phone = normaliserTelephone(telephone);
  exigerTresorier(e, groupId, c);
  if (!nom.trim()) refus("Nom obligatoire");
  const g = groupeDe(e, groupId);
  const actuels = comptes(e, groupId);
  if (actuels.length >= g.max_members) refus(`Nombre maximum de membres atteint (${g.max_members})`);
  const position = Math.max(0, ...actuels.map((m) => m.position ?? 0)) + 1;
  const ancien = e.membres.find((m) => m.group_id === groupId && m.phone === phone);
  let id: string;
  if (ancien) {
    if (ancien.status !== "retire") refus("Ce numéro est déjà dans le groupe");
    Object.assign(ancien, { display_name: nom.trim(), role: "membre", status: "invite", position });
    id = ancien.id;
  } else {
    id = c.id();
    e.membres.push({ id, group_id: groupId, display_name: nom.trim(), phone, role: "membre", status: "invite", position,
      person_id: null, left_balance: null, created_at: horodatage(c) });
  }
  journaliser(e, c, groupId, "membre_ajoute", { nom: nom.trim() });
  return id;
}

export function changerRole(e: EtatDemo, c: Ctx, membershipId: string, role: RoleGroupe) {
  const m = membreDe(e, membershipId);
  exigerTresorier(e, m.group_id, c);
  if (m.status === "retire") refus("Ce membre est retiré");
  if (m.role === "tresorier" && role === "membre") garderUnTresorier(e, m.group_id, m.id);
  m.role = role;
  journaliser(e, c, m.group_id, "role_change", { nom: m.display_name, role });
}

/** Ce que le membre doit encore s'il quitte le groupe maintenant. */
export function apercuRetrait(e: EtatDemo, c: Ctx, membershipId: string): ApercuRetrait {
  const m = membreDe(e, membershipId);
  exigerTresorier(e, m.group_id, c);
  const g = groupeDe(e, m.group_id);
  const ouvert = e.cycles.find((x) => x.group_id === g.id && x.status === "ouvert");
  const servi = e.remises.some((r) => r.membership_id === m.id && r.round === g.current_round && r.status === "remis");
  let restants = 0;
  if (g.type === "tontine" && servi) {
    const attente = comptes(e, g.id)
      .filter((x) => x.id !== m.id && !e.remises.some((r) => r.membership_id === x.id && r.round === g.current_round)).length;
    restants = Math.ceil(attente / g.beneficiaries_per_cycle);
  }
  if (ouvert && !e.paiements.some((p) => p.cycle_id === ouvert.id && p.membership_id === m.id && p.debt_id === null && p.status === "valide"))
    restants += 1;
  const dettes = e.dettes.filter((d) => d.membership_id === m.id && !d.settled_at).reduce((s, d) => s + d.amount, 0);
  return { deja_servi: servi, cycles_restants: restants, montant_restant: restants * g.amount, dettes };
}

export function retirerMembre(e: EtatDemo, c: Ctx, membershipId: string): ApercuRetrait {
  const m = membreDe(e, membershipId);
  exigerTresorier(e, m.group_id, c);
  if (m.status === "retire") refus("Ce membre est déjà retiré");
  if (m.role === "tresorier") garderUnTresorier(e, m.group_id, m.id);
  if (e.remises.some((r) => r.membership_id === m.id && r.status === "prevu"
      && e.cycles.some((x) => x.id === r.cycle_id && x.status === "ouvert")))
    refus("Ce membre est bénéficiaire du cycle en cours : remplacez-le d'abord");
  const apercu = apercuRetrait(e, c, membershipId);
  // Ce qu'il doit encore est figé : recalculé plus tard, l'aperçu diminuerait à mesure que les autres sont servis
  Object.assign(m, { status: "retire", position: null, left_balance: apercu.montant_restant });
  journaliser(e, c, m.group_id, "membre_retire", { nom: m.display_name }, true);
  journaliser(e, c, m.group_id, "solde_depart", { nom: m.display_name, ...apercu });
  return apercu;
}
