export type Route =
  | { nom: "accueil" } | { nom: "profil" } | { nom: "admin" }
  | { nom: "invitation" | "nouveau-pin"; jeton: string };

/** « #/invitation/<jeton> » → { nom: "invitation", jeton } ; tout le reste retombe sur l'accueil. */
export function lireRoute(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, "").split("/");
  if ((a === "invitation" || a === "nouveau-pin") && b) return { nom: a, jeton: b };
  if (a === "profil" || a === "admin") return { nom: a };
  return { nom: "accueil" };
}
