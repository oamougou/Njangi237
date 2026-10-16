import { createClient } from "@supabase/supabase-js";
import { genererJeton, hashJeton } from "./jeton";
import { lienApp, lienWhatsApp, messageWhatsApp, type TypeLien } from "./liens";
import { normaliserTelephone } from "./telephone";
import type { Api, LienEnvoye, MonGroupe, Personne } from "./types";

type SessionServeur = { session: { access_token: string; refresh_token: string } };

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });

  const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  };

  /** Appel de la fonction serveur « comptes » ; remonte son message d'erreur en français. */
  const comptes = async <T>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.functions.invoke("comptes", { body });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const detail = (await ctx?.json?.().catch(() => null)) as { error?: string } | null;
      throw new Error(detail?.error ?? "Service indisponible, réessayez");
    }
    return data as T;
  };

  const ouvrir = async (r: SessionServeur) => {
    const { error } = await sb.auth.setSession(r.session);
    if (error) throw new Error("Connexion impossible, réessayez");
  };

  const base = () => `${location.origin}${location.pathname}`;

  const inviter = async (membershipId: string, type: TypeLien): Promise<LienEnvoye> => {
    const jeton = genererJeton();
    const r = must(await sb.rpc("inviter", { p_membership: membershipId, p_token_hash: await hashJeton(jeton), p_kind: type })) as
      { groupe: string; nom: string; phone: string; expires_at: string };
    const lien = lienApp(base(), type, jeton);
    return { lien, whatsapp: lienWhatsApp(r.phone, messageWhatsApp(type, r.groupe, r.nom, lien)), expire: r.expires_at, nom: r.nom };
  };

  const api: Api = {
    async session(): Promise<Personne | null> {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const p = (await sb.from("people").select("id, phone, full_name").eq("id", data.session.user.id).maybeSingle()).data;
      if (!p) return null;
      return { ...p, admin: Boolean(must(await sb.rpc("is_platform_admin"))) };
    },
    async connexion(telephone, pin) {
      await ouvrir(await comptes<SessionServeur>({ action: "connexion", telephone: normaliserTelephone(telephone), pin }));
    },
    async quitter() { await sb.auth.signOut(); },
    apercu: (jeton) => comptes({ action: "apercu", jeton }),
    async accepter(jeton, pin, nom) { await ouvrir(await comptes<SessionServeur>({ action: "accepter", jeton, pin, nom })); },
    async nouveauPin(jeton, pin) { await ouvrir(await comptes<SessionServeur>({ action: "nouveau_pin", jeton, pin })); },
    // Le serveur vérifie l'ancien PIN (avec le blocage) et dérive le nouveau mot de passe : rien ne passe par auth.updateUser
    async changerPin(ancien, nouveau) { await ouvrir(await comptes<SessionServeur>({ action: "changer_pin", ancien, nouveau })); },
    async amorcer(telephone, nom, pin) {
      await ouvrir(await comptes<SessionServeur>({ action: "amorcer", telephone: normaliserTelephone(telephone), nom, pin }));
    },
    async mesGroupes(): Promise<MonGroupe[]> {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      const rows = must(await sb.from("memberships").select("id, role, groups(id, name, type, amount, frequency)")
        .eq("person_id", data.session.user.id).eq("status", "actif")) as unknown as
        { id: string; role: MonGroupe["role"]; groups: MonGroupe["groupe"] }[];
      return rows.map((r) => ({ membership_id: r.id, role: r.role, groupe: r.groups }))
        .sort((a, b) => a.groupe.name.localeCompare(b.groupe.name, "fr"));
    },
    async creerGroupe(g) {
      const r = must(await sb.rpc("creer_groupe", {
        p_name: g.nom, p_type: g.type, p_amount: g.montant, p_frequency: g.frequence, p_beneficiaries: g.beneficiaires,
        p_treasurer_name: g.tresorier_nom, p_treasurer_phone: g.tresorier_telephone,
      })) as { group_id: string; membership_id: string };
      return inviter(r.membership_id, "invitation");
    },
    inviter,
  };
  return api;
}
