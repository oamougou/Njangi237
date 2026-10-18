import type { Stockage } from "../horsLigne";
import { lienApp, type TypeLien } from "../liens";
import type { Api, LienEnvoye } from "../types";
import * as cycles from "./cycles";
import { ALICE, etatDemo, TINA } from "./donnees";
import { comptes, estTresorier, refus, VERSION_DEMO, type Ctx, type EtatDemo } from "./etat";
import * as membres from "./membres";
import type { ProfilDemo } from "./modeDemo";
import * as paiements from "./paiements";
import * as tours from "./tours";
import * as vues from "./vues";

export const CLE_ETAT = "njangi.demo.etat";
export const INDISPONIBLE = "Indisponible en mode démo";
const PERSONNE: Record<ProfilDemo, string> = { tina: TINA, alice: ALICE };

/** Sous-ensemble de BroadcastChannel utilisé (remplaçable dans les tests). */
export interface CanalDemo { postMessage(m: unknown): void; addEventListener(type: "message", f: () => void): void }
export interface OptionsDemo {
  stockage: Stockage; profil: () => ProfilDemo; quitter: () => void; base: () => string;
  canal?: CanalDemo | null; maintenant?: () => Date; id?: () => string; hasard?: () => number;
}
export interface DemoApi extends Api { reinitialiser(): void }

function inviterDemo(e: EtatDemo, acteur: string, membershipId: string, type: TypeLien, maintenant: Date, base: string): LienEnvoye {
  const m = e.membres.find((x) => x.id === membershipId) ?? refus("Membre introuvable");
  if (!estTresorier(e, m.group_id, acteur)) refus("Réservé aux trésoriers du groupe");
  if (type === "invitation" && m.status !== "invite") refus("Ce membre a déjà rejoint le groupe");
  if (type === "reinitialisation" && (m.status !== "actif" || !m.person_id)) refus("Ce membre n'a pas encore de compte");
  const duree = type === "invitation" ? 7 * 86_400_000 : 86_400_000;
  return { lien: lienApp(base, type, "demo"), whatsapp: "", expire: new Date(maintenant.getTime() + duree).toISOString(), nom: m.display_name, demo: true };
}

