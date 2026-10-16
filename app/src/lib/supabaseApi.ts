import { createClient } from "@supabase/supabase-js";
import { genererJeton, hashJeton } from "./jeton";
import { lienApp, lienWhatsApp, messageWhatsApp, type TypeLien } from "./liens";
import { normaliserTelephone } from "./telephone";
import type { Api, ApercuRetrait, LienEnvoye, MonGroupe, Personne, VueGroupe } from "./types";

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

    async chargerGroupe(groupId): Promise<VueGroupe> {
      const { data } = await sb.auth.getSession();
      const moi = data.session?.user.id;
      const [g, m, c, p, d] = await Promise.all([
        sb.from("groups").select("id, name, type, amount, frequency, beneficiaries_per_cycle, current_round").eq("id", groupId).single(),
        sb.from("memberships").select("id, display_name, phone, role, status, position, person_id, left_balance").eq("group_id", groupId),
        sb.from("cycles").select("id, round, number, label, due_date, amount_expected, status, opened_at, closed_at")
          .eq("group_id", groupId).order("round").order("number"),
        sb.from("payments").select("id, cycle_id, membership_id, debt_id, amount, method, reference, paid_on, status, contest_reason, created_at")
          .eq("group_id", groupId).order("created_at"),
        sb.from("debts").select("id, membership_id, cycle_id, amount, settled_at").eq("group_id", groupId),
      ]);
      const membres = must(m) as VueGroupe["membres"];
      return {
        role: membres.find((x) => x.person_id === moi && x.status === "actif")?.role ?? "membre",
        groupe: must(g) as VueGroupe["groupe"], membres,
        cycles: must(c) as VueGroupe["cycles"], paiements: must(p) as VueGroupe["paiements"], dettes: must(d) as VueGroupe["dettes"],
      };
    },
    async ouvrirCycle(groupId, libelle, echeance) {
      must(await sb.rpc("ouvrir_cycle", { p_group: groupId, p_label: libelle, p_due_date: echeance }));
    },
    cloreCycle: async (cycleId) => must(await sb.rpc("clore_cycle", { p_cycle: cycleId })) as { dettes: number; montant: number },
    async rouvrirCycle(cycleId) { must(await sb.rpc("rouvrir_cycle", { p_cycle: cycleId })); },
    async validerPaiement(id) { must(await sb.rpc("valider_paiement", { p_payment: id })); },
    async contesterPaiement(id, motif) { must(await sb.rpc("contester_paiement", { p_payment: id, p_reason: motif })); },
    async saisirEspeces(id, membershipId, cycleId, montant, detteId) {
      must(await sb.rpc("saisir_especes", { p_id: id, p_membership: membershipId, p_cycle: cycleId, p_amount: montant,
        p_paid_on: null, p_debt: detteId ?? null }));
    },
    ajouterMembre: async (groupId, nom, telephone) =>
      must(await sb.rpc("ajouter_membre", { p_group: groupId, p_name: nom, p_phone: telephone })) as string,
    async changerRole(membershipId, role) { must(await sb.rpc("changer_role", { p_membership: membershipId, p_role: role })); },
    apercuRetrait: async (membershipId) => must(await sb.rpc("apercu_retrait", { p_membership: membershipId })) as ApercuRetrait,
    async retirerMembre(membershipId) { must(await sb.rpc("retirer_membre", { p_membership: membershipId })); },
  };
  return api;
}
