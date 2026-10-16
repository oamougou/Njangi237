# Njangi237 v2 — Lot 2 : comptes — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un administrateur de créer un groupe, d'inviter son trésorier par un lien WhatsApp, et à chacun de se connecter avec numéro + PIN (PIN oublié et changement de PIN compris), dans une première version de l'application v2 publiée sur `v2.njangi237.pages.dev`.

**Architecture:** Les règles (invitations, blocage après 5 PIN faux) vivent en SQL (migration 0007), testées sur PGlite comme au lot 1. Une seule fonction serveur Supabase `comptes` (Deno) fait ce que la base ne peut pas faire : créer un compte Auth, changer un mot de passe, ouvrir une session ; sa logique reçoit ses dépendances en paramètre et se teste sans réseau. L'application React (Vite, PWA) s'appuie sur un contrat `Api` unique ; ce lot n'en livre que l'implémentation Supabase.

**Tech Stack:** PostgreSQL/Supabase, Deno 2.5.6 (`npx deno@2.5.6`), `npm:@supabase/supabase-js@2.118.0`, React 18.3.1, Vite 8.3.4, TypeScript 7.0.2, vite-plugin-pwa 2.0.0, Vitest 4.1.11, Cloudflare Pages (wrangler, déjà connecté).

**Spec:** `docs/superpowers/specs/2026-10-16-njangi237-v2-design.md` (section 3, écrans 1, 2 (liste simple), 6, 7 de la section 5, sections 6 à 8, lot 2 de la section 9).

### Écarts assumés par rapport à la spec

1. **Une fonction serveur `comptes`** avec des actions (`apercu`, `accepter`, `nouveau_pin`, `connexion`) au lieu de quatre fonctions. Raison : un seul déploiement, un seul jeu de dépendances, et le code commun (numéro, jeton, blocage) n'a pas à être partagé entre dossiers.
2. **Pas de fonction serveur `inviter`** : l'application tire le jeton aléatoire (32 octets, WebCrypto), en calcule l'empreinte SHA-256 et appelle la fonction SQL `inviter` qui ne stocke que l'empreinte. Sécurité identique : seul un trésorier (ou l'administrateur pour le premier trésorier) peut enregistrer un lien, et c'est lui qui l'envoie de toute façon.
3. **Changer mon PIN** : l'application vérifie l'ancien PIN par l'action `connexion` (donc avec le blocage), puis `auth.updateUser`. Pas de fonction dédiée.
4. **« Mes groupes »** se limite dans ce lot à la liste des groupes et du rôle ; les montants à payer et les tours arrivent aux lots 3 et 4. Le mode démo arrive au lot 6.

## Global Constraints

- Identifiant interne : `237XXXXXXXXX@njangi237.local`, mot de passe = PIN à 6 chiffres (`^\d{6}$`).
- Normalisation du numéro identique partout : chiffres seuls, préfixe `00` retiré, `237` ajouté devant 9 chiffres, sinon « Numéro de téléphone invalide ». Une seule implémentation TypeScript (`supabase/functions/comptes/telephone.ts`) importée par l'application ; elle doit rester alignée sur `normaliser_telephone` (SQL, lot 1).
- Jeton : 32 octets aléatoires en base64url sans remplissage (43 caractères `[A-Za-z0-9_-]`) ; seule son empreinte SHA-256 hexadécimale (64 caractères) est stockée ; il circule après `#` dans l'URL.
- Expiration : invitation 7 jours, nouveau PIN 24 heures ; usage unique ; un nouveau lien du même type annule le précédent.
- Blocage : 5 échecs → 15 minutes de blocage pour ce numéro.
- Les fonctions SQL « service » (`lire_invitation`, `finaliser_invitation`, `finaliser_nouveau_pin`, `verifier_blocage`, `enregistrer_echec`, `enregistrer_succes`) ne sont exécutables que par `service_role`.
- Messages d'erreur en français ; codes SQL comme au lot 1.
- Je ne saisis jamais de PIN sur le vrai projet : les étapes qui exigent un PIN sont faites par Olivier.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; travail sur la branche `v2-lot2`.
- Commandes : base `cd D:\njangi237\db && npm test` ; fonction `cd D:\njangi237\supabase\functions\comptes && npx -y deno@2.5.6 test` ; application `cd D:\njangi237\app && npm test` et `npm run build`.

## Review Focus

1. **Lien transféré ou rejoué** : un lien déjà utilisé, expiré ou remplacé affiche « Lien invalide ou expiré » et ne crée rien → tests Task 1 (« usage unique », « remplace le précédent ») et Task 2 (« jeton malformé »).
2. **Membre qui a déjà un compte** (il est dans un autre groupe) : l'invitation lui demande son PIN, ne crée pas de second compte, et un PIN faux compte dans le blocage → test Task 2 « compte existant, PIN faux ».
3. **Échec après création du compte Auth** (finalisation refusée) : le compte Auth créé est supprimé, sinon le numéro serait bloqué pour toujours → test Task 2 « finalisation refusée ».
4. **Numéro saisi avec espaces, +237 ou 00237 à l'écran de connexion** : même compte → tests Task 2 (connexion) et Task 3 (`telephone`).
5. **Inscription directe par l'API publique** (`auth.signUp`) qui réserverait le numéro d'un futur membre : fermée dans Supabase → Task 5 étape « Inscriptions fermées », vérifiée par Olivier dans le tableau de bord.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0007_comptes.sql` | `inviter` (clients), fonctions service des invitations et du blocage |
| `db/harness.mjs` (modif.) | `asService` : exécuter en `service_role` |
| `db/tests/comptes.test.mjs` | Tests de 0007 |
| `db/tests/privileges.test.mjs` (modif.) | Liste blanche + fonctions service |
| `supabase/functions/comptes/telephone.ts` | `normaliserTelephone`, `emailInterne`, `pinValide` (partagé avec l'application) |
| `supabase/functions/comptes/jeton.ts` | `genererJeton`, `hashJeton`, `jetonValide` (partagé avec l'application) |
| `supabase/functions/comptes/http.ts` | `ErreurMetier`, `CORS`, `reponse` |
| `supabase/functions/comptes/types.ts` | `Deps`, `Session`, `InfoInvitation` |
| `supabase/functions/comptes/logique.ts` | `traiter(body, deps)` : les quatre actions, sans réseau |
| `supabase/functions/comptes/deps.ts` | Dépendances réelles (supabase-js) |
| `supabase/functions/comptes/index.ts` | Point d'entrée `Deno.serve` |
| `supabase/functions/comptes/*.test.ts` | Tests Deno |
| `app/` | Application v2 (Vite) : `src/lib/*` (logique testée par Vitest), `src/ui/*` (écrans) |

---

### Task 1: Base — invitations et blocage (migration 0007)

**Files:**
- Create: `supabase/migrations/0007_comptes.sql`, `db/tests/comptes.test.mjs`
- Modify: `db/harness.mjs` (ajout de `asService`), `db/tests/privileges.test.mjs` (liste blanche)

**Interfaces:**
- Consumes: lot 1 (`is_treasurer`, `is_platform_admin`, `journaliser`, tables `invitations`, `login_attempts`).
- Produces (authenticated) : `inviter(p_membership uuid, p_token_hash text, p_kind invitation_kind default 'invitation') → jsonb {groupe, nom, phone, expires_at}`.
- Produces (service_role) : `lire_invitation(p_token_hash text) → jsonb {kind, membership_id, groupe, invite_par, nom, phone, compte_existant, person_id}` ; `finaliser_invitation(p_token_hash text, p_person uuid, p_full_name text) → jsonb {group_id}` ; `finaliser_nouveau_pin(p_token_hash text) → jsonb {person_id, phone}` ; `verifier_blocage(p_phone text) → timestamptz|null` ; `enregistrer_echec(p_phone text) → jsonb {echecs, bloque_jusqu}` ; `enregistrer_succes(p_phone text) → void`.

- [ ] **Step 1: Ajouter `asService` au banc de test**

Dans `db/harness.mjs`, après la fonction `rpc`, ajouter :
```js
/** Exécute une requête en tant que service_role (la fonction serveur), sans utilisateur connecté. */
export async function asService(db, sql, params = []) {
  await db.exec("savepoint as_service");
  try {
    await db.query("select set_config('request.jwt.claims', '', true)");
    await db.exec("set local role service_role");
    const res = await db.query(sql, params);
    await db.exec("reset role");
    await db.exec("release savepoint as_service");
    return res.rows;
  } catch (e) {
    await db.exec("rollback to savepoint as_service");
    await db.exec("release savepoint as_service");
    throw e;
  }
}

