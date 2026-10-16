import { createClient } from "@supabase/supabase-js";
import { genererJeton, hashJeton } from "./jeton";
import { lienApp, lienWhatsApp, messageWhatsApp, type TypeLien } from "./liens";
import { normaliserTelephone } from "./telephone";
import { ErreurReseau, versErreur } from "./erreurs";
import { resumerGroupe } from "./resume";
import type { Api, ApercuRetrait, Declaration, LienEnvoye, MonGroupe, Personne, VueGroupe, VueMembre } from "./types";

type SessionServeur = { session: { access_token: string; refresh_token: string } };

export function createSupabaseApi(url: string, key: string): Api {
  // Délai de 15 s par requête : sur un réseau qui « tient » sans débit, une requête bloquée bloquerait l'écran et l'envoi de la file
  const fetchAvecDelai: typeof fetch = (entree, options) => {
    const delai = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(15_000) : undefined;
    return fetch(entree, { ...options, signal: options?.signal ?? delai });
  };
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true }, global: { fetch: fetchAvecDelai } });

  const must = <T>(r: { data: T | null; error: { message: string; code?: string } | null }): T => {
    if (r.error) throw versErreur(r.error);
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
    // Une coupure lève ErreurReseau (jamais « déconnecté ») : l'application reprend alors la personne gardée sur le téléphone
    async session(): Promise<Personne | null> {
      const { data, error } = await sb.auth.getSession();
      if (error) {
        if (error.name === "AuthRetryableFetchError" || /fetch|network|load failed/i.test(error.message)) throw new ErreurReseau();
        return null;
      }
      if (!data.session) return null;
      const p = must(await sb.from("people").select("id, phone, full_name").eq("id", data.session.user.id).maybeSingle()) as
        Omit<Personne, "admin"> | null;
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
      const rows = must(await sb.from("memberships").select("id, role, created_at, groups(id, name, type, amount, frequency)")
        .eq("person_id", data.session.user.id).eq("status", "actif")) as unknown as
        { id: string; role: MonGroupe["role"]; created_at: string; groups: MonGroupe["groupe"] }[];
      rows.sort((a, b) => a.groups.name.localeCompare(b.groups.name, "fr"));
      if (!rows.length) return [];
      // Résumé : cycle ouvert de chaque groupe et paiements de ces cycles (la RLS ne montre au membre que les siens)
      const cycles = must(await sb.from("cycles").select("id, group_id, label, due_date, amount_expected, opened_at")
        .in("group_id", rows.map((r) => r.groups.id)).eq("status", "ouvert")) as
        { id: string; group_id: string; label: string; due_date: string | null; amount_expected: number; opened_at: string }[];
      const paiements = cycles.length ? must(await sb.from("payments").select("cycle_id, membership_id, status, amount")
        .in("cycle_id", cycles.map((c) => c.id)).is("debt_id", null)) as
        { cycle_id: string; membership_id: string; status: string; amount: number }[] : [];
      return rows.map((r) => ({
        membership_id: r.id, role: r.role, groupe: r.groups,
        resume: resumerGroupe(r.role, r.id, r.created_at, cycles.find((c) => c.group_id === r.groups.id) ?? null, paiements),
      }));
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
      const [g, m, c, d] = await Promise.all([
        sb.from("groups").select("id, name, type, amount, frequency, beneficiaries_per_cycle, current_round").eq("id", groupId).maybeSingle(),
        sb.from("memberships").select("id, display_name, phone, role, status, position, person_id, left_balance, created_at")
          .eq("group_id", groupId).order("position", { nullsFirst: false }).order("display_name"),
        sb.from("cycles").select("id, round, number, label, due_date, amount_expected, status, opened_at, closed_at")
          .eq("group_id", groupId).order("round").order("number"),
        sb.from("debts").select("id, membership_id, cycle_id, amount, settled_at").eq("group_id", groupId),
      ]);
      const groupe = must(g) as VueGroupe["groupe"] | null;
      if (!groupe) throw new Error("Groupe introuvable");
      const membres = must(m) as VueGroupe["membres"];
      const cycles = must(c) as VueGroupe["cycles"];
      const dettes = must(d) as VueGroupe["dettes"];
      // Paiements bornés (la limite de 1 000 lignes de l'API couperait les plus récents) :
      // cycle ouvert, dernier cycle clos, et règlements des dettes encore ouvertes.
      const ouvert = cycles.find((x) => x.status === "ouvert");
      const dernierClos = [...cycles].reverse().find((x) => x.status === "clos");
      const filtres: string[] = [];
      const ids = [ouvert?.id, dernierClos?.id].filter(Boolean);
      if (ids.length) filtres.push(`cycle_id.in.(${ids.join(",")})`);
      const dettesOuvertes = dettes.filter((x) => !x.settled_at).map((x) => x.id);
      if (dettesOuvertes.length) filtres.push(`debt_id.in.(${dettesOuvertes.join(",")})`);
      const paiements = filtres.length ? must(await sb.from("payments")
        .select("id, cycle_id, membership_id, debt_id, amount, method, reference, paid_on, status, contest_reason, created_at")
        .eq("group_id", groupId).or(filtres.join(",")).order("created_at")) as VueGroupe["paiements"] : [];
      return {
        role: membres.find((x) => x.person_id === moi && x.status === "actif")?.role ?? "membre",
        groupe, membres, cycles, paiements, dettes,
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
    async chargerVueMembre(groupId): Promise<VueMembre> {
      const { data } = await sb.auth.getSession();
      const moi = data.session?.user.id;
      const [g, m, c, p, d, r, o, rc] = await Promise.all([
        sb.from("groups").select("id, name, type, amount, frequency, beneficiaries_per_cycle, current_round").eq("id", groupId).maybeSingle(),
        sb.from("memberships").select("id, display_name, phone, role, status, position, person_id, left_balance, created_at")
          .eq("group_id", groupId).eq("person_id", moi ?? "").maybeSingle(),
        sb.from("cycles").select("id, round, number, label, due_date, amount_expected, status, opened_at, closed_at")
          .eq("group_id", groupId).order("round").order("number"),
        sb.from("payments").select("id, cycle_id, membership_id, debt_id, amount, method, reference, paid_on, status, contest_reason, created_at")
          .eq("group_id", groupId).order("created_at"),
        sb.from("debts").select("id, membership_id, cycle_id, amount, settled_at").eq("group_id", groupId),
        sb.from("payouts").select("id, cycle_id, round, membership_id, amount_expected, amount, status, paid_on").eq("group_id", groupId),
        sb.rpc("ordre_tours", { p_group: groupId }),
        sb.rpc("recouvrement", { p_group: groupId }),
      ]);
      const groupe = must(g) as VueMembre["groupe"] | null;
      const membre = must(m) as VueMembre["moi"] | null;
      if (!groupe || !membre) throw new Error("Groupe introuvable");
      return {
        groupe, moi: membre, cycles: must(c) as VueMembre["cycles"], paiements: must(p) as VueMembre["paiements"],
        dettes: must(d) as VueMembre["dettes"], remises: must(r) as VueMembre["remises"],
        ordre: must(o) as VueMembre["ordre"], recouvrement: must(rc) as VueMembre["recouvrement"],
      };
    },
    async declarerPaiement(x: Declaration) {
      must(await sb.rpc("declarer_paiement", { p_id: x.id, p_cycle: x.cycleId, p_amount: x.montant, p_method: x.moyen,
        p_reference: x.reference, p_paid_on: x.date, p_debt: x.detteId }));
    },
    abonner(groupIds, surChangement) {
      if (!groupIds.length) return () => {};
      const filtre = `group_id=in.(${groupIds.join(",")})`;
      const canal = sb.channel(`njangi-${groupIds.join("-").slice(0, 60)}-${Math.random().toString(36).slice(2, 8)}`);
      for (const table of ["payments", "cycles", "payouts", "memberships"])
        canal.on("postgres_changes", { event: "*", schema: "public", table, filter: filtre }, () => surChangement());
      canal.subscribe();
      return () => { sb.removeChannel(canal); };
    },
  };
  return api;
}
