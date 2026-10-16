export type OngletGroupe = "cycle" | "membres" | "tours" | "journal";
export type Route =
  | { nom: "accueil" } | { nom: "profil" } | { nom: "admin" } | { nom: "amorcer" }
  | { nom: "invitation" | "nouveau-pin"; jeton: string }
  | { nom: "groupe"; id: string; onglet: OngletGroupe };

const ONGLETS: OngletGroupe[] = ["membres", "tours", "journal"];

/** « #/invitation/<jeton> » → { nom: "invitation", jeton } ; tout le reste retombe sur l'accueil. */
export function lireRoute(hash: string): Route {
  const [, a, b, c] = hash.replace(/^#/, "").split("/");
  if ((a === "invitation" || a === "nouveau-pin") && b) return { nom: a, jeton: b };
  if (a === "groupe" && b) return { nom: "groupe", id: b, onglet: ONGLETS.find((o) => o === c) ?? "cycle" };
  if (a === "profil" || a === "admin" || a === "amorcer") return { nom: a };
  return { nom: "accueil" };
}