/** Appelle une fonction scalaire en tant que service_role. */
export async function svc(db, fn, args = []) {
  const ph = args.map((_, i) => `$${i + 1}`).join(", ");
  return (await asService(db, `select ${fn}(${ph}) as r`, args))[0].r;
}
```

- [ ] **Step 2: Écrire le test (échoue)**

`db/tests/comptes.test.mjs` :
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc, svc, as } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const H = (n) => String(n).repeat(64).slice(0, 64);          // empreinte factice : "aaaa…", "bbbb…"
const nouveauCompte = async (id, phone) => db.exec(`insert into auth.users(id, email) values ('${id}','${phone}@njangi237.local')`);

test("le trésorier invite un membre ; seule l'empreinte est stockée", () => scenario(db, async () => {
  await seedPilot(db);
  const r = await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  assert.equal(r.groupe, "Tontine des amis");
  assert.equal(r.nom, "Ines");
  assert.equal(r.phone, "237690000009");
  const [i] = await q(`select kind, token_hash, expires_at > now() + interval '6 days' as sept_jours from invitations`);
  assert.deepEqual(i, { kind: "invitation", token_hash: H("a"), sept_jours: true });
}));

test("inviter : refus pour un non-trésorier, une empreinte mal formée, un membre déjà actif", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.alice, "inviter", [M.invite, H("a")]), /Réservé aux trésoriers/);
  await assert.rejects(rpc(db, P.tres, "inviter", [M.invite, "pas-une-empreinte"]), /Jeton invalide/);
  await assert.rejects(rpc(db, P.tres, "inviter", [M.alice, H("a")]), /déjà rejoint/);
  await assert.rejects(rpc(db, P.tres, "inviter", [M.invite, H("b"), "reinitialisation"]), /pas encore de compte/);
}));

test("l'administrateur invite le premier trésorier d'un groupe qu'il vient de créer, pas un simple membre", () => scenario(db, async () => {
  await seedPilot(db);
  const g = await rpc(db, P.admin, "creer_groupe", ["Njangi du lundi", "tontine", 10000, "hebdomadaire", 1, "Paul", "699112233"]);
  assert.equal((await rpc(db, P.admin, "inviter", [g.membership_id, H("a")])).nom, "Paul");
  await assert.rejects(rpc(db, P.admin, "inviter", [M.invite, H("b")]), /Réservé aux trésoriers/);
}));

test("un nouveau lien remplace le précédent", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  await rpc(db, P.tres, "inviter", [M.invite, H("b")]);
  await assert.rejects(svc(db, "lire_invitation", [H("a")]), /Lien invalide ou expiré/);
  assert.equal((await svc(db, "lire_invitation", [H("b")])).nom, "Ines");
}));

test("lire l'invitation : réservé au service, sans compte existant", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  await assert.rejects(rpc(db, P.alice, "lire_invitation", [H("a")]), /permission denied/);
  const info = await svc(db, "lire_invitation", [H("a")]);
  assert.deepEqual({ ...info, membership_id: undefined }, { kind: "invitation", membership_id: undefined, groupe: "Tontine des amis",
    invite_par: "Tina", nom: "Ines", phone: "237690000009", compte_existant: false, person_id: null });
  await assert.rejects(svc(db, "lire_invitation", [H("z")]), /Lien invalide ou expiré/);
}));

test("accepter avec un nouveau compte : personne créée, adhésion active, lien à usage unique", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  await nouveauCompte(u(9), "237690000009");
  assert.deepEqual(await svc(db, "finaliser_invitation", [H("a"), u(9), "Inès Ngo"]), { group_id: G.tontine });
  assert.deepEqual(await q(`select full_name, phone from people where id = '${u(9)}'`), [{ full_name: "Inès Ngo", phone: "237690000009" }]);
  assert.deepEqual(await q(`select status, person_id from memberships where id = '${M.invite}'`), [{ status: "actif", person_id: u(9) }]);
  assert.equal((await as(db, P.alice, "select * from journal where action = 'membre_rejoint'")).length, 1);
  await assert.rejects(svc(db, "finaliser_invitation", [H("a"), u(9), null]), /Lien invalide ou expiré/);
}));

test("accepter avec un compte existant (membre réintégré)", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  await rpc(db, P.tres, "ajouter_membre", [G.tontine, "Bob", "690000004"]);
  await rpc(db, P.tres, "inviter", [M.bob, H("a")]);
  const info = await svc(db, "lire_invitation", [H("a")]);
  assert.equal(info.compte_existant, true);
  assert.equal(info.person_id, P.bob);
  await svc(db, "finaliser_invitation", [H("a"), P.bob, null]);
  assert.equal((await q(`select status from memberships where id = '${M.bob}'`))[0].status, "actif");
}));

test("un lien ne peut pas servir à un compte d'un autre numéro", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  await assert.rejects(svc(db, "finaliser_invitation", [H("a"), P.alice, null]), /autre numéro/);
}));

test("PIN oublié : lien de 24 h, usage unique, blocage remis à zéro", () => scenario(db, async () => {
  await seedPilot(db);
  await db.exec(`insert into login_attempts(phone, failures) values ('237690000003', 3)`);
  await rpc(db, P.tres, "inviter", [M.alice, H("a"), "reinitialisation"]);
  const info = await svc(db, "lire_invitation", [H("a")]);
  assert.equal(info.kind, "reinitialisation");
  assert.equal(info.person_id, P.alice);
  assert.deepEqual(await svc(db, "finaliser_nouveau_pin", [H("a")]), { person_id: P.alice, phone: "237690000003" });
  assert.equal((await q(`select count(*)::int n from login_attempts`))[0].n, 0);
  await assert.rejects(svc(db, "finaliser_nouveau_pin", [H("a")]), /Lien invalide ou expiré/);
  await rpc(db, P.tres, "inviter", [M.alice, H("b"), "reinitialisation"]);
  await assert.rejects(svc(db, "finaliser_invitation", [H("b"), P.alice, null]), /Lien invalide ou expiré/);
}));

test("blocage après 5 PIN faux, levé par une connexion réussie", () => scenario(db, async () => {
  const tel = "237690000003";
  for (let i = 1; i <= 4; i++) assert.deepEqual(await svc(db, "enregistrer_echec", [tel]), { echecs: i, bloque_jusqu: null });
  assert.equal(await svc(db, "verifier_blocage", [tel]), null);
  const r = await svc(db, "enregistrer_echec", [tel]);
  assert.ok(r.bloque_jusqu);
  assert.ok(await svc(db, "verifier_blocage", [tel]));
  await svc(db, "enregistrer_succes", [tel]);
  assert.equal(await svc(db, "verifier_blocage", [tel]), null);
}));

test("un blocage expiré repart de zéro", () => scenario(db, async () => {
  const tel = "237690000003";
  await db.exec(`insert into login_attempts(phone, failures, locked_until) values ('${tel}', 0, now() - interval '1 minute')`);
  assert.equal(await svc(db, "verifier_blocage", [tel]), null);
  assert.deepEqual(await svc(db, "enregistrer_echec", [tel]), { echecs: 1, bloque_jusqu: null });
}));
```

Dans `db/tests/privileges.test.mjs` : ajouter `"inviter"` à `ALLOWED` (entre `"enregistrer_remise"` et `"is_member"`), puis ajouter à la fin :
```js
const SERVICE = ["enregistrer_echec", "enregistrer_succes", "finaliser_invitation", "finaliser_nouveau_pin",
  "lire_invitation", "verifier_blocage"];

test("les fonctions de la fonction serveur comptes sont exécutables par service_role", async () => {
  const rows = (await executable("service_role")).map((r) => r.proname);
  for (const f of SERVICE) assert.ok(rows.includes(f), f);
});
```

- [ ] **Step 3: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\db && node --test tests/comptes.test.mjs tests/privileges.test.mjs`
Expected: FAIL — `function inviter(unknown, unknown) does not exist` ; privilèges : `inviter` manquant.

- [ ] **Step 4: Écrire `supabase/migrations/0007_comptes.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : comptes (invitations, nouveau PIN, blocage après 5 PIN faux)
-- Les fonctions « service » ne sont appelables que par la fonction serveur comptes (service_role).
-- =====================================================================

create index invitations_membre_idx on invitations(membership_id, kind) where used_at is null;

