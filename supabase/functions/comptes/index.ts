// Fonction serveur « comptes » : invitations, nouveau PIN, connexion par numéro + PIN.
// Sans JWT (verify_jwt = false) : l'authentification est faite ici (jeton du lien ou PIN avec blocage).
import { depsSupabase } from "./deps.ts";
import { CORS, ErreurMetier, reponse } from "./http.ts";
import { traiter } from "./logique.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reponse({ error: "Méthode non autorisée" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    return reponse(await traiter(body, depsSupabase()));
  } catch (e) {
    if (e instanceof ErreurMetier) return reponse({ error: e.message }, e.status);
    console.error(e);
    return reponse({ error: "Erreur inattendue, réessayez" }, 500);
  }
});
