import type { MoyenPaiement } from "../types";
import {
  aujourdhui, comptes, exigerTontine, exigerTresorier, groupeDe, journaliser, membreDe, parRang, refus, type Ctx, type EtatDemo,
} from "./etat";

const VERROU = "L'ordre est verrouillé : utilisez l'échange de tours";
const nomsDansLOrdre = (e: EtatDemo, groupId: string) => comptes(e, groupId).sort(parRang).map((m) => m.display_name);

function avantVerrou(e: EtatDemo, c: Ctx, groupId: string) {
  exigerTresorier(e, groupId, c);
  exigerTontine(e, groupId);
  if (groupeDe(e, groupId).order_locked) refus(VERROU);
}

export function ordonnerTours(e: EtatDemo, c: Ctx, groupId: string, ordre: string[]) {
  avantVerrou(e, c, groupId);
  const attendus = comptes(e, groupId).map((m) => m.id).sort();
  const recus = [...ordre].sort();
  if (attendus.length !== recus.length || attendus.some((id, i) => id !== recus[i]))
    refus("La liste doit contenir chaque membre une seule fois");
  ordre.forEach((id, i) => { membreDe(e, id).position = i + 1; });
  journaliser(e, c, groupId, "ordre_modifie", { ordre: nomsDansLOrdre(e, groupId) }, true);
}

export function tirerAuSort(e: EtatDemo, c: Ctx, groupId: string): string[] {
  avantVerrou(e, c, groupId);
  const membres = comptes(e, groupId);
  for (let i = membres.length - 1; i > 0; i--) {   // Fisher-Yates
    const j = Math.floor(c.hasard() * (i + 1));
    [membres[i], membres[j]] = [membres[j], membres[i]];
  }
  membres.forEach((m, i) => { m.position = i + 1; });
  const ordre = nomsDansLOrdre(e, groupId);
  journaliser(e, c, groupId, "tirage_au_sort", { ordre }, true);
  return ordre;
}

export function echangerTours(e: EtatDemo, c: Ctx, a: string, b: string) {
  const ma = e.membres.find((m) => m.id === a), mb = e.membres.find((m) => m.id === b);
  if (!ma || !mb) return refus("Membre introuvable");
  if (ma.group_id !== mb.group_id || ma.id === mb.id) refus("Échange impossible entre ces membres");
  exigerTresorier(e, ma.group_id, c);
  exigerTontine(e, ma.group_id);
  if (ma.status === "retire" || mb.status === "retire") refus("Ce membre est retiré");
  const tour = groupeDe(e, ma.group_id).current_round;
  if (e.remises.some((r) => (r.membership_id === a || r.membership_id === b) && r.round === tour && r.status === "remis"))
    refus("Un de ces membres a déjà reçu sa part dans ce tour");
  [ma.position, mb.position] = [mb.position, ma.position];
  for (const r of e.remises) {
    if (r.round !== tour || r.status !== "prevu") continue;
    if (r.membership_id === a) r.membership_id = b; else if (r.membership_id === b) r.membership_id = a;
  }
  journaliser(e, c, ma.group_id, "tours_echanges", { a: ma.display_name, b: mb.display_name }, true);
}

export function remplacerBeneficiaire(e: EtatDemo, c: Ctx, remiseId: string, membershipId: string) {
  const r = e.remises.find((x) => x.id === remiseId) ?? refus("Bénéficiaire introuvable");
  exigerTresorier(e, r.group_id, c);
  if (r.status !== "prevu") refus("Cette cagnotte est déjà remise");
  echangerTours(e, c, r.membership_id, membershipId);
}

export function enregistrerRemise(e: EtatDemo, c: Ctx, remiseId: string, montant: number, moyen: MoyenPaiement,
  reference: string | null): { ecart: number } {
  const r = e.remises.find((x) => x.id === remiseId) ?? refus("Bénéficiaire introuvable");
  exigerTresorier(e, r.group_id, c);
  if (r.status !== "prevu") refus("Cette cagnotte est déjà remise");
  if (!(montant > 0)) refus("Montant invalide");
  if ((moyen === "mtn_momo" || moyen === "orange_money") && !(reference ?? "").trim())
    refus("Référence de transaction obligatoire pour MoMo et Orange Money");
  Object.assign(r, { amount: montant, method: moyen, reference: reference?.trim() || null, paid_on: aujourdhui(c), status: "remis" });
  journaliser(e, c, r.group_id, "cagnotte_remise", { nom: membreDe(e, r.membership_id).display_name, montant }, true);
  return { ecart: montant - r.amount_expected };
}

export function nouveauTour(e: EtatDemo, c: Ctx, groupId: string): number {
  exigerTresorier(e, groupId, c);
  exigerTontine(e, groupId);
  const g = groupeDe(e, groupId);
  if (e.cycles.some((x) => x.group_id === groupId && x.status === "ouvert")) refus("Clôturez d'abord le cycle en cours");
  if (comptes(e, groupId).some((m) => !e.remises.some((r) => r.membership_id === m.id && r.round === g.current_round && r.status === "remis")))
    refus("Le tour n'est pas terminé : tous les membres n'ont pas reçu leur part");
  g.current_round += 1; g.order_locked = false;
  journaliser(e, c, groupId, "nouveau_tour", { tour: g.current_round }, true);
  return g.current_round;
}
