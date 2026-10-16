export interface Session { access_token: string; refresh_token: string; expires_at?: number; user_id: string }

export interface InfoInvitation {
  kind: "invitation" | "reinitialisation";
  membership_id: string; groupe: string; invite_par: string | null;
  nom: string; phone: string; compte_existant: boolean; person_id: string | null;
}

/** Tout ce qui touche au réseau : remplacé par un faux dans les tests. */
export interface Deps {
  /** Appel d'une fonction SQL en service_role ; lève ErreurMetier avec le message de la base. */
  rpc(fn: string, args: Record<string, unknown>): Promise<any>;
  /** Crée le compte Auth (e-mail interne + PIN), renvoie son identifiant. */
  creerCompte(email: string, pin: string): Promise<string>;
  supprimerCompte(id: string): Promise<void>;
  changerPin(id: string, pin: string): Promise<void>;
  /** Ouvre une session ; null si le PIN est faux. */
  ouvrirSession(email: string, pin: string): Promise<Session | null>;
}
