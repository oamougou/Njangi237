import type { Bilan } from "./cycle";
import { LIBELLE_ETAT } from "./cycle";
import { dateCourte } from "./format";
import { afficherTelephone } from "./telephone";
import type { Cycle, MoyenPaiement } from "./types";

const MOYEN: Record<MoyenPaiement, string> = { mtn_momo: "MTN MoMo", orange_money: "Orange Money", especes: "Espèces", autre: "Autre" };
const cellule = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** Suivi d'un cycle pour Excel (séparateur ; et BOM UTF-8). `groupe` et `cycle` servent au nom du fichier côté écran. */
export function csvCycle(_groupe: string, _cycle: Cycle, bilan: Bilan): string {
  const lignes = [["Membre", "Téléphone", "Statut", "Montant validé (FCFA)", "Moyen", "Référence", "Date"]];
  for (const l of bilan.lignes) {
    const p = l.dernierValide;
    lignes.push([l.membre.display_name, afficherTelephone(l.membre.phone), LIBELLE_ETAT[l.etat], String(l.valide),
      p ? MOYEN[p.method] : "", p?.reference ?? "", p ? dateCourte(p.paid_on) : ""]);
  }
  return "\uFEFF" + lignes.map((l) => l.map(cellule).join(";")).join("\r\n");
}
