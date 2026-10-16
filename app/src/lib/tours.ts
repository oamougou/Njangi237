import type { Cycle, Frequence, OrdreTour } from "./types";

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
