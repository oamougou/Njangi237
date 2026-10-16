import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { ErreurMetier } from "./http.ts";
import type { Deps } from "./types.ts";

const STATUT: Record<string, number> = { P0002: 404, "42501": 403, "22023": 400, P0001: 409, "23505": 409 };

export function depsSupabase(): Deps {
  const url = Deno.env.get("SUPABASE_URL")!;
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, opts);
  // Client neuf à chaque connexion : la session ouverte ne doit jamais se mêler aux appels service_role.
  // Clé publique historique si elle existe encore sur le projet, sinon la clé service (même effet pour signInWithPassword).
  const anon = () => createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, opts);

  return {
    async rpc(fn, args) {
      const { data, error } = await service.rpc(fn, args);
      if (error) throw new ErreurMetier(error.message, STATUT[error.code ?? ""] ?? 400);
      return data;
    },
    async creerCompte(email, pin) {
      const { data, error } = await service.auth.admin.createUser({ email, password: pin, email_confirm: true });
      if (error) {
        const deja = /already|exists|registered/i.test(error.message);
        throw new ErreurMetier(deja ? "Un compte existe déjà pour ce numéro : contactez votre trésorier" : error.message, deja ? 409 : 400);
      }
      return data.user.id;
    },
    async supprimerCompte(id) { await service.auth.admin.deleteUser(id); },
    async changerPin(id, pin) {
      const { error } = await service.auth.admin.updateUserById(id, { password: pin });
      if (error) throw new ErreurMetier(error.message, 400);
    },
    async ouvrirSession(email, pin) {
      const { data, error } = await anon().auth.signInWithPassword({ email, password: pin });
      if (error || !data.session) return null;
      const s = data.session;
      return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user_id: s.user.id };
    },
  };
}
