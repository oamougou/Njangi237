import type { MoyenPaiement } from "../types";
import { cloreCycle, ouvrirCycle } from "./cycles";
import { ajouterPersonne, comptes, etatVide, type Ctx, type EtatDemo } from "./etat";
import { ajouterMembre, creerGroupe, rejoindre } from "./membres";
import { contesterPaiement, declarerPaiement, saisirEspeces, validerPaiement } from "./paiements";
import { enregistrerRemise, ordonnerTours } from "./tours";

export const TINA = "demo-tina";
export const ALICE = "demo-alice";
const JOUR = 86_400_000;
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const libelleMois = (t: number) => { const d = new Date(t); return `${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const jour = (t: number) => new Date(t).toISOString().slice(0, 10);

/** [nom, téléphone (9 chiffres), identifiant de personne ou null pour un invité] ; Tina est ajoutée à la création. */
const AMIS: [string, string, string | null][] = [
  ["Brice Fotso", "690000003", "demo-brice"], ["Clarisse Ndjock", "690000004", "demo-clarisse"], ["Alice Ekane", "690000002", ALICE],
  ["Didier Kamga", "690000005", "demo-didier"], ["Estelle Tchoupo", "690000006", "demo-estelle"], ["Fabrice Essomba", "690000007", "demo-fabrice"],
  ["Grâce Atangana", "690000008", "demo-grace"], ["Hervé Nana", "690000009", "demo-herve"], ["Joël Owona", "690000010", "demo-joel"],
  ["Inès Moukouri", "690000011", null], ["Kevin Priso", "690000012", null],
];

/**
 * Données fictives rejouées avec les règles du moteur (donc toujours cohérentes), datées par rapport à `maintenant` :
 * la tontine a un cycle clos (une dette, cagnotte remise à Brice) et un cycle ouvert (Clarisse bénéficiaire, deux paiements
 * à valider, un contesté, Alice n'a rien payé) ; la cotisation a un cycle ouvert.
 */
export function etatDemo(maintenant: Date): EtatDemo {
  const e = etatVide();
  let t = maintenant.getTime() - 75 * JOUR;
  let n = 0;
  const ctx = (acteur: string): Ctx => ({ acteur, maintenant: () => new Date(t), id: () => `demo-${++n}`, hasard: () => 0.5 });
  const avancer = (jours: number) => { t += jours * JOUR; };
  const tina = ctx(TINA);
  const membre: Record<string, string> = {};   // identifiant de personne (ou nom pour un invité) → adhésion dans la tontine

  ajouterPersonne(e, { id: TINA, full_name: "Tina Mbarga", phone: "237690000001" });
  const t1 = creerGroupe(e, ctx("plateforme"), { nom: "Tontine des amis", type: "tontine", montant: 10000, frequence: "mensuelle",
    beneficiaires: 1, tresorier_nom: "Tina Mbarga", tresorier_telephone: "690000001" });
  rejoindre(e, tina, t1.membershipId);
  membre[TINA] = t1.membershipId;
  const c1g = creerGroupe(e, ctx("plateforme"), { nom: "Cotisation du quartier", type: "cotisation", montant: 5000, frequence: "ponctuelle",
    beneficiaires: 1, tresorier_nom: "Tina Mbarga", tresorier_telephone: "690000001" });
  rejoindre(e, tina, c1g.membershipId);
  avancer(1);
  for (const [nom, tel, personne] of AMIS) {
    const id = ajouterMembre(e, tina, t1.groupId, nom, tel);
    membre[personne ?? nom] = id;
    if (personne) { ajouterPersonne(e, { id: personne, full_name: nom, phone: `237${tel}` }); rejoindre(e, ctx(personne), id); }
  }
  const voisins: Record<string, string> = {};
  for (const [nom, tel, personne] of AMIS.filter(([, , p]) => p === ALICE || p === "demo-herve" || p === "demo-joel" || p === "demo-grace")) {
    const id = ajouterMembre(e, tina, c1g.groupId, nom, tel);
    voisins[personne!] = id;
    rejoindre(e, ctx(personne!), id);
  }
  avancer(1);
  ordonnerTours(e, tina, t1.groupId, ["demo-brice", "demo-clarisse", TINA, ALICE, "demo-didier", "demo-estelle", "demo-fabrice",
    "demo-grace", "demo-herve", "demo-joel", "Inès Moukouri", "Kevin Priso"].map((k) => membre[k]));

  // Cycle 1, clos : tout le monde paie sauf Didier (moitié) ; cagnotte remise à Brice
  avancer(5);
  const c1 = ouvrirCycle(e, tina, t1.groupId, libelleMois(t), jour(t + 25 * JOUR));
  avancer(3);
  const moyens: MoyenPaiement[] = ["mtn_momo", "orange_money", "especes"];
  let k = 0;
  const declarerEtValider = (personne: string, cycleId: string, moyen: MoyenPaiement, montant: number, groupId = t1.groupId) => {
    const c = ctx(personne); const id = c.id();
    declarerPaiement(e, c, { id, groupId, cycleId, montant, moyen, date: jour(t),
      reference: moyen === "especes" ? null : `${moyen === "mtn_momo" ? "MP" : "OM"}${jour(t).replace(/-/g, "")}.${1000 + ++k}`, detteId: null });
    return id;
  };
  saisirEspeces(e, tina, tina.id(), membre[TINA], c1, 10000);
  AMIS.filter(([, , p]) => p && p !== "demo-didier")
    .forEach(([, , personne], i) => validerPaiement(e, tina, declarerEtValider(personne!, c1, moyens[i % 3], 10000)));
  saisirEspeces(e, tina, tina.id(), membre["Inès Moukouri"], c1, 10000);
  saisirEspeces(e, tina, tina.id(), membre["Kevin Priso"], c1, 10000);
  saisirEspeces(e, tina, tina.id(), membre["demo-didier"], c1, 5000);
  avancer(20);
  cloreCycle(e, tina, c1);
  avancer(1);
  const remise1 = e.remises.find((r) => r.cycle_id === c1)!;
  enregistrerRemise(e, tina, remise1.id, remise1.amount_expected, "mtn_momo", `MP${jour(t).replace(/-/g, "")}.0042`);

  // Cycle 2, ouvert depuis 8 jours : Clarisse bénéficiaire
  avancer(36);
  const c2 = ouvrirCycle(e, tina, t1.groupId, libelleMois(t), jour(t + 28 * JOUR));
  avancer(1);
  saisirEspeces(e, tina, tina.id(), membre[TINA], c2, 10000);
  for (const [personne, moyen] of [["demo-brice", "mtn_momo"], ["demo-clarisse", "orange_money"], ["demo-grace", "especes"], ["demo-herve", "mtn_momo"]] as const)
    validerPaiement(e, tina, declarerEtValider(personne, c2, moyen, 10000));
  avancer(2);
  declarerEtValider("demo-estelle", c2, "mtn_momo", 10000);
  declarerEtValider("demo-joel", c2, "especes", 10000);
  contesterPaiement(e, tina, declarerEtValider("demo-fabrice", c2, "orange_money", 10000), "Référence introuvable chez Orange Money");

  // Cotisation : réparation du forage, ouverte depuis 4 jours
  avancer(1);
  const c3 = ouvrirCycle(e, tina, c1g.groupId, "Réparation du forage", jour(t + 10 * JOUR));
  avancer(1);
  saisirEspeces(e, tina, tina.id(), voisins["demo-herve"], c3, 5000);
  validerPaiement(e, tina, declarerEtValider("demo-grace", c3, "mtn_momo", 5000, c1g.groupId));
  declarerEtValider("demo-joel", c3, "orange_money", 5000, c1g.groupId);
  if (comptes(e, t1.groupId).length !== 12 || t > maintenant.getTime()) throw new Error("Données de démonstration incohérentes");
  return e;
}