/** Contrat `Api` sur les données fictives : rien ne quitte le navigateur. */
export function createDemoApi(o: OptionsDemo): DemoApi {
  const maintenant = o.maintenant ?? (() => new Date());
  const id = o.id ?? (() => crypto.randomUUID());
  const hasard = o.hasard ?? Math.random;
  const abonnes = new Set<() => void>();
  const prevenirIci = () => abonnes.forEach((f) => f());
  o.canal?.addEventListener("message", prevenirIci);
  const prevenir = () => { prevenirIci(); o.canal?.postMessage("change"); };

  const lire = (): EtatDemo => {
    const brut = o.stockage.lire(CLE_ETAT);
    if (brut) {
      try { const e = JSON.parse(brut) as EtatDemo; if (e.version === VERSION_DEMO) return e; }
      catch { /* état abîmé : on repart des données de démonstration */ }
    }
    const e = etatDemo(maintenant());
    o.stockage.ecrire(CLE_ETAT, JSON.stringify(e));
    return e;
  };
  const acteur = () => PERSONNE[o.profil()];
  const ctx = (): Ctx => ({ acteur: acteur(), maintenant, id, hasard });
  const voir = async <T>(f: (e: EtatDemo, acteur: string) => T): Promise<T> => f(lire(), acteur());
  /** L'état relu est modifié puis enregistré seulement si l'action réussit (comme une transaction). */
  const agir = async <T>(f: (e: EtatDemo, c: Ctx) => T): Promise<T> => {
    const e = lire();
    const r = f(e, ctx());
    o.stockage.ecrire(CLE_ETAT, JSON.stringify(e));
    prevenir();
    return r;
  };
  const indisponible = async (): Promise<never> => refus(INDISPONIBLE);

  return {
    session: () => voir((e, a) => { const p = e.personnes.find((x) => x.id === a)!; return { ...p, admin: false }; }),
    connexion: indisponible, apercu: indisponible, accepter: indisponible, nouveauPin: indisponible, changerPin: indisponible,
    amorcer: indisponible, creerGroupe: indisponible,
    async quitter() { o.quitter(); },
    mesGroupes: () => voir(vues.mesGroupes),
    inviter: (membershipId, type) => voir((e, a) => inviterDemo(e, a, membershipId, type, maintenant(), o.base())),
    chargerGroupe: (groupId) => voir((e, a) => vues.vueGroupe(e, a, groupId)),
    ouvrirCycle: (groupId, libelle, echeance) => agir((e, c) => { cycles.ouvrirCycle(e, c, groupId, libelle, echeance); }),
    cloreCycle: (cycleId) => agir((e, c) => cycles.cloreCycle(e, c, cycleId)),
    rouvrirCycle: (cycleId) => agir((e, c) => cycles.rouvrirCycle(e, c, cycleId)),
    validerPaiement: (pid) => agir((e, c) => paiements.validerPaiement(e, c, pid)),
    contesterPaiement: (pid, motif) => agir((e, c) => paiements.contesterPaiement(e, c, pid, motif)),
    saisirEspeces: (pid, membershipId, cycleId, montant, detteId) =>
      agir((e, c) => paiements.saisirEspeces(e, c, pid, membershipId, cycleId, montant, detteId)),
    ajouterMembre: (groupId, nom, telephone) => agir((e, c) => membres.ajouterMembre(e, c, groupId, nom, telephone)),
    changerRole: (membershipId, role) => agir((e, c) => membres.changerRole(e, c, membershipId, role)),
    apercuRetrait: (membershipId) => voir((e) => membres.apercuRetrait(e, ctx(), membershipId)),
    retirerMembre: (membershipId) => agir((e, c) => { membres.retirerMembre(e, c, membershipId); }),
    chargerVueMembre: (groupId) => voir((e, a) => vues.vueMembre(e, a, groupId)),
    declarerPaiement: (d) => agir((e, c) => paiements.declarerPaiement(e, c, d)),
    abonner(_groupIds, surChangement) { abonnes.add(surChangement); return () => { abonnes.delete(surChangement); }; },
    ordonnerTours: (groupId, ordre) => agir((e, c) => tours.ordonnerTours(e, c, groupId, ordre)),
    tirerAuSort: (groupId) => agir((e, c) => tours.tirerAuSort(e, c, groupId)),
    echangerTours: (a, b) => agir((e, c) => tours.echangerTours(e, c, a, b)),
    remplacerBeneficiaire: (remiseId, membershipId) => agir((e, c) => tours.remplacerBeneficiaire(e, c, remiseId, membershipId)),
    enregistrerRemise: (remiseId, montant, moyen, reference) => agir((e, c) => tours.enregistrerRemise(e, c, remiseId, montant, moyen, reference)),
    nouveauTour: (groupId) => agir((e, c) => tours.nouveauTour(e, c, groupId)),
    lireJournal: (groupId, avant) => voir((e, a) => vues.lireJournal(e, a, groupId, avant)),
    // Abonnements : la démo n'est pas bridée ; l'onglet est en lecture seule
    etatAbonnement: (groupId) => voir((e) => ({ offre: "groupe" as const, limite: 50, fin: null, membres: comptes(e, groupId).length,
      prix_lancement: false, demande: null, historique: [], paiement: { mtn: null, orange: null, beneficiaire: null }, demo: true })),
    demanderAbonnement: indisponible, annulerDemande: indisponible, adminAbonnements: indisponible, accepterDemande: indisponible,
    refuserDemande: indisponible, attribuerPilote: indisponible, creerAssociation: indisponible, changerPrixLancement: indisponible,
    reglerPaiement: indisponible,
    reinitialiser() { o.stockage.supprimer(CLE_ETAT); prevenir(); },
  };
}
