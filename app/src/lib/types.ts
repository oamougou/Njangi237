import type { TypeLien } from "./liens";

export type RoleGroupe = "tresorier" | "membre";
export interface Personne { id: string; phone: string; full_name: string; admin: boolean }
export interface MonGroupe {
  membership_id: string; role: RoleGroupe;
  groupe: { id: string; name: string; type: string; amount: number; frequency: string };
  resume?: ResumeGroupe;
}
export interface Apercu { type: TypeLien; groupe: string; invite_par: string | null; nom: string; compte_existant: boolean }
export interface NouveauGroupe {
  nom: string; type: "tontine" | "cotisation" | "association" | "autre"; montant: number;
  frequence: Frequence; beneficiaires: number;
  tresorier_nom: string; tresorier_telephone: string;
}
/** `demo` : lien fictif du mode démo (rien n'est envoyé, pas de bouton WhatsApp). */
export interface LienEnvoye { lien: string; whatsapp: string; expire: string; nom: string; demo?: boolean }
export type Frequence = "hebdomadaire" | "mensuelle" | "ponctuelle";
export type MoyenPaiement = "mtn_momo" | "orange_money" | "especes" | "autre";
export interface Groupe {
  id: string; name: string; type: string; amount: number; frequency: Frequence;
  beneficiaries_per_cycle: number; current_round: number; order_locked: boolean;
}
export interface Membre {
  id: string; display_name: string; phone: string; role: RoleGroupe; status: "invite" | "actif" | "retire";
  position: number | null; person_id: string | null; left_balance: number | null; created_at: string;
}
export interface Cycle {
  id: string; round: number; number: number; label: string; due_date: string | null; amount_expected: number;
  status: "ouvert" | "clos"; opened_at: string; closed_at: string | null;
}
export interface Paiement {
  id: string; cycle_id: string; membership_id: string; debt_id: string | null; amount: number; method: MoyenPaiement;
  reference: string | null; paid_on: string; status: "declare" | "valide" | "conteste"; contest_reason: string | null; created_at: string;
}
export interface Dette { id: string; membership_id: string; cycle_id: string; amount: number; settled_at: string | null }
export interface VueGroupe {
  role: RoleGroupe; groupe: Groupe; membres: Membre[]; cycles: Cycle[]; paiements: Paiement[]; dettes: Dette[]; remises: Remise[];
}
/** Entrée du journal lue par `lire_journal` (auteur = nom de la personne, null pour une action automatique). */
export interface EntreeJournal {
  id: number; action: string; details: Record<string, unknown>; created_at: string; auteur: string | null; visible: boolean;
}
export interface ApercuRetrait { deja_servi: boolean; cycles_restants: number; montant_restant: number; dettes: number }
/** Ligne renvoyée par ordre_tours (sans numéro de téléphone). */
export interface OrdreTour {
  membership_id: string; display_name: string; role: RoleGroupe; status: Membre["status"];
  position: number | null; is_me: boolean; servi: boolean; prevu: boolean;
}
export interface Recouvrement { cycle_id: string; membres: number; attendu: number; payes: number; collecte: number }
export interface Remise {
  id: string; cycle_id: string; round: number; membership_id: string; amount_expected: number;
  amount: number | null; status: "prevu" | "remis"; paid_on: string | null;
}
export interface VueMembre {
  groupe: Groupe; moi: Membre; cycles: Cycle[]; paiements: Paiement[]; dettes: Dette[];
  remises: Remise[]; ordre: OrdreTour[]; recouvrement: Recouvrement[];
}
/** Déclaration d'un membre ; l'identifiant est tiré à la saisie pour que les renvois ne créent pas de doublon. */
export interface Declaration {
  id: string; groupId: string; cycleId: string; montant: number; moyen: MoyenPaiement;
  reference: string | null; date: string; detteId: string | null;
}
/** Résumé affiché sur la carte d'un groupe dans « Mes groupes ». */
export interface ResumeGroupe {
  cycleId: string | null; cycle: string | null; echeance: string | null; montant: number | null;
  monEtat: "paye" | "en_attente" | "conteste" | "a_payer" | "hors" | null; aValider: number;
}

export type Offre = "decouverte" | "essai" | "groupe" | "association" | "diaspora" | "pilote";
export type OffrePayante = "groupe" | "association" | "diaspora";
export type Devise = "XAF" | "EUR";
export interface DemandeAbonnement {
  id: string; offre: OffrePayante; duree_mois: 1 | 12; montant: number; devise: Devise; moyen: MoyenPaiement;
  reference: string | null; precisions: string | null; statut: "en_attente" | "acceptee" | "refusee" | "annulee";
  motif: string | null; created_at: string; traitee_le: string | null;
}
export interface PaiementPlateforme { mtn: string | null; orange: string | null; beneficiaire: string | null }
export interface EtatAbonnement {
  offre: Offre; limite: number; fin: string | null; membres: number; prix_lancement: boolean;
  demande: DemandeAbonnement | null; historique: { offre: Offre; debut: string; fin: string }[];
  paiement: PaiementPlateforme; demo?: boolean;
}
export interface NouvelleDemande {
  groupId: string; offre: OffrePayante; dureeMois: 1 | 12; moyen: MoyenPaiement; reference: string | null; precisions: string | null;
}
export interface DemandeAdmin extends DemandeAbonnement { group_id: string; groupe: string; demandeur: string | null }
export interface GroupeAdmin { group_id: string; nom: string; offre: Offre; fin: string | null; limite: number; membres: number; prix_lancement: boolean }
export interface VueAdminAbonnements { demandes: DemandeAdmin[]; groupes: GroupeAdmin[]; lancements: number; paiement: PaiementPlateforme }

