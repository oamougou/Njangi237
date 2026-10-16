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
  if (moi.prevu) return { position, cyclesAvant: 0, date: ouvert ? new Date(ouvert.opened_at) : null };
  const avant = ordre.filter((o) => !o.servi && !o.prevu && (o.position ?? 1e9) < position).length;
  const cyclesAvant = Math.floor(avant / Math.max(k, 1)) + (ouvert ? 1 : 0);
  if (frequence === "ponctuelle") return { position, cyclesAvant, date: null };
  const date = new Date(ouvert ? ouvert.opened_at : aujourdhui);
  if (frequence === "mensuelle") date.setUTCMonth(date.getUTCMonth() + cyclesAvant);
  else date.setUTCDate(date.getUTCDate() + 7 * cyclesAvant);
  return { position, cyclesAvant, date };
}