-- Le trésorier (ou l'administrateur, pour le premier trésorier) enregistre l'empreinte du lien qu'il envoie
create or replace function inviter(p_membership uuid, p_token_hash text, p_kind invitation_kind default 'invitation')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_m memberships%rowtype; v_groupe text; v_exp timestamptz;
begin
  select * into v_m from memberships where id = p_membership for update;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  if not (is_treasurer(v_m.group_id) or (is_platform_admin() and v_m.role = 'tresorier')) then
    raise exception 'Réservé aux trésoriers du groupe' using errcode = '42501';
  end if;
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Jeton invalide' using errcode = '22023'; end if;
  if p_kind = 'invitation' and v_m.status <> 'invite' then
    raise exception 'Ce membre a déjà rejoint le groupe' using errcode = 'P0001';
  end if;
  if p_kind = 'reinitialisation' and (v_m.status <> 'actif' or v_m.person_id is null) then
    raise exception 'Ce membre n''a pas encore de compte' using errcode = 'P0001';
  end if;

  -- Un nouveau lien du même type annule le précédent
  update invitations set expires_at = now()
   where membership_id = p_membership and kind = p_kind and used_at is null and expires_at > now();
  v_exp := now() + case p_kind when 'invitation' then interval '7 days' else interval '24 hours' end;
  insert into invitations(membership_id, kind, token_hash, expires_at, created_by)
  values (p_membership, p_kind, p_token_hash, v_exp, auth.uid());

  select name into v_groupe from groups where id = v_m.group_id;
  perform journaliser(v_m.group_id, case p_kind when 'invitation' then 'invitation_envoyee' else 'nouveau_pin_envoye' end,
                      jsonb_build_object('nom', v_m.display_name), false);
  return jsonb_build_object('groupe', v_groupe, 'nom', v_m.display_name, 'phone', v_m.phone, 'expires_at', v_exp);
end $$;

-- Lecture d'un lien encore valable (écran d'accueil du lien, puis contrôle avant toute action)
create or replace function lire_invitation(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_i invitations%rowtype; v_m memberships%rowtype; v_groupe text; v_par text; v_person uuid;
begin
  select * into v_i from invitations where token_hash = p_token_hash;
  if not found or v_i.used_at is not null or v_i.expires_at <= now() then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0002';
  end if;
  select * into v_m from memberships where id = v_i.membership_id;
  select name into v_groupe from groups where id = v_m.group_id;
  select full_name into v_par from people where id = v_i.created_by;
  v_person := coalesce(v_m.person_id, (select id from people where phone = v_m.phone));
  return jsonb_build_object('kind', v_i.kind, 'membership_id', v_m.id, 'groupe', v_groupe, 'invite_par', v_par,
                            'nom', v_m.display_name, 'phone', v_m.phone,
                            'compte_existant', v_person is not null, 'person_id', v_person);
end $$;

-- Après création (ou vérification) du compte Auth : la personne rejoint le groupe
create or replace function finaliser_invitation(p_token_hash text, p_person uuid, p_full_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_i invitations%rowtype; v_m memberships%rowtype; v_p people%rowtype;
begin
  select * into v_i from invitations where token_hash = p_token_hash for update;
  if not found or v_i.used_at is not null or v_i.expires_at <= now() or v_i.kind <> 'invitation' then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0002';
  end if;
  select * into v_m from memberships where id = v_i.membership_id for update;
  if v_m.status <> 'invite' then raise exception 'Lien invalide ou expiré' using errcode = 'P0002'; end if;

  select * into v_p from people where id = p_person;
  if not found then
    insert into people(id, phone, full_name)
    values (p_person, v_m.phone, coalesce(nullif(btrim(p_full_name), ''), v_m.display_name));
  elsif v_p.phone <> v_m.phone then
    raise exception 'Ce lien est destiné à un autre numéro' using errcode = '42501';
  end if;

  update memberships set person_id = p_person, status = 'actif', joined_at = now() where id = v_m.id;
  update invitations set used_at = now() where id = v_i.id;
  insert into journal(group_id, actor, action, details, visible_to_members)
  values (v_m.group_id, p_person, 'membre_rejoint', jsonb_build_object('nom', v_m.display_name), true);
  return jsonb_build_object('group_id', v_m.group_id);
end $$;

-- Après changement du mot de passe Auth : le lien est consommé et le blocage levé
create or replace function finaliser_nouveau_pin(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_i invitations%rowtype; v_m memberships%rowtype;
begin
  select * into v_i from invitations where token_hash = p_token_hash for update;
  if not found or v_i.used_at is not null or v_i.expires_at <= now() or v_i.kind <> 'reinitialisation' then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0002';
  end if;
  select * into v_m from memberships where id = v_i.membership_id;
  if v_m.person_id is null then raise exception 'Lien invalide ou expiré' using errcode = 'P0002'; end if;

  update invitations set used_at = now() where id = v_i.id;
  delete from login_attempts where phone = v_m.phone;
  insert into journal(group_id, actor, action, details, visible_to_members)
  values (v_m.group_id, v_m.person_id, 'pin_reinitialise', jsonb_build_object('nom', v_m.display_name), false);
  return jsonb_build_object('person_id', v_m.person_id, 'phone', v_m.phone);
end $$;

-- Blocage : 5 échecs → 15 minutes
create or replace function verifier_blocage(p_phone text) returns timestamptz
language sql stable security definer set search_path = public as $$
  select locked_until from login_attempts where phone = p_phone and locked_until > now()
$$;

create or replace function enregistrer_echec(p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v login_attempts%rowtype;
begin
  insert into login_attempts(phone, failures) values (p_phone, 0) on conflict (phone) do nothing;
  select * into v from login_attempts where phone = p_phone for update;
  if v.locked_until is not null and v.locked_until <= now() then
    v.failures := 0; v.locked_until := null;
  end if;
  v.failures := v.failures + 1;
  if v.failures >= 5 then
    v.failures := 0; v.locked_until := now() + interval '15 minutes';
  end if;
  update login_attempts set failures = v.failures, locked_until = v.locked_until where phone = p_phone;
  return jsonb_build_object('echecs', v.failures, 'bloque_jusqu', v.locked_until);
end $$;

create or replace function enregistrer_succes(p_phone text) returns void
language sql security definer set search_path = public as $$
  delete from login_attempts where phone = p_phone
$$;

revoke execute on function inviter(uuid, text, invitation_kind) from public, anon;
grant  execute on function inviter(uuid, text, invitation_kind) to authenticated;
revoke execute on function lire_invitation(text), finaliser_invitation(text, uuid, text), finaliser_nouveau_pin(text),
                           verifier_blocage(text), enregistrer_echec(text), enregistrer_succes(text)
  from public, anon, authenticated;
grant  execute on function lire_invitation(text), finaliser_invitation(text, uuid, text), finaliser_nouveau_pin(text),
                           verifier_blocage(text), enregistrer_echec(text), enregistrer_succes(text)
  to service_role;
```

- [ ] **Step 5: Lancer toute la suite**

Run: `cd D:\njangi237\db && npm test`
Expected: PASS (51 + 11 + 1 = 63 tests).

- [ ] **Step 6: Commit**

```bash
cd D:\njangi237 && git add db supabase/migrations/0007_comptes.sql && git commit -m "Lot 2 : invitations et blocage côté base

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Fonction serveur `comptes`

**Files:**
- Create: `supabase/functions/comptes/{telephone.ts, jeton.ts, http.ts, types.ts, logique.ts, deps.ts, index.ts}`
- Test: `supabase/functions/comptes/{telephone.test.ts, jeton.test.ts, logique.test.ts}`

**Interfaces:**
- Consumes: fonctions service de la Task 1 (via `deps.rpc`).
- Produces (HTTP, `POST /functions/v1/comptes`, sans JWT) :
  - `{action:"apercu", jeton}` → `{type, groupe, invite_par, nom, compte_existant}`
  - `{action:"accepter", jeton, pin, nom?}` → `{session}`
  - `{action:"nouveau_pin", jeton, pin}` → `{session}`
  - `{action:"connexion", telephone, pin}` → `{session}`
  - erreurs : `{error}` avec 400/401/404/409/429/500.
  - `session = {access_token, refresh_token, expires_at, user_id}`.
- Produces (TypeScript partagé avec l'application) : `normaliserTelephone(s: string): string`, `emailInterne(phone: string): string`, `pinValide(x: unknown): boolean`, `genererJeton(): string`, `hashJeton(jeton: string): Promise<string>`, `jetonValide(x: unknown): boolean`.

- [ ] **Step 1: Écrire les tests (échouent)**

`supabase/functions/comptes/telephone.test.ts` :
```ts
import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { emailInterne, normaliserTelephone, pinValide } from "./telephone.ts";

Deno.test("numéros saisis à la camerounaise", () => {
  for (const s of ["6 90 00 00 07", "+237 690 00 00 07", "00237690000007", "237-690-000-007", "690000007"])
    assertEquals(normaliserTelephone(s), "237690000007", s);
  assertThrows(() => normaliserTelephone("12345"), Error, "Numéro de téléphone invalide");
});

Deno.test("identifiant interne et PIN", () => {
  assertEquals(emailInterne("237690000007"), "237690000007@njangi237.local");
  assertEquals(pinValide("012345"), true);
  for (const p of ["12345", "1234567", "12a456", 123456, null]) assertEquals(pinValide(p), false, String(p));
});
```

`supabase/functions/comptes/jeton.test.ts` :
```ts
import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1.0.13";
import { genererJeton, hashJeton, jetonValide } from "./jeton.ts";

Deno.test("jeton : 43 caractères base64url, jamais deux fois le même", () => {
  const a = genererJeton(), b = genererJeton();
  assertMatch(a, /^[A-Za-z0-9_-]{43}$/);
  assertNotEquals(a, b);
  assertEquals(jetonValide(a), true);
  for (const x of ["court", a + "x", a.slice(0, 42) + "=", 42, null]) assertEquals(jetonValide(x), false, String(x));
});

Deno.test("empreinte SHA-256 hexadécimale", async () => {
  assertEquals(await hashJeton("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
```

`supabase/functions/comptes/logique.test.ts` :
```ts
import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { traiter } from "./logique.ts";
import { ErreurMetier } from "./http.ts";
import { genererJeton, hashJeton } from "./jeton.ts";
import type { Deps, InfoInvitation, Session } from "./types.ts";

const SESSION: Session = { access_token: "a", refresh_token: "r", expires_at: 1, user_id: "u-existant" };
const INFO: InfoInvitation = { kind: "invitation", membership_id: "m1", groupe: "Tontine des amis", invite_par: "Tina",
  nom: "Ines", phone: "237690000009", compte_existant: false, person_id: null };

/** Dépendances simulées : chaque appel est noté ; rpc renvoie la valeur (ou l'erreur) prévue pour la fonction. */
function faux(o: { rpc?: Record<string, unknown>; session?: Session | null; creerErreur?: Error } = {}) {
  const appels: [string, unknown][] = [];
  const deps: Deps = {
    rpc: async (fn, args) => { appels.push([fn, args]); const r = o.rpc?.[fn]; if (r instanceof Error) throw r; return r ?? null; },
    creerCompte: async (email) => { appels.push(["creerCompte", email]); if (o.creerErreur) throw o.creerErreur; return "u-nouveau"; },
    supprimerCompte: async (id) => { appels.push(["supprimerCompte", id]); },
    changerPin: async (id) => { appels.push(["changerPin", id]); },
    ouvrirSession: async (email) => { appels.push(["ouvrirSession", email]); return o.session === undefined ? SESSION : o.session; },
  };
  return { deps, appels, noms: () => appels.map(([n]) => n) };
}
const statut = async (p: Promise<unknown>, status: number, msg: string) => {
  const e = await assertRejects(() => p, ErreurMetier, msg);
  assertEquals(e.status, status);
};
const jeton = genererJeton();

Deno.test("aperçu : informations publiques du lien, sans le numéro", async () => {
  const f = faux({ rpc: { lire_invitation: INFO } });
  const r = await traiter({ action: "apercu", jeton }, f.deps);
  assertEquals(r, { type: "invitation", groupe: "Tontine des amis", invite_par: "Tina", nom: "Ines", compte_existant: false });
  assertEquals(f.appels[0], ["lire_invitation", { p_token_hash: await hashJeton(jeton) }]);
});

Deno.test("jeton malformé : refusé sans interroger la base", async () => {
  const f = faux();
  await statut(traiter({ action: "apercu", jeton: "abc" }, f.deps), 404, "Lien invalide ou expiré");
  assertEquals(f.appels.length, 0);
});

Deno.test("accepter avec un nouveau compte", async () => {
  const f = faux({ rpc: { lire_invitation: INFO, finaliser_invitation: { group_id: "g1" } } });
  const r = await traiter({ action: "accepter", jeton, pin: "123456", nom: "Inès" }, f.deps);
  assertEquals(r, { session: SESSION });
  assertEquals(f.noms(), ["lire_invitation", "creerCompte", "finaliser_invitation", "ouvrirSession"]);
  assertEquals(f.appels[1][1], "237690000009@njangi237.local");
  assertEquals(f.appels[2][1], { p_token_hash: await hashJeton(jeton), p_person: "u-nouveau", p_full_name: "Inès" });
});

Deno.test("finalisation refusée : le compte Auth tout juste créé est supprimé", async () => {
  const f = faux({ rpc: { lire_invitation: INFO, finaliser_invitation: new ErreurMetier("Lien invalide ou expiré", 404) } });
  await statut(traiter({ action: "accepter", jeton, pin: "123456" }, f.deps), 404, "Lien invalide ou expiré");
  assertEquals(f.noms(), ["lire_invitation", "creerCompte", "finaliser_invitation", "supprimerCompte"]);
  assertEquals(f.appels[3][1], "u-nouveau");
});

Deno.test("compte existant : le PIN est vérifié, aucun second compte", async () => {
  const f = faux({ rpc: { lire_invitation: { ...INFO, compte_existant: true, person_id: "u-existant" }, finaliser_invitation: {} } });
  await traiter({ action: "accepter", jeton, pin: "123456" }, f.deps);
  assertEquals(f.noms(), ["lire_invitation", "verifier_blocage", "ouvrirSession", "enregistrer_succes", "finaliser_invitation"]);
  assertEquals((f.appels[4][1] as { p_person: string }).p_person, "u-existant");
});

Deno.test("compte existant, PIN faux : compté dans le blocage, rien n'est finalisé", async () => {
  const f = faux({ session: null, rpc: { lire_invitation: { ...INFO, compte_existant: true, person_id: "u-existant" },
    enregistrer_echec: { echecs: 1, bloque_jusqu: null } } });
  await statut(traiter({ action: "accepter", jeton, pin: "000000" }, f.deps), 401, "Numéro ou PIN incorrect");
  assertEquals(f.noms(), ["lire_invitation", "verifier_blocage", "ouvrirSession", "enregistrer_echec"]);
});

Deno.test("PIN mal formé : refusé avant toute création", async () => {
  const f = faux({ rpc: { lire_invitation: INFO } });
  await statut(traiter({ action: "accepter", jeton, pin: "12" }, f.deps), 400, "Le PIN doit contenir 6 chiffres");
  assertEquals(f.noms(), ["lire_invitation"]);
});

Deno.test("nouveau PIN : mot de passe changé, lien consommé, session ouverte", async () => {
  const f = faux({ rpc: { lire_invitation: { ...INFO, kind: "reinitialisation", compte_existant: true, person_id: "u-existant" },
    finaliser_nouveau_pin: {} } });
  assertEquals(await traiter({ action: "nouveau_pin", jeton, pin: "654321" }, f.deps), { session: SESSION });
  assertEquals(f.noms(), ["lire_invitation", "changerPin", "finaliser_nouveau_pin", "ouvrirSession"]);
  assertEquals(f.appels[1][1], "u-existant");
});

Deno.test("un lien d'invitation ne sert pas à changer de PIN, et inversement", async () => {
  await statut(traiter({ action: "nouveau_pin", jeton, pin: "654321" }, faux({ rpc: { lire_invitation: INFO } }).deps),
    404, "Lien invalide ou expiré");
  await statut(traiter({ action: "accepter", jeton, pin: "654321" },
    faux({ rpc: { lire_invitation: { ...INFO, kind: "reinitialisation" } } }).deps), 404, "Lien invalide ou expiré");
});

Deno.test("connexion : numéro normalisé, succès enregistré", async () => {
  const f = faux();
  assertEquals(await traiter({ action: "connexion", telephone: "+237 6 90 00 00 02", pin: "123456" }, f.deps), { session: SESSION });
  assertEquals(f.appels, [["verifier_blocage", { p_phone: "237690000002" }], ["ouvrirSession", "237690000002@njangi237.local"],
    ["enregistrer_succes", { p_phone: "237690000002" }]]);
});

Deno.test("connexion bloquée : aucune tentative tant que le blocage dure", async () => {
  const f = faux({ rpc: { verifier_blocage: "2026-10-16T12:00:00Z" } });
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "123456" }, f.deps), 429, "Trop d'essais : réessayez après 13:00");
  assertEquals(f.noms(), ["verifier_blocage"]);
});

Deno.test("cinquième PIN faux : le blocage est annoncé", async () => {
  const f = faux({ session: null, rpc: { enregistrer_echec: { echecs: 0, bloque_jusqu: "2026-10-16T12:15:00Z" } } });
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "000000" }, f.deps), 429, "Trop d'essais : réessayez après 13:15");
});

Deno.test("connexion : numéro ou PIN mal formé, action inconnue", async () => {
  await statut(traiter({ action: "connexion", telephone: "12", pin: "123456" }, faux().deps), 400, "Numéro de téléphone invalide");
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "12" }, faux().deps), 401, "Numéro ou PIN incorrect");
  await statut(traiter({ action: "pirater" }, faux().deps), 400, "Action inconnue");
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\supabase\functions\comptes && npx -y deno@2.5.6 test`
Expected: FAIL — `Module not found "file:///…/telephone.ts"`.

- [ ] **Step 3: Écrire les modules**

`supabase/functions/comptes/telephone.ts` :
```ts
// Partagé avec l'application (app/src/lib/telephone.ts) : même règle que normaliser_telephone (SQL).

/** Numéro camerounais : chiffres seuls, préfixe 00 retiré, 237 ajouté devant 9 chiffres. */
export function normaliserTelephone(s: string): string {
  let d = String(s ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "237" + d;
  if (!/^237\d{9}$/.test(d)) throw new Error("Numéro de téléphone invalide");
  return d;
}

/** Identifiant Supabase Auth construit à partir du numéro (le membre ne le voit jamais). */
export const emailInterne = (phone: string) => `${phone}@njangi237.local`;

export const pinValide = (x: unknown): x is string => typeof x === "string" && /^\d{6}$/.test(x);
```

`supabase/functions/comptes/jeton.ts` :
```ts
// Partagé avec l'application : le jeton est tiré sur le téléphone du trésorier, seule son empreinte est stockée.

/** 32 octets aléatoires en base64url sans remplissage (43 caractères). */
export function genererJeton(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const jetonValide = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{43}$/.test(x);

/** Empreinte SHA-256 en hexadécimal (64 caractères). */
export async function hashJeton(jeton: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("");
}
```

`supabase/functions/comptes/http.ts` :
```ts
/** Erreur destinée à l'utilisateur, avec son code HTTP. */
export class ErreurMetier extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const reponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
```

`supabase/functions/comptes/types.ts` :
```ts
export interface Session { access_token: string; refresh_token: string; expires_at?: number; user_id: string }

export interface InfoInvitation {
  kind: "invitation" | "reinitialisation";
  membership_id: string; groupe: string; invite_par: string | null;
  nom: string; phone: string; compte_existant: boolean; person_id: string | null;
}

/** Tout ce qui touche au réseau : remplacé par un faux dans les tests. */
export interface Deps {
  /** Appel d'une fonction SQL en service_role ; lève ErreurMetier avec le message de la base. */
  rpc(fn: string, args: Record<string, unknown>): Promise<any>;
  /** Crée le compte Auth (e-mail interne + PIN), renvoie son identifiant. */
  creerCompte(email: string, pin: string): Promise<string>;
  supprimerCompte(id: string): Promise<void>;
  changerPin(id: string, pin: string): Promise<void>;
  /** Ouvre une session ; null si le PIN est faux. */
  ouvrirSession(email: string, pin: string): Promise<Session | null>;
}
```

`supabase/functions/comptes/logique.ts` :
```ts
import { ErreurMetier } from "./http.ts";
import { hashJeton, jetonValide } from "./jeton.ts";
import { emailInterne, normaliserTelephone, pinValide } from "./telephone.ts";
import type { Deps, InfoInvitation, Session } from "./types.ts";

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" });

/** Connexion protégée : refusée pendant un blocage, chaque PIN faux est compté (5 → 15 minutes). */
async function ouvrirSessionProtegee(phone: string, pin: string, deps: Deps): Promise<Session> {
  const bloque: string | null = await deps.rpc("verifier_blocage", { p_phone: phone });
  if (bloque) throw new ErreurMetier(`Trop d'essais : réessayez après ${heure(bloque)}`, 429);
  const session = await deps.ouvrirSession(emailInterne(phone), pin);
  if (!session) {
    const r: { bloque_jusqu: string | null } = await deps.rpc("enregistrer_echec", { p_phone: phone });
    if (r?.bloque_jusqu) throw new ErreurMetier(`Trop d'essais : réessayez après ${heure(r.bloque_jusqu)}`, 429);
    throw new ErreurMetier("Numéro ou PIN incorrect", 401);
  }
  await deps.rpc("enregistrer_succes", { p_phone: phone });
  return session;
}

const LIEN_INVALIDE = () => new ErreurMetier("Lien invalide ou expiré", 404);

// deno-lint-ignore no-explicit-any
export async function traiter(body: any, deps: Deps): Promise<unknown> {
  const action = body?.action;

  if (action === "connexion") {
    let phone: string;
    try { phone = normaliserTelephone(String(body.telephone ?? "")); }
    catch (e) { throw new ErreurMetier((e as Error).message, 400); }
    if (!pinValide(body.pin)) throw new ErreurMetier("Numéro ou PIN incorrect", 401);
    return { session: await ouvrirSessionProtegee(phone, body.pin, deps) };
  }

  if (!["apercu", "accepter", "nouveau_pin"].includes(action)) throw new ErreurMetier("Action inconnue", 400);
  if (!jetonValide(body.jeton)) throw LIEN_INVALIDE();
  const hash = await hashJeton(body.jeton);
  const info: InfoInvitation = await deps.rpc("lire_invitation", { p_token_hash: hash });

  if (action === "apercu") {
    return { type: info.kind, groupe: info.groupe, invite_par: info.invite_par, nom: info.nom, compte_existant: info.compte_existant };
  }

  if (!pinValide(body.pin)) throw new ErreurMetier("Le PIN doit contenir 6 chiffres", 400);
  const email = emailInterne(info.phone);

  if (action === "accepter") {
    if (info.kind !== "invitation") throw LIEN_INVALIDE();
    if (info.compte_existant) {
      const session = await ouvrirSessionProtegee(info.phone, body.pin, deps);
      await deps.rpc("finaliser_invitation", { p_token_hash: hash, p_person: session.user_id, p_full_name: null });
      return { session };
    }
    const id = await deps.creerCompte(email, body.pin);
    try {
      await deps.rpc("finaliser_invitation", { p_token_hash: hash, p_person: id, p_full_name: body.nom ?? null });
    } catch (e) {
      await deps.supprimerCompte(id);   // sinon le numéro resterait pris par un compte sans groupe
      throw e;
    }
    const session = await deps.ouvrirSession(email, body.pin);
    if (!session) throw new ErreurMetier("Compte créé : connectez-vous avec votre numéro et votre PIN", 500);
    return { session };
  }

  // nouveau_pin
  if (info.kind !== "reinitialisation" || !info.person_id) throw LIEN_INVALIDE();
  await deps.changerPin(info.person_id, body.pin);
  await deps.rpc("finaliser_nouveau_pin", { p_token_hash: hash });
  const session = await deps.ouvrirSession(email, body.pin);
  if (!session) throw new ErreurMetier("PIN changé : connectez-vous avec votre numéro et votre nouveau PIN", 500);
  return { session };
}
```

`supabase/functions/comptes/deps.ts` :
```ts
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
```

`supabase/functions/comptes/index.ts` :
```ts
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
```

- [ ] **Step 4: Lancer les tests et la vérification des types**

Run: `cd D:\njangi237\supabase\functions\comptes && npx -y deno@2.5.6 test && npx -y deno@2.5.6 check index.ts`
Expected: tous les tests PASS (2 + 2 + 13) ; `check` sans erreur.

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add supabase/functions/comptes && git commit -m "Lot 2 : fonction serveur comptes (invitations, nouveau PIN, connexion)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Application — socle et logique testée

**Files:**
- Create: `app/package.json`, `app/vite.config.ts`, `app/tsconfig.json`, `app/index.html`, `app/.env.example`, `app/public/icon-192.png`, `app/public/icon-512.png` (copies de la racine)
- Create: `app/src/lib/telephone.ts`, `app/src/lib/jeton.ts`, `app/src/lib/routes.ts`, `app/src/lib/liens.ts`
- Test: `app/src/lib/telephone.test.ts`, `app/src/lib/routes.test.ts`, `app/src/lib/liens.test.ts`
- Modify: `.gitignore` (ajouter `app/dist/`, `app/.env`)

**Interfaces:**
- Consumes: `supabase/functions/comptes/telephone.ts`, `jeton.ts` (Task 2).
- Produces: `normaliserTelephone`, `afficherTelephone(phone: string): string` ; `genererJeton`, `hashJeton` ; `type Route = {nom:"accueil"} | {nom:"profil"} | {nom:"admin"} | {nom:"invitation"|"nouveau-pin"; jeton:string}`, `lireRoute(hash: string): Route` ; `lienApp(base: string, type: TypeLien, jeton: string): string`, `messageWhatsApp(type: TypeLien, groupe: string, nom: string, lien: string): string`, `lienWhatsApp(phone: string, message: string): string`, `type TypeLien = "invitation" | "reinitialisation"`.

- [ ] **Step 1: Créer le socle**

`app/package.json` :
```json
{
  "name": "njangi237",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.118.0",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "18.3.31",
    "@types/react-dom": "18.3.7",
    "@vitejs/plugin-react": "6.1.2",
    "typescript": "7.0.2",
    "vite": "8.3.4",
    "vite-plugin-pwa": "2.0.0",
    "vitest": "4.1.11"
  }
}
```

`app/vite.config.ts` :
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Njangi237 — Recouvrement communautaire",
        short_name: "Njangi237",
        description: "Tontines et cotisations : paiements, tours et rappels WhatsApp",
        lang: "fr",
        start_url: "./#/",
        display: "standalone",
        background_color: "#F6F4EC",
        theme_color: "#0F5C4E",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,png}"], navigateFallback: "index.html" },
    }),
  ],
  build: { target: "es2020" },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

`app/tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vite-plugin-pwa/client"],
    "noUnusedLocals": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

`app/index.html` :
```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0F5C4E">
  <link rel="icon" href="icon-192.png">
  <link rel="apple-touch-icon" href="icon-192.png">
  <title>Njangi237</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

`app/.env.example` :
```
VITE_SUPABASE_URL=https://jviedpdlyqixpfynekqs.supabase.co
VITE_SUPABASE_ANON_KEY=
```

Copier les icônes et compléter `.gitignore` :
```bash
cd D:\njangi237 && mkdir -p app/public && cp icon-192.png icon-512.png app/public/ && printf "app/dist/\napp/.env\n" >> .gitignore
```

Installer : `cd D:\njangi237\app && npm install`
Expected: installation sans erreur (avertissements de dépréciation tolérés).

- [ ] **Step 2: Écrire les tests (échouent)**

`app/src/lib/telephone.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { afficherTelephone, normaliserTelephone } from "./telephone";

describe("téléphone", () => {
  it("normalise comme la base et la fonction serveur", () => {
    expect(normaliserTelephone("+237 6 90 00 00 07")).toBe("237690000007");
    expect(() => normaliserTelephone("123")).toThrow("Numéro de téléphone invalide");
  });
  it("affiche un numéro lisible", () => {
    expect(afficherTelephone("237690000007")).toBe("6 90 00 00 07");
    expect(afficherTelephone("autre")).toBe("autre");
  });
});
```

`app/src/lib/routes.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { lireRoute } from "./routes";

describe("routes", () => {
  it("liens d'invitation et de nouveau PIN", () => {
    expect(lireRoute("#/invitation/abc_DEF-1")).toEqual({ nom: "invitation", jeton: "abc_DEF-1" });
    expect(lireRoute("#/nouveau-pin/xyz")).toEqual({ nom: "nouveau-pin", jeton: "xyz" });
  });
  it("écrans et valeur par défaut", () => {
    expect(lireRoute("#/profil")).toEqual({ nom: "profil" });
    expect(lireRoute("#/admin")).toEqual({ nom: "admin" });
    for (const h of ["", "#", "#/", "#/invitation", "#/inconnu"]) expect(lireRoute(h)).toEqual({ nom: "accueil" });
  });
});
```

`app/src/lib/liens.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { lienApp, lienWhatsApp, messageWhatsApp } from "./liens";

describe("liens", () => {
  const base = "https://v2.njangi237.pages.dev/";
  it("lien de l'application selon le type", () => {
    expect(lienApp(base, "invitation", "J")).toBe("https://v2.njangi237.pages.dev/#/invitation/J");
    expect(lienApp(base, "reinitialisation", "J")).toBe("https://v2.njangi237.pages.dev/#/nouveau-pin/J");
  });
  it("message WhatsApp pré-rempli et encodé", () => {
    const m = messageWhatsApp("invitation", "Tontine des amis", "Ines", "https://x/#/invitation/J");
    expect(m).toContain("Ines");
    expect(m).toContain("Tontine des amis");
    expect(m).toContain("https://x/#/invitation/J");
    expect(messageWhatsApp("reinitialisation", "T", "Ines", "L")).toContain("nouveau PIN");
    expect(lienWhatsApp("237690000009", "a & b")).toBe("https://wa.me/237690000009?text=a%20%26%20b");
  });
});
```

- [ ] **Step 3: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\app && npm test`
Expected: FAIL — `Failed to resolve import "./telephone"` (et `./routes`, `./liens`).

- [ ] **Step 4: Écrire les modules**

`app/src/lib/telephone.ts` :
```ts
// Une seule règle de numéro pour la base, la fonction serveur et l'application.
export { normaliserTelephone } from "../../../supabase/functions/comptes/telephone.ts";

/** 237690000007 → « 6 90 00 00 07 » ; tout autre format est rendu tel quel. */
export const afficherTelephone = (p: string) => p.replace(/^237(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5");
```

`app/src/lib/jeton.ts` :
```ts
export { genererJeton, hashJeton } from "../../../supabase/functions/comptes/jeton.ts";
```

`app/src/lib/routes.ts` :
```ts
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
```

`app/src/lib/liens.ts` :
```ts
export type TypeLien = "invitation" | "reinitialisation";

/** Le jeton est placé après « # » : il n'est jamais envoyé au serveur d'hébergement. */
export const lienApp = (base: string, type: TypeLien, jeton: string) =>
  `${base}#/${type === "invitation" ? "invitation" : "nouveau-pin"}/${jeton}`;

export function messageWhatsApp(type: TypeLien, groupe: string, nom: string, lien: string): string {
  return type === "invitation"
    ? `Bonjour ${nom}, vous êtes invité(e) à rejoindre « ${groupe} » sur Njangi237. Ouvrez ce lien et choisissez votre code PIN (valable 7 jours) : ${lien}`
    : `Bonjour ${nom}, voici votre lien pour choisir un nouveau PIN Njangi237 (« ${groupe} », valable 24 h) : ${lien}`;
}

export const lienWhatsApp = (phone: string, message: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
```

- [ ] **Step 5: Lancer les tests**

Run: `cd D:\njangi237\app && npm test`
Expected: PASS (3 fichiers, 6 tests).

- [ ] **Step 6: Commit**

```bash
cd D:\njangi237 && git add .gitignore app && git commit -m "Lot 2 : socle de l'application v2 et logique des liens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Application — accès Supabase et écrans

**Files:**
- Create: `app/src/lib/types.ts`, `app/src/lib/supabaseApi.ts`, `app/src/lib/api.ts`
- Create: `app/src/main.tsx`, `app/src/App.tsx`, `app/src/styles.css`
- Create: `app/src/ui/{Connexion.tsx, Invitation.tsx, Coque.tsx, MesGroupes.tsx, Profil.tsx, Admin.tsx, Lien.tsx, Champ.tsx}`

**Interfaces:**
- Consumes: Task 3 (`normaliserTelephone`, `afficherTelephone`, `genererJeton`, `hashJeton`, `lireRoute`, `lienApp`, `messageWhatsApp`, `lienWhatsApp`) ; RPC `creer_groupe`, `inviter`, `is_platform_admin` ; fonction serveur `comptes`.
- Produces: contrat `Api` (ci-dessous) que les lots 3 à 6 étendront ; écrans Connexion, Invitation / Nouveau PIN, Mes groupes, Profil, Administration.

- [ ] **Step 1: Écrire le contrat et l'accès Supabase**

`app/src/lib/types.ts` :
```ts
import type { TypeLien } from "./liens";

export type RoleGroupe = "tresorier" | "membre";
export interface Personne { id: string; phone: string; full_name: string; admin: boolean }
export interface MonGroupe {
  membership_id: string; role: RoleGroupe;
  groupe: { id: string; name: string; type: string; amount: number; frequency: string };
}
export interface Apercu { type: TypeLien; groupe: string; invite_par: string | null; nom: string; compte_existant: boolean }
export interface NouveauGroupe {
  nom: string; type: "tontine" | "cotisation" | "association" | "autre"; montant: number;
  frequence: "hebdomadaire" | "mensuelle" | "ponctuelle"; beneficiaires: number;
  tresorier_nom: string; tresorier_telephone: string;
}
export interface LienEnvoye { lien: string; whatsapp: string; expire: string; nom: string }

/** Contrat unique de l'application (le mode démo du lot 6 l'implémentera aussi). */
export interface Api {
  session(): Promise<Personne | null>;
  connexion(telephone: string, pin: string): Promise<void>;
  quitter(): Promise<void>;
  apercu(jeton: string): Promise<Apercu>;
  accepter(jeton: string, pin: string, nom?: string): Promise<void>;
  nouveauPin(jeton: string, pin: string): Promise<void>;
  changerPin(ancien: string, nouveau: string): Promise<void>;
  mesGroupes(): Promise<MonGroupe[]>;
  creerGroupe(g: NouveauGroupe): Promise<LienEnvoye>;
  inviter(membershipId: string, type: TypeLien): Promise<LienEnvoye>;
}
```

`app/src/lib/supabaseApi.ts` :
```ts
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
    async changerPin(ancien, nouveau) {
      const moi = await api.session();
      if (!moi) throw new Error("Session expirée : reconnectez-vous");
      // Vérifie l'ancien PIN par la fonction serveur, donc avec le blocage après 5 essais
      await comptes({ action: "connexion", telephone: moi.phone, pin: ancien });
      const { error } = await sb.auth.updateUser({ password: nouveau });
      if (error) throw new Error("Changement de PIN impossible, réessayez");
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
```

`app/src/lib/api.ts` :
```ts
import { createSupabaseApi } from "./supabaseApi";
import type { Api } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null tant que l'application n'est pas configurée (le mode démo arrive au lot 6). */
export const api: Api | null = url && key ? createSupabaseApi(url, key) : null;
```

- [ ] **Step 2: Écrire les écrans**

`app/src/ui/Champ.tsx` :
```tsx
import type { InputHTMLAttributes } from "react";

export function Champ({ label, aide, ...p }: { label: string; aide?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="champ">
      <span>{label}</span>
      <input {...p} />
      {aide && <small>{aide}</small>}
    </label>
  );
}

/** Saisie d'un PIN : 6 chiffres, clavier numérique, rien d'autre n'est accepté. */
export function ChampPin({ label, valeur, onChange, autoFocus }: { label: string; valeur: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return <Champ label={label} value={valeur} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    inputMode="numeric" autoComplete="off" type="password" placeholder="••••••" className="pin" autoFocus={autoFocus} />;
}
```

`app/src/ui/Connexion.tsx` :
```tsx
import { useState } from "react";
import type { Api } from "../lib/types";
import { Champ, ChampPin } from "./Champ";

export function Connexion({ api, onConnecte }: { api: Api; onConnecte: () => void }) {
  const [tel, setTel] = useState(""); const [pin, setPin] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.connexion(tel, pin); onConnecte(); }
    catch (x) { setErr((x as Error).message); setPin(""); }
    finally { setBusy(false); }
  };
  return (
    <main className="ecran etroit">
      <h1 className="marque">Njangi237</h1>
      <p className="sous">Tontines et cotisations</p>
      <form onSubmit={envoyer} className="carte">
        <Champ label="Numéro de téléphone" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel"
          autoComplete="tel" placeholder="6XX XX XX XX" required autoFocus />
        <ChampPin label="Code PIN" valeur={pin} onChange={setPin} />
        {err && <p className="alerte">{err}</p>}
        <button className="btn principal" disabled={busy || pin.length !== 6 || !tel}>Se connecter</button>
      </form>
      <p className="note">PIN oublié ? Demandez un lien à votre trésorier.</p>
    </main>
  );
}
```

`app/src/ui/Invitation.tsx` :
```tsx
import { useEffect, useState } from "react";
import type { Api, Apercu } from "../lib/types";
import { Champ, ChampPin } from "./Champ";

/** Écran ouvert depuis un lien WhatsApp : rejoindre un groupe, ou choisir un nouveau PIN. */
export function Invitation({ api, jeton, mode, onFini }: { api: Api; jeton: string; mode: "invitation" | "nouveau-pin"; onFini: () => void }) {
  const [info, setInfo] = useState<Apercu | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [nom, setNom] = useState(""); const [pin, setPin] = useState(""); const [pin2, setPin2] = useState("");

  useEffect(() => {
    api.apercu(jeton).then((a) => {
      const attendu = mode === "invitation" ? "invitation" : "reinitialisation";
      if (a.type !== attendu) throw new Error("Lien invalide ou expiré");
      setInfo(a); setNom(a.nom);
    }).catch((e) => setErr((e as Error).message));
  }, [api, jeton, mode]);

  const nouveauPin = mode === "nouveau-pin" || !info?.compte_existant;
  const valide = pin.length === 6 && (!nouveauPin || pin === pin2);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (mode === "invitation") await api.accepter(jeton, pin, info?.compte_existant ? undefined : nom.trim());
      else await api.nouveauPin(jeton, pin);
      onFini();
    } catch (x) { setErr((x as Error).message); setPin(""); setPin2(""); }
    finally { setBusy(false); }
  };

  if (!info) return (
    <main className="ecran etroit">
      <h1 className="marque">Njangi237</h1>
      {err ? <><p className="alerte">{err}</p><p className="note">Demandez un nouveau lien à votre trésorier.</p>
        <a className="btn" href="#/">Aller à la connexion</a></> : <p className="note">Vérification du lien…</p>}
    </main>
  );

  return (
    <main className="ecran etroit">
      <h1 className="marque">Njangi237</h1>
      <form onSubmit={envoyer} className="carte">
        {mode === "invitation" ? <>
          <h2>{info.groupe}</h2>
          <p>{info.invite_par ? `${info.invite_par} vous invite à rejoindre ce groupe.` : "Vous êtes invité(e) à rejoindre ce groupe."}</p>
          {info.compte_existant
            ? <p className="note">Vous avez déjà un compte Njangi237 : entrez votre PIN habituel.</p>
            : <Champ label="Votre nom" value={nom} onChange={(e) => setNom(e.target.value)} required />}
        </> : <>
          <h2>Nouveau PIN</h2>
          <p>Bonjour {info.nom}, choisissez votre nouveau code PIN.</p>
        </>}
        <ChampPin label={nouveauPin ? "Choisissez un PIN (6 chiffres)" : "Votre PIN"} valeur={pin} onChange={setPin} autoFocus />
        {nouveauPin && <ChampPin label="Confirmez le PIN" valeur={pin2} onChange={setPin2} />}
        {nouveauPin && pin2.length === 6 && pin !== pin2 && <p className="alerte">Les deux PIN sont différents.</p>}
        {err && <p className="alerte">{err}</p>}
        <button className="btn principal" disabled={busy || !valide || (mode === "invitation" && nouveauPin && !nom.trim())}>
          {mode === "invitation" ? "Rejoindre le groupe" : "Enregistrer mon PIN"}</button>
      </form>
    </main>
  );
}
```

`app/src/ui/Lien.tsx` :
```tsx
import { useState } from "react";
import type { LienEnvoye } from "../lib/types";

/** Lien prêt à envoyer : bouton WhatsApp (message pré-rempli) et copie du lien. */
export function Lien({ envoi, titre }: { envoi: LienEnvoye; titre: string }) {
  const [copie, setCopie] = useState(false);
  const copier = async () => { await navigator.clipboard.writeText(envoi.lien); setCopie(true); setTimeout(() => setCopie(false), 2000); };
  return (
    <div className="carte succes">
      <h3>{titre}</h3>
      <p>Valable jusqu'au {new Date(envoi.expire).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}, une seule fois.</p>
      <a className="btn principal" href={envoi.whatsapp} target="_blank" rel="noreferrer">Envoyer à {envoi.nom} sur WhatsApp</a>
      <button className="btn" onClick={copier}>{copie ? "Lien copié" : "Copier le lien"}</button>
    </div>
  );
}
```

`app/src/ui/MesGroupes.tsx` :
```tsx
import { useEffect, useState } from "react";
import type { Api, MonGroupe } from "../lib/types";

const TYPE: Record<string, string> = { tontine: "Tontine", cotisation: "Cotisation", association: "Association", autre: "Groupe" };
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export function MesGroupes({ api }: { api: Api }) {
  const [groupes, setGroupes] = useState<MonGroupe[] | null>(null); const [err, setErr] = useState("");
  useEffect(() => { api.mesGroupes().then(setGroupes).catch((e) => setErr((e as Error).message)); }, [api]);
  if (err) return <p className="alerte">{err}</p>;
  if (!groupes) return <p className="note">Chargement…</p>;
  if (!groupes.length) return <div className="vide"><b>Aucun groupe pour l'instant</b><p>Votre trésorier vous enverra un lien d'invitation.</p></div>;
  return (
    <ul className="liste">
      {groupes.map((g) => (
        <li key={g.membership_id} className="carte groupe">
          <div className="ligne"><h3>{g.groupe.name}</h3>
            <span className={`pastille ${g.role}`}>{g.role === "tresorier" ? "Trésorier" : "Membre"}</span></div>
          <p className="note">{TYPE[g.groupe.type] ?? "Groupe"} · {g.groupe.frequency} · {fcfa(g.groupe.amount)} par cycle</p>
        </li>))}
    </ul>
  );
}
```

`app/src/ui/Profil.tsx` :
```tsx
import { useState } from "react";
import { afficherTelephone } from "../lib/telephone";
import type { Api, Personne } from "../lib/types";
import { ChampPin } from "./Champ";

export function Profil({ api, moi, onQuitter }: { api: Api; moi: Personne; onQuitter: () => void }) {
  const [ancien, setAncien] = useState(""); const [nouveau, setNouveau] = useState(""); const [conf, setConf] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(""); setMsg("");
    try { await api.changerPin(ancien, nouveau); setMsg("PIN changé."); setAncien(""); setNouveau(""); setConf(""); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section>
      <div className="carte"><h2>{moi.full_name}</h2><p className="note">{afficherTelephone(moi.phone)}</p></div>
      <form onSubmit={envoyer} className="carte">
        <h3>Changer mon PIN</h3>
        <ChampPin label="PIN actuel" valeur={ancien} onChange={setAncien} />
        <ChampPin label="Nouveau PIN" valeur={nouveau} onChange={setNouveau} />
        <ChampPin label="Confirmez le nouveau PIN" valeur={conf} onChange={setConf} />
        {conf.length === 6 && conf !== nouveau && <p className="alerte">Les deux PIN sont différents.</p>}
        {err && <p className="alerte">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        <button className="btn principal" disabled={busy || ancien.length !== 6 || nouveau.length !== 6 || nouveau !== conf}>Changer le PIN</button>
      </form>
      <button className="btn" onClick={onQuitter}>Se déconnecter</button>
    </section>
  );
}
```

`app/src/ui/Admin.tsx` :
```tsx
import { useState } from "react";
import type { Api, LienEnvoye, NouveauGroupe } from "../lib/types";
import { Champ } from "./Champ";
import { Lien } from "./Lien";

const VIDE: NouveauGroupe = { nom: "", type: "tontine", montant: 0, frequence: "mensuelle", beneficiaires: 1, tresorier_nom: "", tresorier_telephone: "" };

/** Administration de la plateforme (pilote) : création d'un groupe et invitation de son premier trésorier. */
export function Admin({ api }: { api: Api }) {
  const [g, setG] = useState<NouveauGroupe>(VIDE); const [envoi, setEnvoi] = useState<LienEnvoye | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const maj = <K extends keyof NouveauGroupe>(k: K, v: NouveauGroupe[K]) => setG({ ...g, [k]: v });
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { setEnvoi(await api.creerGroupe({ ...g, nom: g.nom.trim(), tresorier_nom: g.tresorier_nom.trim() })); setG(VIDE); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section>
      {envoi && <Lien envoi={envoi} titre="Groupe créé : invitez son trésorier" />}
      <form onSubmit={envoyer} className="carte">
        <h2>Nouveau groupe</h2>
        <Champ label="Nom du groupe" value={g.nom} onChange={(e) => maj("nom", e.target.value)} placeholder="Ex. Tontine Carrefour Magne" required />
        <label className="champ"><span>Type</span>
          <select value={g.type} onChange={(e) => maj("type", e.target.value as NouveauGroupe["type"])}>
            <option value="tontine">Tontine</option><option value="cotisation">Cotisation de quartier</option>
            <option value="association">Association</option><option value="autre">Autre</option>
          </select></label>
        <Champ label="Montant par membre et par cycle (FCFA)" value={g.montant || ""} inputMode="numeric" required
          onChange={(e) => maj("montant", parseInt(e.target.value.replace(/\D/g, "") || "0", 10))} />
        <label className="champ"><span>Fréquence</span>
          <select value={g.frequence} onChange={(e) => maj("frequence", e.target.value as NouveauGroupe["frequence"])}>
            <option value="hebdomadaire">Hebdomadaire</option><option value="mensuelle">Mensuelle</option><option value="ponctuelle">Ponctuelle</option>
          </select></label>
        {g.type === "tontine" && <Champ label="Bénéficiaires par cycle" value={g.beneficiaires} inputMode="numeric"
          onChange={(e) => maj("beneficiaires", Math.max(1, parseInt(e.target.value.replace(/\D/g, "") || "1", 10)))} />}
        <Champ label="Nom du trésorier" value={g.tresorier_nom} onChange={(e) => maj("tresorier_nom", e.target.value)} required />
        <Champ label="Numéro du trésorier" value={g.tresorier_telephone} onChange={(e) => maj("tresorier_telephone", e.target.value)}
          inputMode="tel" placeholder="6XX XX XX XX" required />
        {err && <p className="alerte">{err}</p>}
        <button className="btn principal" disabled={busy || !g.nom.trim() || g.montant <= 0}>Créer le groupe</button>
      </form>
    </section>
  );
}
```

`app/src/ui/Coque.tsx` :
```tsx
import type { Route } from "../lib/routes";
import type { Api, Personne } from "../lib/types";
import { Admin } from "./Admin";
import { MesGroupes } from "./MesGroupes";
import { Profil } from "./Profil";

/** En-tête, navigation et écran courant d'une personne connectée. */
export function Coque({ api, moi, route, onQuitter }: { api: Api; moi: Personne; route: Route; onQuitter: () => void }) {
  const onglet = route.nom === "profil" || (route.nom === "admin" && moi.admin) ? route.nom : "accueil";
  return (
    <>
      <header className="haut">
        <div className="ligne"><h1>Njangi237</h1><span className="note clair">{moi.full_name}</span></div>
        <nav>
          <a href="#/" className={onglet === "accueil" ? "actif" : ""}>Mes groupes</a>
          {moi.admin && <a href="#/admin" className={onglet === "admin" ? "actif" : ""}>Administration</a>}
          <a href="#/profil" className={onglet === "profil" ? "actif" : ""}>Profil</a>
        </nav>
      </header>
      <main className="ecran">
        {onglet === "accueil" && <MesGroupes api={api} />}
        {onglet === "admin" && <Admin api={api} />}
        {onglet === "profil" && <Profil api={api} moi={moi} onQuitter={onQuitter} />}
      </main>
    </>
  );
}
```

`app/src/App.tsx` :
```tsx
import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import { lireRoute } from "./lib/routes";
import type { Personne } from "./lib/types";
import { Connexion } from "./ui/Connexion";
import { Coque } from "./ui/Coque";
import { Invitation } from "./ui/Invitation";

export default function App() {
  const [route, setRoute] = useState(() => lireRoute(location.hash));
  const [moi, setMoi] = useState<Personne | null | undefined>(undefined);

  useEffect(() => {
    const suivre = () => setRoute(lireRoute(location.hash));
    addEventListener("hashchange", suivre);
    return () => removeEventListener("hashchange", suivre);
  }, []);
  const rafraichir = useCallback(() => { api?.session().then(setMoi).catch(() => setMoi(null)); }, []);
  useEffect(() => { rafraichir(); }, [rafraichir]);

  if (!api) return <main className="ecran etroit"><h1 className="marque">Njangi237</h1>
    <p className="alerte">Application non configurée (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).</p></main>;

  if (route.nom === "invitation" || route.nom === "nouveau-pin")
    return <Invitation api={api} jeton={route.jeton} mode={route.nom} onFini={() => { location.hash = "#/"; rafraichir(); }} />;
  if (moi === undefined) return <main className="ecran etroit"><p className="note">Chargement…</p></main>;
  if (!moi) return <Connexion api={api} onConnecte={rafraichir} />;
  return <Coque api={api} moi={moi} route={route} onQuitter={async () => { await api.quitter(); setMoi(null); location.hash = "#/"; }} />;
}
```

`app/src/main.tsx` :
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
```

`app/src/styles.css` :
```css
:root {
  --ink: #1B2321; --ink-soft: #4B5A55; --paper: #F6F4EC; --surface: #FFFFFF; --sunken: #EFEBDD;
  --brand: #0F5C4E; --brand-dark: #0B4239; --gold: #C89B3C; --gold-soft: #EFE0BB;
  --brick: #B8442F; --brick-soft: #F3DCD5; --ok-soft: #DCEAE1; --line: #DAD5C4; --r: 10px;
  --serif: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--paper); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; min-height: 100vh; }
h1, h2, h3 { font-family: var(--serif); font-weight: 400; margin: 0 0 8px; }
.ecran { max-width: 640px; margin: 0 auto; padding: 16px; }
.etroit { max-width: 420px; padding-top: 48px; }
.marque { font-size: 30px; color: var(--brand); text-align: center; }
.sous { text-align: center; color: var(--ink-soft); margin: 0 0 20px; }
.haut { position: sticky; top: 0; z-index: 10; background: var(--brand); color: var(--paper); padding: 14px 16px 0; }
.haut h1 { font-size: 22px; margin: 0; }
.haut nav { display: flex; gap: 4px; margin-top: 10px; overflow-x: auto; }
.haut nav a { color: var(--paper); opacity: .8; text-decoration: none; padding: 8px 12px; border-bottom: 3px solid transparent; white-space: nowrap; }
.haut nav a.actif { opacity: 1; border-color: var(--gold); }
.ligne { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.carte { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); padding: 16px; margin-bottom: 12px; display: grid; gap: 10px; }
.carte.succes { border-color: var(--brand); background: var(--ok-soft); }
.champ { display: grid; gap: 4px; font-size: 13px; color: var(--ink-soft); }
.champ input, .champ select { width: 100%; padding: 11px 12px; border: 1px solid var(--line); border-radius: 6px; font: 16px var(--sans); background: var(--surface); color: var(--ink); }
.champ input.pin { letter-spacing: 6px; font-size: 20px; }
.champ small { font-size: 12px; }
.btn { display: block; width: 100%; text-align: center; padding: 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 15px var(--sans); cursor: pointer; text-decoration: none; }
.btn.principal { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: 600; }
.btn:disabled { opacity: .5; cursor: default; }
.alerte { background: var(--brick-soft); color: var(--brick); padding: 10px 12px; border-radius: 6px; margin: 0; font-size: 14px; }
.ok { background: var(--ok-soft); color: var(--brand-dark); padding: 10px 12px; border-radius: 6px; margin: 0; }
.note { color: var(--ink-soft); font-size: 13px; margin: 0; }
.note.clair { color: var(--paper); opacity: .8; }
.liste { list-style: none; padding: 0; margin: 0; }
.groupe { border-left: 4px solid var(--gold); }
.pastille { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; background: var(--sunken); }
.pastille.tresorier { background: var(--gold-soft); color: #7A5A16; }
.vide { text-align: center; padding: 40px 16px; color: var(--ink-soft); }
.vide b { font-family: var(--serif); font-size: 19px; color: var(--ink); font-weight: 400; }
```

- [ ] **Step 3: Compiler**

Run: `cd D:\njangi237\app && npm test && npm run build`
Expected: tests PASS ; `tsc -b` sans erreur ; `vite build` produit `dist/` avec `sw.js` et `manifest.webmanifest`.

- [ ] **Step 4: Vérifier dans Chrome sans compte**

Run: `cd D:\njangi237\app && npx vite preview --port 4174` (en arrière-plan), puis dans Chrome :
1. `http://localhost:4174/` → écran « Application non configurée » (pas de `.env`) : attendu, le build de la Task 5 aura la configuration.
2. Fermer l'onglet et arrêter le serveur.

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 2 : écrans connexion, invitation, mes groupes, profil, administration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Déploiement et parcours réel

**Files:**
- Create: `app/.env` (non versionné)
- Modify: `README.md` (section v2)

**Interfaces:**
- Consumes: tout le lot.
- Produces: migration 0007 et fonction `comptes` en ligne ; application sur `https://v2.njangi237.pages.dev` ; compte administrateur d'Olivier.

- [ ] **Step 1: Appliquer la migration 0007**

`apply_migration` (projet `jviedpdlyqixpfynekqs`, nom `comptes`) avec le contenu exact du fichier. En cas de « Invalid or expired requestState » : vérifier `supabase_migrations.schema_migrations`, puis relancer.
Puis comparer les empreintes des fonctions locales et distantes (même requête qu'au lot 1, commentaires ignorés) : Expected identiques ; et `has_function_privilege` : `inviter` pour authenticated, les 6 fonctions service absentes pour authenticated.

- [ ] **Step 2: Déployer la fonction serveur**

`deploy_edge_function` : nom `comptes`, `entrypoint_path` `index.ts`, `verify_jwt` **false** (justification : la fonction authentifie elle-même par jeton de lien ou PIN avec blocage ; un JWT est impossible avant connexion), fichiers `index.ts`, `logique.ts`, `deps.ts`, `http.ts`, `types.ts`, `telephone.ts`, `jeton.ts` (pas les `*.test.ts`).
Vérifier sans identifiant :
```bash
curl -s -X POST https://jviedpdlyqixpfynekqs.supabase.co/functions/v1/comptes -H "content-type: application/json" -H "apikey: <clé publique>" -d '{"action":"apercu","jeton":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}'
```
Expected: `{"error":"Lien invalide ou expiré"}` (HTTP 404).

- [ ] **Step 3: Fermer les inscriptions publiques (Olivier)**

Point d'arrêt : demander à Olivier, dans le tableau de bord Supabase du projet `njangi237` : Authentication → Sign In / Providers → désactiver **« Allow new users to sign up »**, puis enregistrer. (Les comptes restent créés par la fonction serveur, qui utilise l'API d'administration.)

- [ ] **Step 4: Compte administrateur d'Olivier (Olivier)**

Point d'arrêt : demander à Olivier de créer son compte dans Authentication → Users → Add user → Create new user : e-mail `237<ses 9 chiffres>@njangi237.local`, mot de passe = le PIN à 6 chiffres qu'il choisit, « Auto Confirm User » coché ; puis de me donner son numéro (jamais son PIN). Ensuite :
```sql
insert into people(id, phone, full_name)
select id, '237XXXXXXXXX', 'Olivier Amougou' from auth.users where email = '237XXXXXXXXX@njangi237.local';
insert into platform_admins(person_id)
select id from auth.users where email = '237XXXXXXXXX@njangi237.local';
```
(L'exécutant remplace `237XXXXXXXXX` par le numéro donné.) Expected: 1 ligne insérée dans chaque table.

- [ ] **Step 5: Construire et publier sur la branche v2**

`get_publishable_keys` → écrire `app/.env` :
```
VITE_SUPABASE_URL=https://jviedpdlyqixpfynekqs.supabase.co
VITE_SUPABASE_ANON_KEY=<clé sb_publishable_… non désactivée>
```
Run: `cd D:\njangi237\app && npm run build && npx wrangler pages deploy dist --project-name njangi237 --branch v2 --commit-dirty=true`
Expected: « Deployment complete » ; `https://v2.njangi237.pages.dev/` affiche l'écran de connexion ; `https://njangi237.pages.dev/` reste la v1.
Vérifier dans Chrome : écran de connexion sans erreur console ; `https://v2.njangi237.pages.dev/#/invitation/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` → « Lien invalide ou expiré ».

- [ ] **Step 6: Parcours réel avec Olivier**

Point d'arrêt : guider Olivier, puis vérifier la base après chaque étape (`execute_sql`) :
1. Connexion sur `https://v2.njangi237.pages.dev` avec son numéro et son PIN → « Mes groupes » vide, onglet Administration visible.
2. Administration → créer « Groupe test » (tontine, 1 000 FCFA, mensuelle) avec lui-même comme trésorier → lien affiché. Vérifier : `memberships` statut `invite`, une ligne `invitations`.
3. Ouvrir le lien (copier-coller dans le navigateur) → « Vous avez déjà un compte » → son PIN → « Mes groupes » montre « Groupe test », Trésorier. Vérifier : adhésion `actif`, `used_at` renseigné, journal `membre_rejoint`.
4. Rouvrir le même lien → « Lien invalide ou expiré ».
5. Profil → changer de PIN, se déconnecter, se reconnecter avec le nouveau PIN.
6. (Facultatif, avec un second téléphone) inviter un proche pour tester la création d'un nouveau compte.

- [ ] **Step 7: Documenter et commit**

Dans `README.md`, section « v2 — base de données (en cours) », ajouter :
```markdown
- Fonction serveur `comptes` (invitations, nouveau PIN, connexion) : `supabase/functions/comptes`, tests `npx -y deno@2.5.6 test`.
- Application v2 : `app/` (`npm test`, `npm run build`), publiée sur https://v2.njangi237.pages.dev :
  `npx wrangler pages deploy dist --project-name njangi237 --branch v2`. Configuration dans `app/.env` (voir `.env.example`).
- Inscriptions publiques fermées dans Supabase Auth : les comptes ne naissent que par invitation.
```
```bash
cd D:\njangi237 && git add README.md && git commit -m "Lot 2 : comptes en ligne (fonction serveur, application v2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