/** Contrat unique de l'application (le mode démo du lot 6 l'implémentera aussi). */
export interface Api {
  session(): Promise<Personne | null>;
  connexion(telephone: string, pin: string): Promise<void>;
  quitter(): Promise<void>;
  apercu(jeton: string): Promise<Apercu>;
  accepter(jeton: string, pin: string, nom?: string): Promise<void>;
  nouveauPin(jeton: string, pin: string): Promise<void>;
  changerPin(ancien: string, nouveau: string): Promise<void>;
  /** Création unique du premier administrateur (numéro autorisé côté serveur). */
  amorcer(telephone: string, nom: string, pin: string): Promise<void>;
  mesGroupes(): Promise<MonGroupe[]>;
  creerGroupe(g: NouveauGroupe): Promise<LienEnvoye>;
  inviter(membershipId: string, type: TypeLien): Promise<LienEnvoye>;
  // Trésorier (lot 3)
  chargerGroupe(groupId: string): Promise<VueGroupe>;
  ouvrirCycle(groupId: string, libelle: string, echeance: string | null): Promise<void>;
  cloreCycle(cycleId: string): Promise<{ dettes: number; montant: number }>;
  rouvrirCycle(cycleId: string): Promise<void>;
  validerPaiement(paiementId: string): Promise<void>;
  contesterPaiement(paiementId: string, motif: string): Promise<void>;
  /** Espèces remises au trésorier ; `id` généré par l'appelant (idempotence). */
  saisirEspeces(id: string, membershipId: string, cycleId: string, montant: number, detteId?: string): Promise<void>;
  ajouterMembre(groupId: string, nom: string, telephone: string): Promise<string>;
  changerRole(membershipId: string, role: RoleGroupe): Promise<void>;
  apercuRetrait(membershipId: string): Promise<ApercuRetrait>;
  retirerMembre(membershipId: string): Promise<void>;
  // Membre (lot 4)
  chargerVueMembre(groupId: string): Promise<VueMembre>;
  declarerPaiement(d: Declaration): Promise<void>;
  /** Temps réel : appelle `surChangement` à chaque modification des données de ces groupes ; renvoie la fonction d'arrêt. */
  abonner(groupIds: string[], surChangement: () => void): () => void;
  // Tours et journal (lot 5)
  ordonnerTours(groupId: string, ordre: string[]): Promise<void>;
  /** Tirage côté serveur, inscrit au journal ; renvoie les noms dans le nouvel ordre. */
  tirerAuSort(groupId: string): Promise<string[]>;
  echangerTours(a: string, b: string): Promise<void>;
  remplacerBeneficiaire(remiseId: string, membershipId: string): Promise<void>;
  /** `ecart` = montant remis − montant attendu. */
  enregistrerRemise(remiseId: string, montant: number, moyen: MoyenPaiement, reference: string | null): Promise<{ ecart: number }>;
  nouveauTour(groupId: string): Promise<number>;
  /** 50 entrées au plus, de la plus récente à la plus ancienne ; `avant` = identifiant de la dernière entrée déjà affichée. */
  lireJournal(groupId: string, avant?: number): Promise<EntreeJournal[]>;
  // Abonnements (lot 7)
  /** Trésorier du groupe : offre en vigueur, limite, demande en cours, historique et numéros de paiement. */
  etatAbonnement(groupId: string): Promise<EtatAbonnement>;
  demanderAbonnement(d: NouvelleDemande): Promise<void>;
  annulerDemande(demandeId: string): Promise<void>;
  /** Administrateur de la plateforme. */
  adminAbonnements(): Promise<VueAdminAbonnements>;
  /** `autres` : groupes supplémentaires d'une offre Association (4 au plus). */
  accepterDemande(demandeId: string, autres?: string[]): Promise<void>;
  refuserDemande(demandeId: string, motif: string): Promise<void>;
  /** `fin` : dernier jour inclus, AAAA-MM-JJ. */
  attribuerPilote(groupId: string, fin: string): Promise<void>;
  creerAssociation(groupIds: string[], dureeMois: 1 | 12): Promise<void>;
  changerPrixLancement(groupId: string, actif: boolean): Promise<void>;
  reglerPaiement(mtn: string, orange: string, beneficiaire: string): Promise<void>;
}
