import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../harness.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;

/** Seules fonctions appelables par l'application (rôle authenticated). */
export const ALLOWED = [
  "accepter_demande", "admin_abonnements", "ajouter_membre", "annuler_demande", "apercu_retrait", "attribuer_pilote",
  "changer_prix_lancement", "changer_role", "clore_cycle", "contester_paiement", "creer_association", "creer_groupe",
  "declarer_paiement", "demander_abonnement", "echanger_tours", "enregistrer_remise", "inviter", "is_member",
  "is_platform_admin", "is_treasurer", "lire_journal", "mon_abonnement", "nouveau_tour", "ordonner_tours", "ordre_tours",
  "ouvrir_cycle", "recouvrement", "refuser_demande", "regler_paiement", "remplacer_beneficiaire", "retirer_membre",
  "rouvrir_cycle", "saisir_especes", "tirer_au_sort", "valider_paiement",
];

const executable = (role) => q(`
  select p.proname from pg_proc p
   where p.pronamespace = 'public'::regnamespace and has_function_privilege('${role}', p.oid, 'execute')
   order by 1`);

test("anon ne peut exécuter aucune fonction", async () => {
  assert.deepEqual(await executable("anon"), []);
});

test("authenticated n'exécute que la liste blanche", async () => {
  assert.deepEqual((await executable("authenticated")).map((r) => r.proname), ALLOWED);
});

test("anon n'a aucun droit sur les tables, authenticated seulement la lecture", async () => {
  assert.deepEqual(await q(`select table_name from information_schema.role_table_grants
                             where table_schema = 'public' and grantee = 'anon'`), []);
  assert.deepEqual(await q(`select distinct privilege_type from information_schema.role_table_grants
                             where table_schema = 'public' and grantee = 'authenticated'`), [{ privilege_type: "SELECT" }]);
});

test("toutes les fonctions security definer figent leur search_path", async () => {
  assert.deepEqual(await q(`select proname from pg_proc
                             where pronamespace = 'public'::regnamespace and prosecdef
                               and not exists (select 1 from unnest(proconfig) c where c like 'search_path=%')`), []);
});

test("temps réel : les quatre tables suivies par l'application", async () => {
  assert.deepEqual((await q(`select tablename from pg_publication_tables
                              where pubname = 'supabase_realtime' order by 1`)).map((r) => r.tablename),
    ["cycles", "memberships", "payments", "payouts"]);
});

const SERVICE = ["amorcer_admin", "annuler_essai", "compte_auth_orphelin", "enregistrer_succes", "finaliser_invitation",
  "finaliser_nouveau_pin", "lire_invitation", "reserver_essai"];

test("les fonctions de la fonction serveur comptes sont exécutables par service_role", async () => {
  const rows = (await executable("service_role")).map((r) => r.proname);
  for (const f of SERVICE) assert.ok(rows.includes(f), f);
});
