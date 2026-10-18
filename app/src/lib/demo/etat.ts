import type { Cycle, Dette, Groupe, Membre, MoyenPaiement, Paiement, Remise } from "../types";

export interface PersonneDemo { id: string; phone: string; full_name: string }
export interface GroupeDemo extends Groupe { max_members: number }
export interface MembreDemo extends Membre { group_id: string }
export interface CycleDemo extends Cycle { group_id: string }
export interface PaiementDemo extends Paiement { group_id: string; declared_by: string }
export interface DetteDemo extends Dette { group_id: string }
export interface RemiseDemo extends Remise { group_id: string; method: MoyenPaiement | null; reference: string | null }
export interface EntreeDemo {
  id: number; group_id: string; actor: string | null; action: string; details: Record<string, unknown>; created_at: string; visible: boolean;
}

/** À augmenter si la forme de l'état change : un état gardé d'une autre version est remplacé par les données de démonstration. */
export const VERSION_DEMO = 1;
export interface EtatDemo {
  version: number; personnes: PersonneDemo[]; groupes: GroupeDemo[]; membres: MembreDemo[]; cycles: CycleDemo[];
  paiements: PaiementDemo[]; dettes: DetteDemo[]; remises: RemiseDemo[]; journal: EntreeDemo[]; prochainJournal: number;
}
/** Contexte d'une action : qui agit (identifiant de personne), l'heure, les identifiants et le hasard (fixés dans les tests). */
export interface Ctx { acteur: string; maintenant: () => Date; id: () => string; hasard: () => number }

export const etatVide = (): EtatDemo => ({
  version: VERSION_DEMO, personnes: [], groupes: [], membres: [], cycles: [], paiements: [], dettes: [], remises: [],
  journal: [], prochainJournal: 1,
});

/** Refus d'une règle : même message que la fonction SQL correspondante. */
export function refus(message: string): never { throw new Error(message); }
export const horodatage = (c: Ctx) => c.maintenant().toISOString();
export const aujourdhui = (c: Ctx) => horodatage(c).slice(0, 10);

export const groupeDe = (e: EtatDemo, id: string) => e.groupes.find((g) => g.id === id) ?? refus("Groupe introuvable");
export const membreDe = (e: EtatDemo, id: string) => e.membres.find((m) => m.id === id) ?? refus("Membre introuvable");
export const cycleDe = (e: EtatDemo, id: string) => e.cycles.find((x) => x.id === id) ?? refus("Cycle introuvable");

/** Adhésions « comptées » : invitées ou actives (`status <> 'retire'` en base). */
export const comptes = (e: EtatDemo, groupId: string) => e.membres.filter((m) => m.group_id === groupId && m.status !== "retire");
export const estMembre = (e: EtatDemo, groupId: string, personId: string) =>
  e.membres.some((m) => m.group_id === groupId && m.person_id === personId && m.status === "actif");
export const estTresorier = (e: EtatDemo, groupId: string, personId: string) =>
  e.membres.some((m) => m.group_id === groupId && m.person_id === personId && m.status === "actif" && m.role === "tresorier");

export function exigerTresorier(e: EtatDemo, groupId: string, c: Ctx) {
  if (!estTresorier(e, groupId, c.acteur)) refus("Réservé aux trésoriers du groupe");
}
export function exigerTontine(e: EtatDemo, groupId: string) {
  if (groupeDe(e, groupId).type !== "tontine") refus("Réservé aux tontines");
}
export function garderUnTresorier(e: EtatDemo, groupId: string, sauf: string) {
  if (!e.membres.some((m) => m.group_id === groupId && m.role === "tresorier" && m.status === "actif" && m.id !== sauf))
    refus("Le groupe doit garder au moins un trésorier actif");
}
export function journaliser(e: EtatDemo, c: Ctx, groupId: string, action: string, details: Record<string, unknown> = {}, visible = false) {
  e.journal.push({ id: e.prochainJournal++, group_id: groupId, actor: c.acteur, action, details, created_at: horodatage(c), visible });
}
/** Ordre des tours : position, puis date d'arrivée (`order by position nulls last, created_at`). */
export const parRang = (a: MembreDemo, b: MembreDemo) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.created_at.localeCompare(b.created_at);
export function ajouterPersonne(e: EtatDemo, p: PersonneDemo) {
  if (!e.personnes.some((x) => x.id === p.id)) e.personnes.push(p);
}
