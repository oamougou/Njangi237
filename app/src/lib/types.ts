import type { TypeLien } from "./liens";

export type RoleGroupe = "tresorier" | "membre";
export interface Personne { id: string; phone: string; full_name: string; admin: boolean }
export interface MonGroupe {
  membership_id: string; role: RoleGroupe;
  groupe: { id: string; name: string; type: string; amount: number; frequency: string };
}
export interface Apercu { type: TypeLien; groupe: string; invite_par: string | null; nom: string; compte_existant: boolean }
export interface NouveauGroupe {
  nom: string; type: "tontine" | "cotisation" | "association" | "autre"; montant: number;
  frequence: "hebdomadaire" | "mensuelle" | "ponctuelle"; beneficiaires: number;
  tresorier_nom: string; tresorier_telephone: string;
}
export interface LienEnvoye { lien: string; whatsapp: string; expire: string; nom: string }

/** Contrat unique de l'application (le mode démo du lot 6 l'implémentera aussi). */
export interface Api {
  session(): Promise<Personne | null>;
  connexion(telephone: string, pin: string): Promise<void>;
  quitter(): Promise<void>;
  apercu(jeton: string): Promise<Apercu>;
  accepter(jeton: string, pin: string, nom?: string): Promise<void>;
  nouveauPin(jeton: string, pin: string): Promise<void>;
  changerPin(ancien: string, nouveau: string): Promise<void>;
  mesGroupes(): Promise<MonGroupe[]>;
  creerGroupe(g: NouveauGroupe): Promise<LienEnvoye>;
  inviter(membershipId: string, type: TypeLien): Promise<LienEnvoye>;
}
