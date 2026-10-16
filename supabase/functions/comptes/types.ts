export interface Session { access_token: string; refresh_token: string; expires_at?: number; user_id: string }

export interface InfoInvitation {
  kind: "invitation" | "reinitialisation";
  membership_id: string; groupe: string; invite_par: string | null;
  nom: string; phone: string; compte_existant: boolean; person_id: string | null;
}

/** Tout ce qui touche au réseau ou aux secrets : remplacé par un faux dans les tests. */
export interface Deps {
  /** Clé serveur qui dérive le mot de passe Auth du PIN (secret NJANGI_POIVRE). */
  poivre: string;
  /** Seul numéro autorisé à amorcer la plateforme (secret AMORCE_TELEPHONE), ou null. */
  telephoneAmorce: string | null;
  /** Appel d'une fonction SQL en service_role ; lève ErreurMetier avec le message de la base. */
  // deno-lint-ignore no-explicit-any
  rpc(fn: string, args: Record<string, unknown>): Promise<any>;
  /** Crée le compte Auth ; ErreurMetier 409 si l'e-mail existe déjà. */
  creerCompte(email: string, motDePasse: string): Promise<string>;
  supprimerCompte(id: string): Promise<void>;
  changerMotDePasse(id: string, motDePasse: string): Promise<void>;
  /** Ouvre une session ; null si le mot de passe est faux, ErreurMetier 503 si Auth ne répond pas. */
  ouvrirSession(email: string, motDePasse: string): Promise<Session | null>;
  /** Utilisateur porteur d'un jeton de session, ou null. */
  utilisateur(jwt: string): Promise<{ id: string; email: string } | null>;
}
