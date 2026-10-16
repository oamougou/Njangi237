import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { ErreurMetier } from "./http.ts";
import type { Deps } from "./types.ts";

const STATUT: Record<string, number> = { P0002: 404, "42501": 403, "22023": 400, P0001: 409, "23505": 409 };

export function depsSupabase(): Deps {
  const url = Deno.env.get("SUPABASE_URL")!;
  const cleService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const poivre = Deno.env.get("NJANGI_POIVRE");
  if (!poivre || poivre.length < 32) throw new Error("Secret NJANGI_POIVRE absent ou trop court");
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(url, cleService, opts);
  // Client neuf à chaque connexion : la session ouverte ne doit jamais se mêler aux appels service_role.
  const connexion = () => createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? cleService, opts);

  return {
    poivre,
    telephoneAmorce: Deno.env.get("AMORCE_TELEPHONE") ?? null,
    async rpc(fn, args) {
      const { data, error } = await service.rpc(fn, args);
      if (error) throw new ErreurMetier(error.message, STATUT[error.code ?? ""] ?? 400);
      return data;
    },
    async creerCompte(email, motDePasse) {
      const { data, error } = await service.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
      if (error) {
        const deja = /already|exists|registered/i.test(error.message);
        throw new ErreurMetier(deja ? "Un compte existe déjà pour ce numéro : contactez votre trésorier" : error.message, deja ? 409 : 400);
      }
      return data.user.id;
    },
    async supprimerCompte(id) {
      const { error } = await service.auth.admin.deleteUser(id);
      if (error) console.error(`Compte Auth ${id} non supprimé : ${error.message}`);   // repris plus tard via compte_auth_orphelin
    },
    async changerMotDePasse(id, motDePasse) {
      const { error } = await service.auth.admin.updateUserById(id, { password: motDePasse });
      if (error) throw new ErreurMetier(error.message, 400);
    },
    async ouvrirSession(email, motDePasse) {
      const { data, error } = await connexion().auth.signInWithPassword({ email, password: motDePasse });
      if (error) {
        // Seul un mot de passe faux compte comme un PIN faux ; tout le reste (limite de débit, panne) est une indisponibilité
        if (error.code === "invalid_credentials") return null;
        console.error(`Connexion Auth : ${error.status} ${error.code} ${error.message}`);
        throw new ErreurMetier("Service indisponible, réessayez", 503);
      }
      const s = data.session!;
      return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user_id: s.user.id };
    },
    async utilisateur(jwt) {
      const { data, error } = await service.auth.getUser(jwt);
      return error || !data.user?.email ? null : { id: data.user.id, email: data.user.email };
    },
  };
}
