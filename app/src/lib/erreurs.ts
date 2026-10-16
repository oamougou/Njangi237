/** Pas de réponse exploitable du serveur : l'action peut être retentée (ou mise en file) au retour du réseau. */
export class ErreurReseau extends Error {
  constructor() { super("Pas de réseau : réessayez quand la connexion revient"); }
}

/** Session expirée ou appel parti sans session (rafraîchissement du jeton raté pendant une coupure). */
const A_REESSAYER = new Set(["PGRST301", "PGRST302", "PGRST303"]);

/**
 * Erreur supabase-js → Error en clair. Les refus de la base portent toujours un code SQL (P0001, 22023, 42501…) :
 * sans code, la requête n'a pas abouti (coupure, portail captif, page HTML d'un proxy, délai dépassé) → ErreurReseau.
 */
export function versErreur(e: { message?: string; code?: string } | null | undefined): Error {
  if (!e) return new Error("Erreur inattendue, réessayez");
  const message = e.message ?? "";
  if (!e.code) return new ErreurReseau();
  if (A_REESSAYER.has(e.code) || /permission denied for function/i.test(message)) return new ErreurReseau();
  return new Error(message || "Erreur inattendue, réessayez");
}

export const estReseau = (e: unknown) =>
  e instanceof ErreurReseau
  || (e instanceof TypeError && /fetch|load failed/i.test(e.message))
  || (typeof DOMException !== "undefined" && e instanceof DOMException && (e.name === "AbortError" || e.name === "TimeoutError"));
