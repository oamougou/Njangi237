/** Pas de réponse du serveur : l'action peut être retentée (ou mise en file) au retour du réseau. */
export class ErreurReseau extends Error {
  constructor() { super("Pas de réseau : réessayez quand la connexion revient"); }
}

/** Erreur supabase-js → Error en clair ; une coupure (pas de code SQL, échec du fetch) devient ErreurReseau. */
export function versErreur(e: { message?: string; code?: string } | null | undefined): Error {
  const message = e?.message ?? "";
  if (!e?.code && /fetch|network|load failed|timed? ?out/i.test(message)) return new ErreurReseau();
  return new Error(message || "Erreur inattendue, réessayez");
}

export const estReseau = (e: unknown) => e instanceof ErreurReseau || (e instanceof TypeError && /fetch/i.test(e.message));
