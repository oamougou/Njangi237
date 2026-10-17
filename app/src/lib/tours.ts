import type { Cycle, Frequence, Membre, OrdreTour, Remise } from "./types";

export interface EstimationTour { position: number; cyclesAvant: number; date: Date | null }

/**
 * Quand vient mon tour ? Les bénéficiaires du cycle ouvert sont « prévus » ; les membres non servis passent ensuite
 * dans l'ordre, `k` par cycle. `cyclesAvant` = 0 si je suis bénéficiaire du cycle en cours.
 */
export function estimerTour(ordre: OrdreTour[], k: number, frequence: Frequence, ouvert: Cycle | null, aujourdhui = new Date()): EstimationTour | null {
  const moi = ordre.find((o) => o.is_me);
  if (!moi || moi.servi) return null;
  const position = moi.position ?? ordre.length;
  // Bénéficiaire du cycle ouvert : c'est maintenant. Sans cycle ouvert, le prochain cycle compte pour 1 (jamais « ce cycle »).
  if (moi.prevu && ouvert) return { position, cyclesAvant: 0, date: new Date(ouvert.opened_at) };
  const avant = moi.prevu ? 0 : ordre.filter((o) => !o.servi && !o.prevu && (o.position ?? 1e9) < position).length;
  const cyclesAvant = Math.floor(avant / Math.max(k, 1)) + 1;
  if (frequence === "ponctuelle") return { position, cyclesAvant, date: null };
  // Avec un cycle ouvert, le n-ième cycle suivant s'ouvre n périodes après lui ; sans cycle ouvert, le prochain s'ouvre ≈ aujourd'hui
  const date = new Date(ouvert ? ouvert.opened_at : aujourdhui);
  const periodes = ouvert ? cyclesAvant : cyclesAvant - 1;
  if (frequence === "mensuelle") date.setUTCMonth(date.getUTCMonth() + periodes);
  else date.setUTCDate(date.getUTCDate() + 7 * periodes);
  return { position, cyclesAvant, date };
}

/** Déplace l'élément `i` de `delta` places (−1 = monter) ; hors limites, la liste est rendue telle quelle. */
export function deplacer<T>(liste: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (i < 0 || i >= liste.length || j < 0 || j >= liste.length) return liste;
  const r = [...liste];
  [r[i], r[j]] = [r[j]!, r[i]!];
  return r;
}

export interface LigneTour { membre: Membre; servi: Remise | null; prevu: Remise | null }
export interface EtatTour { lignes: LigneTour[]; termine: boolean; aRemettre: Remise[] }

/**
 * Tour courant, avec les mêmes règles que la base : les membres non retirés (invités compris) dans l'ordre des positions,
 * qui a reçu sa part, qui est prévu ; le tour est terminé quand chacun a reçu la sienne.
 */
export function etatTour(membres: Membre[], remises: Remise[], round: number): EtatTour {
  const duTour = remises.filter((r) => r.round === round);
  const lignes = membres.filter((m) => m.status !== "retire")
    .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.display_name.localeCompare(b.display_name, "fr"))
    .map((membre) => ({
      membre,
      servi: duTour.find((r) => r.membership_id === membre.id && r.status === "remis") ?? null,
      prevu: duTour.find((r) => r.membership_id === membre.id && r.status === "prevu") ?? null,
    }));
  return { lignes, termine: lignes.length > 0 && lignes.every((l) => l.servi), aRemettre: duTour.filter((r) => r.status === "prevu") };
}

/** Montant proposé à la remise : collecté du cycle ÷ bénéficiaires ; sans paiements connus, le montant attendu. */
export function montantPropose(remise: Remise, collecte: number | null, k: number): number {
  return collecte === null ? remise.amount_expected : Math.floor(collecte / Math.max(k, 1));
}
