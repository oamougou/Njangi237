# Njangi237 v2 — Lot 1 : base de données — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le schéma PostgreSQL de Njangi237 v2 (tables, droits d'accès, fonctions serveur) testé localement, puis appliqué sur un nouveau projet Supabase.

**Architecture:** Migrations SQL numérotées dans `supabase/migrations/`. Toutes les écritures passent par des fonctions `security definer` ; les lectures directes sont filtrées par RLS ; les lectures agrégées destinées aux membres passent par deux fonctions (`ordre_tours`, `recouvrement`). Les tests tournent dans Node avec PGlite (PostgreSQL 18 en WebAssembly) sur une imitation minimale de Supabase (`db/auth_stub.sql`), chaque test dans une transaction annulée.

**Tech Stack:** PostgreSQL (Supabase), PL/pgSQL, Node 24 (`node:test`), `@electric-sql/pglite@0.5.8`.

**Spec:** `docs/superpowers/specs/2026-10-16-njangi237-v2-design.md` (sections 2, 4, 7, 8 et lot 1 de la section 9).

### Écarts assumés par rapport à la spec

1. **Tests de la base** : `db/tests/*.test.mjs` sur PGlite au lieu de scripts `supabase/tests/*.sql`. Raison : la pile Supabase locale (Docker) demande plusieurs Go de RAM, déjà saturée sur ce PC ; PGlite exécute le vrai moteur PostgreSQL avec rôles et RLS (vérifié le 2026-10-16). Un script de vérification distant (`db/remote_smoke.sql`) rejoue l'essentiel sur Supabase après déploiement.
2. **Vues `v_ordre_tours` et `v_recouvrement`** → fonctions `ordre_tours(groupe)` et `recouvrement(groupe)`. Raison : une vue qui contourne la RLS est signalée en erreur par l'analyseur de sécurité Supabase ; une fonction `security definer` qui vérifie `is_member` donne le même résultat sans alerte bloquante.
3. **Membre « compté »** (attendu, bénéficiaires, dettes) = adhésion au statut `invite` **ou** `actif`. Raison : un membre qui n'a pas encore ouvert son invitation doit quand même cotiser et peut payer en espèces au trésorier. Seuls les membres `actif` ont un compte et peuvent lire ou déclarer.

## Global Constraints

- Montants : entiers FCFA (`int`), toujours `> 0` quand ils sont saisis.
- Numéros : stockés au format `237XXXXXXXXX` (contrainte `^237[0-9]{9}$`), normalisés par `normaliser_telephone`.
- Toute écriture passe par une fonction `security definer set search_path = public` ; `anon` n'a aucun droit ; `authenticated` n'a que `select` sur les tables lisibles et `execute` sur la liste blanche de la Task 7.
- Messages d'erreur en français. Codes : `42501` accès refusé, `22023` saisie invalide, `P0001` règle métier, `P0002` introuvable, `23505` doublon.
- Version de PGlite épinglée : `0.5.8` (publiée le 2026-08-26).
- Les migrations ne sont appliquées sur Supabase qu'à la Task 8, après accord explicite d'Olivier pour créer le projet ; jusque-là, corriger une migration = modifier le fichier existant.
- Messages de commit terminés par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commandes lancées depuis `D:\njangi237\db` : `npm test` = `node --test --test-concurrency=1 tests/` (une base PGlite à la fois, la RAM du PC est limitée).

## Review Focus

1. **Double envoi d'une déclaration** (téléphone qui renvoie la file d'attente après une coupure) : le même `id` renvoie `duplicate: true` sans doublon → test Task 5 « rejouer une déclaration ».
2. **Numéros saisis à la camerounaise** (`6 90 00 00 07`, `+237 690 00 00 07`, `00237690000007`) : tous acceptés et identiques → test Task 3 « normalisation ».
3. **Dernier trésorier qui se rétrograde ou se retire** : refusé, le groupe ne doit jamais rester sans trésorier actif → tests Task 3.
4. **Paiement contesté puis redéclaré** : la contestation libère la place, le membre peut déclarer à nouveau → test Task 5.
5. **Ouverture d'un cycle quand tout le monde a déjà « bouffé »** : message clair invitant à démarrer un nouveau tour, rien n'est créé → test Task 6 « tour complet ».

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0001_schema.sql` | Types, tables, contraintes, index |
| `supabase/migrations/0002_acces.sql` | Privilèges, `is_member`/`is_treasurer`/`is_platform_admin`, RLS, `ordre_tours`, `recouvrement`, publication temps réel |
| `supabase/migrations/0003_groupes_membres.sql` | `normaliser_telephone`, `journaliser`, `exiger_tresorier`, `garder_un_tresorier`, `creer_groupe`, `ajouter_membre`, `changer_role`, `apercu_retrait`, `retirer_membre` |
| `supabase/migrations/0004_cycles.sql` | `designer_beneficiaires`, `ouvrir_cycle`, `clore_cycle`, `rouvrir_cycle` |
| `supabase/migrations/0005_paiements.sql` | `declarer_paiement`, `saisir_especes`, `valider_paiement`, `contester_paiement` |
| `supabase/migrations/0006_tours.sql` | `exiger_tontine`, `ordonner_tours`, `tirer_au_sort`, `echanger_tours`, `remplacer_beneficiaire`, `enregistrer_remise`, `nouveau_tour` |
| `db/package.json` | Dépendance PGlite, script de test |
| `db/auth_stub.sql` | Imitation de Supabase pour les tests (schéma `auth`, rôles, privilèges par défaut, publication) — jamais appliquée sur Supabase |
| `db/harness.mjs` | `freshDb`, `scenario`, `as`, `rpc` |
| `db/fixtures.mjs` | Identifiants fixes et `seedPilot` |
| `db/tests/*.test.mjs` | Un fichier par migration + privilèges |
| `db/remote_smoke.sql` | Vérification rapide sur Supabase (transaction annulée) |

---

### Task 1: Banc de test et schéma

**Files:**
- Create: `db/package.json`, `db/auth_stub.sql`, `db/harness.mjs`, `db/fixtures.mjs`, `db/tests/schema.test.mjs`
- Create: `supabase/migrations/0001_schema.sql`
- Modify: `.gitignore` (déjà `node_modules/`, rien à ajouter si présent)

**Interfaces:**
- Produces: `freshDb(): Promise<PGlite>`, `scenario(db, fn): Promise<void>`, `as(db, uid|null, sql, params?): Promise<rows>`, `rpc(db, uid, fnName, args?): Promise<any>`, `su(db, sql): Promise<void>` (superutilisateur, échec isolé), `pgArray(xs): string` ; `u(n)`, `P`, `G`, `M`, `seedPilot(db)` ; tables et types de `0001_schema.sql`.

- [ ] **Step 1: Créer le banc de test**

`db/package.json` :
```json
{
  "name": "njangi237-db-tests",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test --test-concurrency=1 tests/" },
  "devDependencies": { "@electric-sql/pglite": "0.5.8" }
}
```

`db/auth_stub.sql` :
```sql
-- Imitation minimale de Supabase pour les tests locaux (PGlite). NE JAMAIS appliquer sur Supabase.
create schema auth;
create table auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Comme Supabase : tout nouvel objet de public est ouvert à anon et authenticated ; les migrations doivent restreindre.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create publication supabase_realtime;
```

`db/harness.mjs` :
```js
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const STUB = new URL("./auth_stub.sql", import.meta.url);

/** Base neuve : imitation de Supabase puis toutes les migrations dans l'ordre. */
export async function freshDb() {
  const db = await PGlite.create();
  await db.exec(readFileSync(STUB, "utf8"));
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try { await db.exec(readFileSync(new URL(f, MIGRATIONS), "utf8")); }
    catch (e) { throw new Error(`${f} : ${e.message}`); }
  }
  return db;
}

/** Chaque scénario tourne dans une transaction annulée : aucune trace d'un test à l'autre. */
export async function scenario(db, fn) {
  await db.exec("begin");
  try { await fn(); } finally { await db.exec("rollback"); }
}

/** Exécute une requête en tant que `uid` (rôle authenticated), ou en anonyme si uid est null. */
export async function as(db, uid, sql, params = []) {
  await db.exec("savepoint as_user");
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)",
      [uid ? JSON.stringify({ sub: uid, role: "authenticated" }) : ""]);
    await db.exec(`set local role ${uid ? "authenticated" : "anon"}`);
    const res = await db.query(sql, params);
    await db.exec("reset role");
    await db.exec("release savepoint as_user");
    return res.rows;
  } catch (e) {
    await db.exec("rollback to savepoint as_user");
    await db.exec("release savepoint as_user");
    throw e;
  }
}

/** Appelle une fonction scalaire en tant que `uid` et renvoie son résultat. */
export async function rpc(db, uid, fn, args = []) {
  const ph = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await as(db, uid, `select ${fn}(${ph}) as r`, args);
  return rows[0].r;
}

/**
 * SQL en superutilisateur dans un point de sauvegarde : un échec attendu (contrainte violée)
 * n'invalide pas la transaction du scénario, les instructions suivantes restent possibles.
 */
export async function su(db, sql) {
  await db.exec("savepoint su");
  try {
    await db.exec(sql);
    await db.exec("release savepoint su");
  } catch (e) {
    await db.exec("rollback to savepoint su");
    await db.exec("release savepoint su");
    throw e;
  }
}

/** Tableau JS -> littéral de tableau PostgreSQL ('{a,b}'). */
export const pgArray = (xs) => `{${xs.join(",")}}`;
```

`db/fixtures.mjs` :
```js
/** Identifiants lisibles : u(1) = 00000000-0000-4000-8000-000000000001 */
export const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const P = { admin: u(1), tres: u(2), alice: u(3), bob: u(4), xavier: u(5) };
export const G = { tontine: u(101), autre: u(102) };
export const M = { tres: u(201), alice: u(202), bob: u(203), invite: u(204), xavier: u(205) };

/**
 * Tontine de 4 membres comptés (Tina trésorière, Alice, Bob, Ines invitée sans compte), 5 000 FCFA, 1 bénéficiaire.
 * Cotisation séparée gérée par Xavier (autre groupe). Admin plateforme = P.admin.
 */
export async function seedPilot(db) {
  await db.exec(`
    insert into auth.users(id, email) values
      ('${P.admin}','237690000001@njangi237.local'), ('${P.tres}','237690000002@njangi237.local'),
      ('${P.alice}','237690000003@njangi237.local'), ('${P.bob}','237690000004@njangi237.local'),
      ('${P.xavier}','237690000005@njangi237.local');
    insert into people(id, phone, full_name) values
      ('${P.admin}','237690000001','Admin'), ('${P.tres}','237690000002','Tina'),
      ('${P.alice}','237690000003','Alice'), ('${P.bob}','237690000004','Bob'),
      ('${P.xavier}','237690000005','Xavier');
    insert into platform_admins(person_id) values ('${P.admin}');
    insert into groups(id, name, type, amount, frequency, beneficiaries_per_cycle, created_by) values
      ('${G.tontine}','Tontine des amis','tontine',5000,'mensuelle',1,'${P.admin}'),
      ('${G.autre}','Cotisation quartier','cotisation',2000,'mensuelle',1,'${P.admin}');
    insert into memberships(id, group_id, person_id, display_name, phone, role, status, position, joined_at) values
      ('${M.tres}',  '${G.tontine}','${P.tres}',  'Tina',  '237690000002','tresorier','actif', 1, now()),
      ('${M.alice}', '${G.tontine}','${P.alice}', 'Alice', '237690000003','membre',   'actif', 2, now()),
      ('${M.bob}',   '${G.tontine}','${P.bob}',   'Bob',   '237690000004','membre',   'actif', 3, now()),
      ('${M.invite}','${G.tontine}',null,         'Ines',  '237690000009','membre',   'invite',4, null),
      ('${M.xavier}','${G.autre}',  '${P.xavier}','Xavier','237690000005','tresorier','actif', 1, now());
  `);
}
```

- [ ] **Step 2: Installer PGlite**

Run: `cd D:\njangi237\db && npm install`
Expected: `added 1 package`, `node_modules/@electric-sql/pglite` présent.

- [ ] **Step 3: Écrire le test du schéma (échoue)**

`db/tests/schema.test.mjs` :
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, su } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });

const C1 = u(401);
const cycle = (id = C1, status = "ouvert") => su(db,
  `insert into cycles(id, group_id, round, number, label, amount_expected, status)
   values ('${id}','${G.tontine}',1,${id === C1 ? 1 : 2},'Octobre',5000,'${status}')`);

test("les migrations créent toutes les tables", async () => {
  const { rows } = await db.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1");
  assert.deepEqual(rows.map((r) => r.table_name), ["cycles", "debts", "groups", "invitations", "journal",
    "login_attempts", "memberships", "payments", "payouts", "people", "platform_admins"]);
});

test("un numéro mal formé est refusé", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(su(db,
    `insert into memberships(group_id, display_name, phone) values ('${G.tontine}','Zoé','0690000001')`), /check constraint/);
}));

test("un seul cycle ouvert par groupe", () => scenario(db, async () => {
  await seedPilot(db);
  await cycle();
  await assert.rejects(cycle(u(402)), /unique constraint/);
  await cycle(u(403), "clos").catch(() => assert.fail("un cycle clos ne doit pas bloquer"));
}));

test("référence obligatoire pour MoMo et Orange Money", () => scenario(db, async () => {
  await seedPilot(db); await cycle();
  await assert.rejects(su(db, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, declared_by)
    values ('${u(301)}','${G.tontine}','${C1}','${M.alice}',5000,'mtn_momo','${P.alice}')`), /check constraint/);
  await su(db, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, declared_by)
    values ('${u(302)}','${G.tontine}','${C1}','${M.alice}',5000,'especes','${P.alice}')`);
}));

test("un seul paiement non contesté par membre et par cycle", () => scenario(db, async () => {
  await seedPilot(db); await cycle();
  const pay = (id, status) => su(db, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, reference, status, declared_by)
    values ('${id}','${G.tontine}','${C1}','${M.alice}',5000,'mtn_momo','MP${id.slice(-3)}','${status}','${P.alice}')`);
  await pay(u(311), "conteste");
  await pay(u(312), "declare");
  await assert.rejects(pay(u(313), "valide"), /unique constraint/);
}));
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il échoue**

Run: `cd D:\njangi237\db && npm test`
Expected: FAIL — `freshDb` lève `ENOENT` (dossier `supabase/migrations` absent) ou tables manquantes.

- [ ] **Step 5: Écrire `supabase/migrations/0001_schema.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : schéma (montants en FCFA entiers, numéros au format 237XXXXXXXXX)
-- =====================================================================

create type group_type      as enum ('tontine','cotisation','association','autre');
create type group_frequency as enum ('hebdomadaire','mensuelle','ponctuelle');
create type member_role     as enum ('tresorier','membre');
create type member_status   as enum ('invite','actif','retire');
create type cycle_status    as enum ('ouvert','clos');
create type pay_method      as enum ('mtn_momo','orange_money','especes','autre');
create type pay_status      as enum ('declare','valide','conteste');
create type payout_status   as enum ('prevu','remis');
create type invitation_kind as enum ('invitation','reinitialisation');

create table people (
  id         uuid primary key references auth.users(id) on delete cascade,
  phone      text not null unique check (phone ~ '^237[0-9]{9}$'),
  full_name  text not null check (length(btrim(full_name)) > 0),
  created_at timestamptz not null default now()
);

create table platform_admins (
  person_id uuid primary key references people(id) on delete cascade
);

create table groups (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (length(btrim(name)) > 0),
  type                    group_type not null default 'tontine',
  amount                  int not null check (amount > 0),
  frequency               group_frequency not null default 'mensuelle',
  beneficiaries_per_cycle int not null default 1 check (beneficiaries_per_cycle >= 1),
  plan                    text not null default 'pilote',
  max_members             int not null default 50 check (max_members > 0),
  order_locked            boolean not null default false,
  current_round           int not null default 1 check (current_round >= 1),
  created_by              uuid references people(id),
  created_at              timestamptz not null default now()
);

create table memberships (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  person_id    uuid references people(id),
  display_name text not null check (length(btrim(display_name)) > 0),
  phone        text not null check (phone ~ '^237[0-9]{9}$'),
  role         member_role not null default 'membre',
  status       member_status not null default 'invite',
  position     int,
  joined_at    timestamptz,
  left_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (group_id, phone),
  unique (group_id, person_id)
);
create index memberships_person_idx on memberships(person_id) where status = 'actif';

create table cycles (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  round           int not null,
  number          int not null,
  label           text not null check (length(btrim(label)) > 0),
  due_date        date,
  amount_expected int not null check (amount_expected > 0),
  status          cycle_status not null default 'ouvert',
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  unique (group_id, round, number)
);
create unique index cycles_un_ouvert on cycles(group_id) where status = 'ouvert';

create table debts (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  membership_id uuid not null references memberships(id) on delete cascade,
  cycle_id      uuid not null references cycles(id) on delete cascade,
  amount        int not null check (amount > 0),
  settled_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (membership_id, cycle_id)
);

create table payments (
  id             uuid primary key,                       -- généré sur le téléphone (idempotence)
  group_id       uuid not null references groups(id) on delete cascade,
  cycle_id       uuid not null references cycles(id) on delete cascade,
  membership_id  uuid not null references memberships(id) on delete cascade,
  debt_id        uuid references debts(id) on delete set null,
  amount         int not null check (amount > 0),
  method         pay_method not null,
  reference      text,
  paid_on        date not null default current_date,
  status         pay_status not null default 'declare',
  declared_by    uuid not null references people(id),
  validated_by   uuid references people(id),
  validated_at   timestamptz,
  contest_reason text,
  created_at     timestamptz not null default now(),
  check (method not in ('mtn_momo','orange_money') or length(btrim(coalesce(reference, ''))) > 0)
);
create unique index payments_un_par_cycle on payments(cycle_id, membership_id)
  where debt_id is null and status <> 'conteste';
create unique index payments_un_par_dette on payments(debt_id)
  where debt_id is not null and status <> 'conteste';
create index payments_group_idx on payments(group_id, cycle_id);

create table payouts (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  cycle_id        uuid not null references cycles(id) on delete cascade,
  round           int not null,
  membership_id   uuid not null references memberships(id) on delete cascade,
  amount_expected int not null,
  amount          int check (amount > 0),
  method          pay_method,
  reference       text,
  paid_on         date,
  status          payout_status not null default 'prevu',
  recorded_by     uuid references people(id),
  created_at      timestamptz not null default now(),
  constraint payouts_cycle_membre unique (cycle_id, membership_id) deferrable initially immediate,
  constraint payouts_tour_membre unique (group_id, round, membership_id) deferrable initially immediate,
  check (status = 'prevu' or (amount is not null and method is not null and paid_on is not null))
);

create table invitations (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  kind          invitation_kind not null,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_by    uuid references people(id),
  created_at    timestamptz not null default now()
);

create table login_attempts (
  phone        text primary key,
  failures     int not null default 0,
  locked_until timestamptz
);

create table journal (
  id                 bigint generated always as identity primary key,
  group_id           uuid not null references groups(id) on delete cascade,
  actor              uuid references people(id),
  action             text not null,
  details            jsonb not null default '{}',
  visible_to_members boolean not null default false,
  created_at         timestamptz not null default now()
);
create index journal_group_idx on journal(group_id, created_at desc);
```

- [ ] **Step 6: Lancer les tests**

Run: `cd D:\njangi237\db && npm test`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
cd D:\njangi237 && git add db supabase/migrations/0001_schema.sql && git commit -m "Lot 1 : banc de test PGlite et schéma

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Droits d'accès et lectures agrégées

**Files:**
- Create: `supabase/migrations/0002_acces.sql`, `db/tests/acces.test.mjs`

**Interfaces:**
- Consumes: tables de la Task 1, `seedPilot`, `as`, `rpc`.
- Produces: `is_member(uuid) → boolean`, `is_treasurer(uuid) → boolean`, `is_platform_admin() → boolean` ; `ordre_tours(p_group uuid) → table(membership_id uuid, display_name text, role member_role, status member_status, "position" int, is_me boolean, servi boolean, prevu boolean)` ; `recouvrement(p_group uuid) → table(cycle_id uuid, round int, number int, label text, status cycle_status, membres int, attendu int, payes int, collecte int)`.

- [ ] **Step 1: Écrire le test (échoue)**

`db/tests/acces.test.mjs` :
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, as } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });

const C1 = u(401);
async function seed() {
  await seedPilot(db);
  await db.exec(`
    insert into cycles(id, group_id, round, number, label, amount_expected) values ('${C1}','${G.tontine}',1,1,'Octobre',5000);
    insert into payments(id, group_id, cycle_id, membership_id, amount, method, reference, status, declared_by) values
      ('${u(301)}','${G.tontine}','${C1}','${M.alice}',5000,'mtn_momo','MP1','valide','${P.alice}'),
      ('${u(302)}','${G.tontine}','${C1}','${M.bob}',5000,'orange_money','OM1','declare','${P.bob}');
    insert into payouts(group_id, cycle_id, round, membership_id, amount_expected) values ('${G.tontine}','${C1}',1,'${M.tres}',20000);
    insert into journal(group_id, action, visible_to_members) values
      ('${G.tontine}','tirage_au_sort',true), ('${G.tontine}','paiement_conteste',false);`);
}
const ids = (rows) => rows.map((r) => r.id).sort();

test("un visiteur non connecté ne lit rien", () => scenario(db, async () => {
  await seed();
  await assert.rejects(as(db, null, "select * from groups"), /permission denied/);
  await assert.rejects(as(db, null, "select * from payments"), /permission denied/);
}));

test("un membre voit son groupe, son adhésion et ses seuls paiements", () => scenario(db, async () => {
  await seed();
  assert.deepEqual((await as(db, P.alice, "select name from groups")).map((r) => r.name), ["Tontine des amis"]);
  assert.deepEqual(ids(await as(db, P.alice, "select id from memberships")), [M.alice]);
  assert.deepEqual(ids(await as(db, P.alice, "select id from payments")), [u(301)]);
  assert.equal((await as(db, P.alice, "select * from cycles")).length, 1);
  assert.equal((await as(db, P.alice, "select * from payouts")).length, 1);
}));

test("le trésorier voit tous les paiements et toutes les adhésions avec les numéros", () => scenario(db, async () => {
  await seed();
  assert.deepEqual(ids(await as(db, P.tres, "select id from payments")), [u(301), u(302)]);
  const ms = await as(db, P.tres, "select phone from memberships");
  assert.equal(ms.length, 4);
  assert.ok(ms.every((m) => /^237\d{9}$/.test(m.phone)));
}));

test("un membre d'un autre groupe ne voit rien de la tontine", () => scenario(db, async () => {
  await seed();
  assert.deepEqual((await as(db, P.xavier, "select name from groups")).map((r) => r.name), ["Cotisation quartier"]);
  for (const t of ["cycles", "payments", "payouts", "debts", "journal"])
    assert.equal((await as(db, P.xavier, `select * from ${t}`)).length, 0, t);
  assert.equal((await as(db, P.xavier, "select * from ordre_tours($1)", [G.tontine])).length, 0);
  assert.equal((await as(db, P.xavier, "select * from recouvrement($1)", [G.tontine])).length, 0);
}));

test("le journal : tout pour le trésorier, seulement le visible pour un membre", () => scenario(db, async () => {
  await seed();
  assert.equal((await as(db, P.tres, "select * from journal")).length, 2);
  assert.deepEqual((await as(db, P.alice, "select action from journal")).map((r) => r.action), ["tirage_au_sort"]);
}));

test("aucune écriture directe, aucune lecture des invitations", () => scenario(db, async () => {
  await seed();
  await assert.rejects(as(db, P.tres, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, declared_by)
    values ('${u(399)}','${G.tontine}','${C1}','${M.tres}',5000,'especes','${P.tres}')`), /permission denied/);
  await assert.rejects(as(db, P.tres, "update groups set amount = 1"), /permission denied/);
  await assert.rejects(as(db, P.tres, "select * from invitations"), /permission denied/);
  await assert.rejects(as(db, P.tres, "select * from login_attempts"), /permission denied/);
}));

test("ordre des tours : sans numéro, avec is_me et le bénéficiaire prévu", () => scenario(db, async () => {
  await seed();
  const rows = await as(db, P.alice, "select * from ordre_tours($1)", [G.tontine]);
  assert.deepEqual(rows.map((r) => r.display_name), ["Tina", "Alice", "Bob", "Ines"]);
  assert.ok(!("phone" in rows[0]));
  assert.deepEqual(rows.map((r) => r.is_me), [false, true, false, false]);
  assert.deepEqual(rows.map((r) => r.prevu), [true, false, false, false]);
}));

test("recouvrement : seuls les paiements validés comptent", () => scenario(db, async () => {
  await seed();
  const [r] = await as(db, P.alice, "select * from recouvrement($1)", [G.tontine]);
  assert.equal(r.membres, 4);
  assert.equal(r.attendu, 20000);
  assert.equal(r.payes, 1);
  assert.equal(r.collecte, 5000);
}));
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\db && npm test`
Expected: FAIL — par ex. « un visiteur non connecté ne lit rien » : la promesse ne rejette pas (le stub accorde tout à anon) ; `ordre_tours` n'existe pas.

- [ ] **Step 3: Écrire `supabase/migrations/0002_acces.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : droits d'accès
--   - anon : rien. authenticated : lecture filtrée par RLS, écritures via fonctions serveur.
--   - Les numéros des autres membres ne sortent que pour les trésoriers.
-- =====================================================================

-- Aucune fonction exécutable par défaut : chaque migration accorde explicitement ce qui doit l'être.
-- (Le droit EXECUTE accordé à PUBLIC est global : il se retire sans « in schema ».)
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

create or replace function is_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships
                  where group_id = p_group and person_id = auth.uid() and status = 'actif')
$$;

create or replace function is_treasurer(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships
                  where group_id = p_group and person_id = auth.uid() and status = 'actif' and role = 'tresorier')
$$;

create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where person_id = auth.uid())
$$;

alter table people          enable row level security;
alter table platform_admins enable row level security;
alter table groups          enable row level security;
alter table memberships     enable row level security;
alter table cycles          enable row level security;
alter table debts           enable row level security;
alter table payments        enable row level security;
alter table payouts         enable row level security;
alter table invitations     enable row level security;
alter table login_attempts  enable row level security;
alter table journal         enable row level security;

create policy people_self   on people          for select using (id = auth.uid());
create policy admins_self   on platform_admins for select using (person_id = auth.uid());
create policy groups_read   on groups          for select using (is_member(id));
create policy members_read  on memberships     for select using (person_id = auth.uid() or is_treasurer(group_id));
create policy cycles_read   on cycles          for select using (is_member(group_id));
create policy payments_read on payments        for select using (
  is_treasurer(group_id)
  or exists (select 1 from memberships m where m.id = membership_id and m.person_id = auth.uid()));
create policy debts_read    on debts           for select using (
  is_treasurer(group_id)
  or exists (select 1 from memberships m where m.id = membership_id and m.person_id = auth.uid()));
create policy payouts_read  on payouts         for select using (is_member(group_id));
create policy journal_read  on journal         for select using (
  is_treasurer(group_id) or (visible_to_members and is_member(group_id)));
-- invitations, login_attempts : aucune politique, réservées aux fonctions serveur.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on people, platform_admins, groups, memberships, cycles, debts, payments, payouts, journal to authenticated;

-- Ordre des tours pour tous les membres actifs du groupe, sans les numéros
create or replace function ordre_tours(p_group uuid)
returns table (membership_id uuid, display_name text, role member_role, status member_status,
               "position" int, is_me boolean, servi boolean, prevu boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.display_name, m.role, m.status, m.position,
         coalesce(m.person_id = auth.uid(), false),
         exists (select 1 from payouts p where p.membership_id = m.id and p.round = g.current_round and p.status = 'remis'),
         exists (select 1 from payouts p where p.membership_id = m.id and p.round = g.current_round and p.status = 'prevu')
    from memberships m join groups g on g.id = m.group_id
   where m.group_id = p_group and m.status <> 'retire' and is_member(p_group)
   order by m.position nulls last, m.display_name
$$;

-- Taux de recouvrement par cycle, sans aucun paiement individuel
create or replace function recouvrement(p_group uuid)
returns table (cycle_id uuid, round int, number int, label text, status cycle_status,
               membres int, attendu int, payes int, collecte int)
language sql stable security definer set search_path = public as $$
  select c.id, c.round, c.number, c.label, c.status,
         n.membres, c.amount_expected * n.membres, coalesce(x.payes, 0), coalesce(x.collecte, 0)
    from cycles c
    cross join lateral (
      select count(*)::int as membres from memberships m
       where m.group_id = c.group_id and m.status <> 'retire' and m.created_at <= c.opened_at) n
    left join lateral (
      select count(distinct p.membership_id)::int as payes, sum(p.amount)::int as collecte from payments p
       where p.cycle_id = c.id and p.debt_id is null and p.status = 'valide') x on true
   where c.group_id = p_group and is_member(p_group)
   order by c.round, c.number
$$;

revoke execute on function is_member(uuid), is_treasurer(uuid), is_platform_admin(),
                           ordre_tours(uuid), recouvrement(uuid) from public, anon;
grant  execute on function is_member(uuid), is_treasurer(uuid), is_platform_admin(),
                           ordre_tours(uuid), recouvrement(uuid) to authenticated;

-- Temps réel (lot 4) : tables suivies par l'application
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table payments, cycles, payouts, memberships;
  end if;
end $$;
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\db && npm test`
Expected: PASS (5 + 8 tests).

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add db/tests/acces.test.mjs supabase/migrations/0002_acces.sql && git commit -m "Lot 1 : droits d'accès, ordre des tours et recouvrement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Groupes et membres

**Files:**
- Create: `supabase/migrations/0003_groupes_membres.sql`, `db/tests/groupes.test.mjs`

**Interfaces:**
- Consumes: `is_treasurer`, `is_platform_admin` (Task 2).
- Produces (internes, non exécutables par les clients) : `normaliser_telephone(text) → text`, `journaliser(uuid, text, jsonb, boolean) → void`, `exiger_tresorier(uuid) → void`, `garder_un_tresorier(uuid, uuid) → void`.
- Produces (clients) : `creer_groupe(p_name text, p_type group_type, p_amount int, p_frequency group_frequency, p_beneficiaries int, p_treasurer_name text, p_treasurer_phone text) → jsonb {group_id, membership_id}` ; `ajouter_membre(p_group uuid, p_name text, p_phone text, p_role member_role default 'membre') → uuid` ; `changer_role(p_membership uuid, p_role member_role) → void` ; `apercu_retrait(p_membership uuid) → jsonb {deja_servi, cycles_restants, montant_restant}` ; `retirer_membre(p_membership uuid) → jsonb` (même forme que l'aperçu).

- [ ] **Step 1: Écrire le test (échoue)**

`db/tests/groupes.test.mjs` :
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, as, rpc } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;

test("normalisation des numéros saisis à la camerounaise", () => scenario(db, async () => {
  for (const s of ["6 90 00 00 07", "+237 690 00 00 07", "00237690000007", "237-690-000-007"])
    assert.equal((await q(`select normaliser_telephone('${s}') n`))[0].n, "237690000007", s);
  await assert.rejects(db.query("select normaliser_telephone('12345')"), /Numéro de téléphone invalide/);
}));

test("l'administrateur crée un groupe et son trésorier invité", () => scenario(db, async () => {
  await seedPilot(db);
  const r = await rpc(db, P.admin, "creer_groupe",
    ["Njangi du lundi", "tontine", 10000, "hebdomadaire", 2, "Paul", "699 11 22 33"]);
  const [m] = await q(`select role, status, position, phone from memberships where id = '${r.membership_id}'`);
  assert.deepEqual(m, { role: "tresorier", status: "invite", position: 1, phone: "237699112233" });
  assert.equal((await q(`select count(*)::int n from journal where group_id = '${r.group_id}' and action = 'groupe_cree'`))[0].n, 1);
}));

test("seul un administrateur de la plateforme crée un groupe", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.tres, "creer_groupe", ["X", "tontine", 1000, "mensuelle", 1, "Y", "690000077"]),
    /Réservé aux administrateurs/);
  await assert.rejects(rpc(db, P.admin, "creer_groupe", ["X", "tontine", 0, "mensuelle", 1, "Y", "690000077"]),
    /Montant invalide/);
}));

test("le trésorier ajoute un membre ; doublon et non-trésorier refusés", () => scenario(db, async () => {
  await seedPilot(db);
  const id = await rpc(db, P.tres, "ajouter_membre", [G.tontine, "Jean", "677 00 00 01"]);
  const [m] = await q(`select status, position, role from memberships where id = '${id}'`);
  assert.deepEqual(m, { status: "invite", position: 5, role: "membre" });
  await assert.rejects(rpc(db, P.tres, "ajouter_membre", [G.tontine, "Jean bis", "+237677000001"]), /déjà dans le groupe/);
  await assert.rejects(rpc(db, P.alice, "ajouter_membre", [G.tontine, "Luc", "677000002"]), /Réservé aux trésoriers/);
}));

test("un membre retiré peut être réintégré avec la même adhésion", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  const id = await rpc(db, P.tres, "ajouter_membre", [G.tontine, "Bob", "690000004"]);
  assert.equal(id, M.bob);
  assert.equal((await q(`select status from memberships where id = '${M.bob}'`))[0].status, "invite");
}));

test("nombre maximum de membres", () => scenario(db, async () => {
  await seedPilot(db);
  await db.exec(`update groups set max_members = 4 where id = '${G.tontine}'`);
  await assert.rejects(rpc(db, P.tres, "ajouter_membre", [G.tontine, "Jean", "677000001"]), /maximum de membres/);
}));

test("le dernier trésorier ne peut ni se rétrograder ni se retirer", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.tres, "changer_role", [M.tres, "membre"]), /au moins un trésorier actif/);
  await assert.rejects(rpc(db, P.tres, "retirer_membre", [M.tres]), /au moins un trésorier actif/);
  await rpc(db, P.tres, "changer_role", [M.alice, "tresorier"]);
  await rpc(db, P.tres, "changer_role", [M.tres, "membre"]);
  assert.equal((await q(`select role from memberships where id = '${M.tres}'`))[0].role, "membre");
}));

test("retrait d'un membre : statut, position libérée, journal visible", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  const [m] = await q(`select status, position, left_at is not null as parti from memberships where id = '${M.bob}'`);
  assert.deepEqual(m, { status: "retire", position: null, parti: true });
  assert.equal((await as(db, P.alice, "select action from journal where action = 'membre_retire'")).length, 1);
  await assert.rejects(rpc(db, P.tres, "retirer_membre", [M.bob]), /déjà retiré/);
}));

test("aperçu du retrait d'un membre déjà servi, et bénéficiaire en cours protégé", () => scenario(db, async () => {
  await seedPilot(db);
  const C1 = u(401), C2 = u(402);
  await db.exec(`
    insert into cycles(id, group_id, round, number, label, amount_expected, status) values
      ('${C1}','${G.tontine}',1,1,'Sept',5000,'clos'), ('${C2}','${G.tontine}',1,2,'Oct',5000,'ouvert');
    insert into payouts(group_id, cycle_id, round, membership_id, amount_expected, amount, method, paid_on, status) values
      ('${G.tontine}','${C1}',1,'${M.alice}',20000,20000,'especes',current_date,'remis');
    insert into payouts(group_id, cycle_id, round, membership_id, amount_expected) values ('${G.tontine}','${C2}',1,'${M.bob}',20000);`);
  // Alice a « bouffé » ; restent Tina et Ines (2 cycles) + le cycle ouvert qu'elle n'a pas payé = 3
  assert.deepEqual(await rpc(db, P.tres, "apercu_retrait", [M.alice]),
    { deja_servi: true, cycles_restants: 3, montant_restant: 15000 });
  await assert.rejects(rpc(db, P.tres, "retirer_membre", [M.bob]), /bénéficiaire du cycle en cours/);
}));
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\db && npm test`
Expected: FAIL — `function normaliser_telephone(unknown) does not exist`.

- [ ] **Step 3: Écrire `supabase/migrations/0003_groupes_membres.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : groupes et membres
-- =====================================================================

-- Numéro camerounais : chiffres seuls, préfixe 00 retiré, 237 ajouté devant 9 chiffres
create or replace function normaliser_telephone(p text) returns text
language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '00%' then d := substr(d, 3); end if;
  if length(d) = 9 then d := '237' || d; end if;
  if d !~ '^237[0-9]{9}$' then
    raise exception 'Numéro de téléphone invalide' using errcode = '22023';
  end if;
  return d;
end $$;

create or replace function journaliser(p_group uuid, p_action text, p_details jsonb default '{}', p_visible boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into journal(group_id, actor, action, details, visible_to_members)
  values (p_group, auth.uid(), p_action, coalesce(p_details, '{}'), p_visible)
$$;

create or replace function exiger_tresorier(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_treasurer(p_group) then
    raise exception 'Réservé aux trésoriers du groupe' using errcode = '42501';
  end if;
end $$;

create or replace function garder_un_tresorier(p_group uuid, p_sauf uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from memberships
                  where group_id = p_group and role = 'tresorier' and status = 'actif' and id <> p_sauf) then
    raise exception 'Le groupe doit garder au moins un trésorier actif' using errcode = 'P0001';
  end if;
end $$;

create or replace function creer_groupe(p_name text, p_type group_type, p_amount int, p_frequency group_frequency,
                                        p_beneficiaries int, p_treasurer_name text, p_treasurer_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_group uuid; v_m uuid;
begin
  if not is_platform_admin() then
    raise exception 'Réservé aux administrateurs de la plateforme' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Nom du groupe obligatoire' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_treasurer_name, ''))) = 0 then raise exception 'Nom du trésorier obligatoire' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide' using errcode = '22023'; end if;
  if p_beneficiaries is null or p_beneficiaries < 1 then
    raise exception 'Nombre de bénéficiaires par cycle invalide' using errcode = '22023';
  end if;

  insert into groups(name, type, amount, frequency, beneficiaries_per_cycle, created_by)
  values (btrim(p_name), p_type, p_amount, p_frequency, p_beneficiaries, auth.uid())
  returning id into v_group;

  insert into memberships(group_id, display_name, phone, role, status, position)
  values (v_group, btrim(p_treasurer_name), normaliser_telephone(p_treasurer_phone), 'tresorier', 'invite', 1)
  returning id into v_m;

  perform journaliser(v_group, 'groupe_cree', jsonb_build_object('nom', btrim(p_name)), true);
  return jsonb_build_object('group_id', v_group, 'membership_id', v_m);
end $$;

create or replace function ajouter_membre(p_group uuid, p_name text, p_phone text, p_role member_role default 'membre')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := normaliser_telephone(p_phone);
  v_g     groups%rowtype;
  v_old   memberships%rowtype;
  v_count int;
  v_pos   int;
  v_id    uuid;
begin
  perform exiger_tresorier(p_group);
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Nom obligatoire' using errcode = '22023'; end if;

  select * into v_g from groups where id = p_group for update;
  select count(*) into v_count from memberships where group_id = p_group and status <> 'retire';
  if v_count >= v_g.max_members then
    raise exception 'Nombre maximum de membres atteint (%)', v_g.max_members using errcode = 'P0001';
  end if;
  select coalesce(max(position), 0) + 1 into v_pos from memberships where group_id = p_group and status <> 'retire';

  select * into v_old from memberships where group_id = p_group and phone = v_phone;
  if found then
    if v_old.status <> 'retire' then
      raise exception 'Ce numéro est déjà dans le groupe' using errcode = '23505';
    end if;
    update memberships
       set display_name = btrim(p_name), role = p_role, status = 'invite', position = v_pos,
           left_at = null, joined_at = null
     where id = v_old.id;
    v_id := v_old.id;
  else
    insert into memberships(group_id, display_name, phone, role, status, position)
    values (p_group, btrim(p_name), v_phone, p_role, 'invite', v_pos)
    returning id into v_id;
  end if;

  perform journaliser(p_group, 'membre_ajoute', jsonb_build_object('nom', btrim(p_name)), false);
  return v_id;
end $$;

create or replace function changer_role(p_membership uuid, p_role member_role) returns void
language plpgsql security definer set search_path = public as $$
declare v_m memberships%rowtype;
begin
  select * into v_m from memberships where id = p_membership for update;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_m.group_id);
  if v_m.status = 'retire' then raise exception 'Ce membre est retiré' using errcode = 'P0001'; end if;
  if v_m.role = 'tresorier' and p_role = 'membre' then
    perform garder_un_tresorier(v_m.group_id, v_m.id);
  end if;
  update memberships set role = p_role where id = p_membership;
  perform journaliser(v_m.group_id, 'role_change',
    jsonb_build_object('nom', v_m.display_name, 'role', p_role), false);
end $$;

-- Ce que le membre doit encore s'il quitte le groupe maintenant
create or replace function apercu_retrait(p_membership uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_m        memberships%rowtype;
  v_g        groups%rowtype;
  v_open     uuid;
  v_servi    boolean;
  v_attente  int;
  v_restants int := 0;
begin
  select * into v_m from memberships where id = p_membership;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_m.group_id);
  select * into v_g from groups where id = v_m.group_id;
  select id into v_open from cycles where group_id = v_g.id and status = 'ouvert';

  v_servi := exists (select 1 from payouts
                      where membership_id = v_m.id and round = v_g.current_round and status = 'remis');
  if v_g.type = 'tontine' and v_servi then
    -- Cycles encore à venir dans ce tour : membres sans aucune remise (prévue ou faite), k par cycle
    select count(*) into v_attente from memberships m
     where m.group_id = v_g.id and m.status <> 'retire' and m.id <> v_m.id
       and not exists (select 1 from payouts p where p.membership_id = m.id and p.round = v_g.current_round);
    v_restants := ceil(v_attente::numeric / v_g.beneficiaries_per_cycle)::int;
  end if;
  if v_open is not null and not exists (
       select 1 from payments where cycle_id = v_open and membership_id = v_m.id
                                and debt_id is null and status = 'valide') then
    v_restants := v_restants + 1;
  end if;

  return jsonb_build_object('deja_servi', v_servi, 'cycles_restants', v_restants,
                            'montant_restant', v_restants * v_g.amount);
end $$;

create or replace function retirer_membre(p_membership uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m memberships%rowtype; v_apercu jsonb;
begin
  select * into v_m from memberships where id = p_membership for update;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_m.group_id);
  if v_m.status = 'retire' then raise exception 'Ce membre est déjà retiré' using errcode = 'P0001'; end if;
  if v_m.role = 'tresorier' then perform garder_un_tresorier(v_m.group_id, v_m.id); end if;
  if exists (select 1 from payouts p join cycles c on c.id = p.cycle_id
              where p.membership_id = v_m.id and p.status = 'prevu' and c.status = 'ouvert') then
    raise exception 'Ce membre est bénéficiaire du cycle en cours : remplacez-le d''abord' using errcode = 'P0001';
  end if;

  v_apercu := apercu_retrait(p_membership);
  update memberships set status = 'retire', left_at = now(), position = null where id = p_membership;
  perform journaliser(v_m.group_id, 'membre_retire', jsonb_build_object('nom', v_m.display_name), true);
  return v_apercu;
end $$;

revoke execute on function normaliser_telephone(text), journaliser(uuid, text, jsonb, boolean),
                           exiger_tresorier(uuid), garder_un_tresorier(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function creer_groupe(text, group_type, int, group_frequency, int, text, text),
                           ajouter_membre(uuid, text, text, member_role), changer_role(uuid, member_role),
                           apercu_retrait(uuid), retirer_membre(uuid)
  from public, anon;
grant execute on function creer_groupe(text, group_type, int, group_frequency, int, text, text),
                          ajouter_membre(uuid, text, text, member_role), changer_role(uuid, member_role),
                          apercu_retrait(uuid), retirer_membre(uuid)
  to authenticated;
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\db && npm test`
Expected: PASS (tous les fichiers).

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add db/tests/groupes.test.mjs supabase/migrations/0003_groupes_membres.sql && git commit -m "Lot 1 : groupes et membres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cycles

**Files:**
- Create: `supabase/migrations/0004_cycles.sql`, `db/tests/cycles.test.mjs`

**Interfaces:**
- Consumes: `exiger_tresorier`, `journaliser` (Task 3).
- Produces : `designer_beneficiaires(p_cycle uuid) → int` (interne) ; `ouvrir_cycle(p_group uuid, p_label text, p_due_date date default null) → uuid` ; `clore_cycle(p_cycle uuid) → jsonb {dettes int, montant int}` ; `rouvrir_cycle(p_cycle uuid) → void`.

- [ ] **Step 1: Écrire le test (échoue)**

`db/tests/cycles.test.mjs` :
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const payer = (id, cycle, m, amount, status = "valide") => db.exec(
  `insert into payments(id, group_id, cycle_id, membership_id, amount, method, status, declared_by)
   values ('${id}','${G.tontine}','${cycle}','${m}',${amount},'especes','${status}','${P.tres}')`);

test("ouvrir un cycle de tontine verrouille l'ordre et désigne le premier bénéficiaire", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre 2026", "2026-10-30"]);
  const [cy] = await q(`select round, number, amount_expected, status from cycles where id = '${c}'`);
  assert.deepEqual(cy, { round: 1, number: 1, amount_expected: 5000, status: "ouvert" });
  assert.equal((await q(`select order_locked from groups where id = '${G.tontine}'`))[0].order_locked, true);
  assert.deepEqual(await q(`select membership_id, amount_expected, status from payouts where cycle_id = '${c}'`),
    [{ membership_id: M.tres, amount_expected: 20000, status: "prevu" }]);
}));

test("deux bénéficiaires par cycle", () => scenario(db, async () => {
  await seedPilot(db);
  await db.exec(`update groups set beneficiaries_per_cycle = 2 where id = '${G.tontine}'`);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  assert.deepEqual((await q(`select membership_id, amount_expected from payouts where cycle_id = '${c}' order by membership_id`)),
    [{ membership_id: M.tres, amount_expected: 10000 }, { membership_id: M.alice, amount_expected: 10000 }]);
}));

test("un seul cycle ouvert, réservé au trésorier", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.alice, "ouvrir_cycle", [G.tontine, "Octobre"]), /Réservé aux trésoriers/);
  await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await assert.rejects(rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Novembre"]), /déjà ouvert/);
}));

test("une cotisation n'a pas de bénéficiaire", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.xavier, "ouvrir_cycle", [G.autre, "Octobre"]);
  assert.equal((await q(`select count(*)::int n from payouts where cycle_id = '${c}'`))[0].n, 0);
}));

test("clore : impayés et paiements partiels deviennent des dettes", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await payer(u(301), c, M.alice, 5000);
  await payer(u(302), c, M.bob, 3000);
  assert.deepEqual(await rpc(db, P.tres, "clore_cycle", [c]), { dettes: 3, montant: 12000 });
  assert.deepEqual(await q(`select membership_id, amount from debts where cycle_id = '${c}' order by membership_id`), [
    { membership_id: M.tres, amount: 5000 }, { membership_id: M.bob, amount: 2000 }, { membership_id: M.invite, amount: 5000 }]);
  assert.equal((await q(`select status from cycles where id = '${c}'`))[0].status, "clos");
}));

test("clore est refusé tant qu'un paiement attend la validation", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await payer(u(301), c, M.alice, 5000, "declare");
  await assert.rejects(rpc(db, P.tres, "clore_cycle", [c]), /1 paiement\(s\) à valider/);
}));

test("rouvrir le dernier cycle efface ses dettes non réglées", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await rpc(db, P.tres, "clore_cycle", [c]);
  await rpc(db, P.tres, "rouvrir_cycle", [c]);
  assert.equal((await q(`select status from cycles where id = '${c}'`))[0].status, "ouvert");
  assert.equal((await q(`select count(*)::int n from debts where cycle_id = '${c}'`))[0].n, 0);
}));

test("rouvrir est refusé si une dette du cycle est réglée ou si ce n'est pas le dernier cycle", () => scenario(db, async () => {
  await seedPilot(db);
  const c1 = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await rpc(db, P.tres, "clore_cycle", [c1]);
  await db.exec(`update debts set settled_at = now() where cycle_id = '${c1}' and membership_id = '${M.bob}'`);
  await assert.rejects(rpc(db, P.tres, "rouvrir_cycle", [c1]), /déjà des règlements/);
  await db.exec(`update debts set settled_at = null where cycle_id = '${c1}'`);
  await db.exec(`update payouts set status = 'remis', amount = 20000, method = 'especes', paid_on = current_date where cycle_id = '${c1}'`);
  const c2 = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Novembre"]);
  await rpc(db, P.tres, "clore_cycle", [c2]);
  await assert.rejects(rpc(db, P.tres, "rouvrir_cycle", [c1]), /Seul le dernier cycle/);
}));
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\db && npm test`
Expected: FAIL — `function ouvrir_cycle(unknown, unknown, unknown) does not exist`.

- [ ] **Step 3: Écrire `supabase/migrations/0004_cycles.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : cycles (ouverture, clôture avec dettes, réouverture tracée)
-- Membre « compté » = adhésion invite ou actif (voir plan, écart n°3).
-- =====================================================================

-- Les k membres suivants dans l'ordre, sans remise dans le tour du cycle, deviennent bénéficiaires prévus
create or replace function designer_beneficiaires(p_cycle uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_c cycles%rowtype; v_g groups%rowtype; v_n int; v_each int; v_count int;
begin
  select * into v_c from cycles where id = p_cycle;
  select * into v_g from groups where id = v_c.group_id;
  if v_g.type <> 'tontine' then return 0; end if;

  select count(*) into v_n from memberships where group_id = v_g.id and status <> 'retire';
  v_each := (v_c.amount_expected * v_n) / v_g.beneficiaries_per_cycle;

  insert into payouts(group_id, cycle_id, round, membership_id, amount_expected)
  select v_g.id, v_c.id, v_c.round, m.id, v_each
    from memberships m
   where m.group_id = v_g.id and m.status <> 'retire'
     and not exists (select 1 from payouts p where p.membership_id = m.id and p.round = v_c.round)
   order by m.position nulls last, m.created_at
   limit v_g.beneficiaries_per_cycle;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function ouvrir_cycle(p_group uuid, p_label text, p_due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype; v_id uuid; v_num int; v_n int;
begin
  perform exiger_tresorier(p_group);
  if length(btrim(coalesce(p_label, ''))) = 0 then raise exception 'Libellé du cycle obligatoire' using errcode = '22023'; end if;
  select * into v_g from groups where id = p_group for update;
  if exists (select 1 from cycles where group_id = p_group and status = 'ouvert') then
    raise exception 'Un cycle est déjà ouvert : clôturez-le d''abord' using errcode = 'P0001';
  end if;
  select count(*) into v_n from memberships where group_id = p_group and status <> 'retire';
  if v_n = 0 then raise exception 'Aucun membre dans le groupe' using errcode = 'P0001'; end if;

  select coalesce(max(number), 0) + 1 into v_num from cycles where group_id = p_group and round = v_g.current_round;
  insert into cycles(group_id, round, number, label, due_date, amount_expected)
  values (p_group, v_g.current_round, v_num, btrim(p_label), p_due_date, v_g.amount)
  returning id into v_id;

  if v_g.type = 'tontine' then
    update groups set order_locked = true where id = p_group;
    if designer_beneficiaires(v_id) = 0 then
      raise exception 'Tour terminé : tous les membres ont reçu leur part. Démarrez un nouveau tour.' using errcode = 'P0001';
    end if;
  end if;

  perform journaliser(p_group, 'cycle_ouvert', jsonb_build_object('cycle', btrim(p_label)), true);
  return v_id;
end $$;

create or replace function clore_cycle(p_cycle uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_c cycles%rowtype; v_pending int; v_n int; v_sum int;
begin
  select * into v_c from cycles where id = p_cycle for update;
  if not found then raise exception 'Cycle introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_c.group_id);
  if v_c.status <> 'ouvert' then raise exception 'Ce cycle est déjà clos' using errcode = 'P0001'; end if;

  select count(*) into v_pending from payments where cycle_id = p_cycle and debt_id is null and status = 'declare';
  if v_pending > 0 then
    raise exception '% paiement(s) à valider ou contester avant de clore', v_pending using errcode = 'P0001';
  end if;

  insert into debts(group_id, membership_id, cycle_id, amount)
  select v_c.group_id, m.id, v_c.id, v_c.amount_expected - coalesce(p.amount, 0)
    from memberships m
    left join payments p on p.cycle_id = v_c.id and p.membership_id = m.id
                        and p.debt_id is null and p.status = 'valide'
   where m.group_id = v_c.group_id and m.status <> 'retire' and m.created_at <= v_c.opened_at
     and coalesce(p.amount, 0) < v_c.amount_expected;
  get diagnostics v_n = row_count;
  select coalesce(sum(amount), 0)::int into v_sum from debts where cycle_id = p_cycle;

  update cycles set status = 'clos', closed_at = now() where id = p_cycle;
  perform journaliser(v_c.group_id, 'cycle_clos', jsonb_build_object('cycle', v_c.label, 'dettes', v_n), true);
  return jsonb_build_object('dettes', v_n, 'montant', v_sum);
end $$;

create or replace function rouvrir_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_c cycles%rowtype;
begin
  select * into v_c from cycles where id = p_cycle for update;
  if not found then raise exception 'Cycle introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_c.group_id);
  if v_c.status <> 'clos' then raise exception 'Ce cycle n''est pas clos' using errcode = 'P0001'; end if;
  if exists (select 1 from cycles where group_id = v_c.group_id and status = 'ouvert') then
    raise exception 'Un autre cycle est ouvert' using errcode = 'P0001';
  end if;
  if exists (select 1 from cycles where group_id = v_c.group_id
               and (round > v_c.round or (round = v_c.round and number > v_c.number))) then
    raise exception 'Seul le dernier cycle peut être rouvert' using errcode = 'P0001';
  end if;
  if exists (select 1 from debts d where d.cycle_id = p_cycle and (d.settled_at is not null or exists (
               select 1 from payments p where p.debt_id = d.id and p.status <> 'conteste'))) then
    raise exception 'Des dettes de ce cycle ont déjà des règlements' using errcode = 'P0001';
  end if;

  delete from debts where cycle_id = p_cycle;
  update cycles set status = 'ouvert', closed_at = null where id = p_cycle;
  perform journaliser(v_c.group_id, 'cycle_rouvert', jsonb_build_object('cycle', v_c.label), false);
end $$;

revoke execute on function designer_beneficiaires(uuid) from public, anon, authenticated;
revoke execute on function ouvrir_cycle(uuid, text, date), clore_cycle(uuid), rouvrir_cycle(uuid) from public, anon;
grant  execute on function ouvrir_cycle(uuid, text, date), clore_cycle(uuid), rouvrir_cycle(uuid) to authenticated;
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\db && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add db/tests/cycles.test.mjs supabase/migrations/0004_cycles.sql && git commit -m "Lot 1 : cycles, bénéficiaires et dettes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Paiements

**Files:**
- Create: `supabase/migrations/0005_paiements.sql`, `db/tests/paiements.test.mjs`

**Interfaces:**
- Consumes: `ouvrir_cycle`, `clore_cycle` (Task 4), `exiger_tresorier`, `journaliser`.
- Produces : `declarer_paiement(p_id uuid, p_cycle uuid, p_amount int, p_method pay_method, p_reference text default null, p_paid_on date default null, p_debt uuid default null) → jsonb {ok, duplicate, status}` ; `saisir_especes(p_id uuid, p_membership uuid, p_cycle uuid, p_amount int, p_paid_on date default null, p_debt uuid default null) → jsonb {ok, duplicate, status}` ; `valider_paiement(p_payment uuid) → void` ; `contester_paiement(p_payment uuid, p_reason text) → void`.

- [ ] **Step 1: Écrire le test (échoue)**

`db/tests/paiements.test.mjs` :
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc, as } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const status = async (id) => (await q(`select status from payments where id = '${id}'`))[0]?.status;
const ouvrir = () => rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
const declarer = (who, id, c, amount = 5000, method = "mtn_momo", ref = "MP1", debt = null) =>
  rpc(db, who, "declarer_paiement", [id, c, amount, method, ref, null, debt]);

test("déclaration par un membre puis validation par le trésorier", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  assert.deepEqual(await declarer(P.alice, u(301), c), { ok: true, duplicate: false, status: "declare" });
  await assert.rejects(rpc(db, P.alice, "valider_paiement", [u(301)]), /Réservé aux trésoriers/);
  await rpc(db, P.tres, "valider_paiement", [u(301)]);
  assert.equal(await status(u(301)), "valide");
  await assert.rejects(rpc(db, P.tres, "valider_paiement", [u(301)]), /pas en attente de validation/);
}));

test("rejouer une déclaration (file hors ligne) ne crée pas de doublon", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await declarer(P.alice, u(301), c);
  assert.deepEqual(await declarer(P.alice, u(301), c), { ok: true, duplicate: true, status: "declare" });
  assert.equal((await q(`select count(*)::int n from payments`))[0].n, 1);
  await assert.rejects(declarer(P.alice, u(302), c), /déjà enregistré pour ce cycle/);
  await assert.rejects(declarer(P.bob, u(301), c), /Identifiant de paiement déjà utilisé/);
}));

test("saisies invalides et personnes non autorisées", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await assert.rejects(declarer(P.alice, u(301), c, 5000, "mtn_momo", " "), /Référence de transaction obligatoire/);
  await assert.rejects(declarer(P.alice, u(301), c, 0), /Montant invalide/);
  await assert.rejects(declarer(P.xavier, u(301), c), /pas membre de ce groupe/);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  await assert.rejects(declarer(P.bob, u(302), c), /pas membre de ce groupe/);
}));

test("un paiement contesté libère la place : le membre redéclare", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await declarer(P.bob, u(301), c, 5000, "orange_money", "OM9");
  await assert.rejects(rpc(db, P.tres, "contester_paiement", [u(301), "  "]), /Motif obligatoire/);
  await rpc(db, P.tres, "contester_paiement", [u(301), "Référence introuvable chez Orange"]);
  assert.equal(await status(u(301)), "conteste");
  assert.equal((await as(db, P.tres, "select count(*)::int n from journal where action = 'paiement_conteste'"))[0].n, 1);
  assert.equal((await declarer(P.bob, u(302), c, 5000, "orange_money", "OM10")).status, "declare");
}));

test("espèces saisies par le trésorier : validées d'office, même pour un invité sans compte", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  assert.deepEqual(await rpc(db, P.tres, "saisir_especes", [u(301), M.invite, c, 5000]),
    { ok: true, duplicate: false, status: "valide" });
  assert.deepEqual(await rpc(db, P.tres, "saisir_especes", [u(301), M.invite, c, 5000]),
    { ok: true, duplicate: true, status: "valide" });
  await assert.rejects(rpc(db, P.alice, "saisir_especes", [u(302), M.alice, c, 5000]), /Réservé aux trésoriers/);
  await assert.rejects(rpc(db, P.xavier, "saisir_especes", [u(303), M.xavier, c, 5000]), /Cycle introuvable/);
}));

test("dette : réglée par une déclaration validée, sans toucher au cycle en cours", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await rpc(db, P.tres, "clore_cycle", [c]);
  const [{ id: dette }] = await q(`select id from debts where membership_id = '${M.bob}' and cycle_id = '${c}'`);
  await assert.rejects(declarer(P.bob, u(301), c), /Ce cycle est clos/);
  await declarer(P.bob, u(302), c, 5000, "mtn_momo", "MP7", dette);
  await rpc(db, P.tres, "valider_paiement", [u(302)]);
  assert.ok((await q(`select settled_at from debts where id = '${dette}'`))[0].settled_at);
  const [r] = await as(db, P.bob, "select * from recouvrement($1)", [G.tontine]);
  assert.equal(r.collecte, 0);
  await assert.rejects(declarer(P.alice, u(303), c, 5000, "mtn_momo", "MP8", dette), /Dette introuvable/);
}));

test("contester un règlement de dette validé rouvre la dette", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await rpc(db, P.tres, "clore_cycle", [c]);
  const [{ id: dette }] = await q(`select id from debts where membership_id = '${M.bob}'`);
  await rpc(db, P.tres, "saisir_especes", [u(301), M.bob, c, 5000, null, dette]);
  assert.ok((await q(`select settled_at from debts where id = '${dette}'`))[0].settled_at);
  await rpc(db, P.tres, "contester_paiement", [u(301), "Billets refusés"]);
  assert.equal((await q(`select settled_at from debts where id = '${dette}'`))[0].settled_at, null);
}));
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\db && npm test`
Expected: FAIL — `function declarer_paiement(...) does not exist`.

- [ ] **Step 3: Écrire `supabase/migrations/0005_paiements.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : paiements (déclaration idempotente, validation, contestation, dettes)
-- =====================================================================

create or replace function declarer_paiement(p_id uuid, p_cycle uuid, p_amount int, p_method pay_method,
                                             p_reference text default null, p_paid_on date default null,
                                             p_debt uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old payments%rowtype; v_c cycles%rowtype; v_m uuid; v_d debts%rowtype;
begin
  -- Idempotence : la file hors ligne peut renvoyer la même déclaration
  select * into v_old from payments where id = p_id;
  if found then
    if v_old.declared_by = auth.uid() then
      return jsonb_build_object('ok', true, 'duplicate', true, 'status', v_old.status);
    end if;
    raise exception 'Identifiant de paiement déjà utilisé' using errcode = '23505';
  end if;

  select * into v_c from cycles where id = p_cycle;
  if not found then raise exception 'Cycle introuvable' using errcode = 'P0002'; end if;
  select id into v_m from memberships where group_id = v_c.group_id and person_id = auth.uid() and status = 'actif';
  if v_m is null then raise exception 'Vous n''êtes pas membre de ce groupe' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide' using errcode = '22023'; end if;
  if p_method in ('mtn_momo', 'orange_money') and length(btrim(coalesce(p_reference, ''))) = 0 then
    raise exception 'Référence de transaction obligatoire pour MoMo et Orange Money' using errcode = '22023';
  end if;

  if p_debt is null then
    if v_c.status <> 'ouvert' then raise exception 'Ce cycle est clos' using errcode = 'P0001'; end if;
  else
    select * into v_d from debts where id = p_debt;
    if not found or v_d.membership_id <> v_m or v_d.cycle_id <> p_cycle then
      raise exception 'Dette introuvable' using errcode = 'P0002';
    end if;
    if v_d.settled_at is not null then raise exception 'Cette dette est déjà réglée' using errcode = 'P0001'; end if;
  end if;

  begin
    insert into payments(id, group_id, cycle_id, membership_id, debt_id, amount, method, reference, paid_on, status, declared_by)
    values (p_id, v_c.group_id, p_cycle, v_m, p_debt, p_amount, p_method, nullif(btrim(p_reference), ''),
            coalesce(p_paid_on, current_date), 'declare', auth.uid());
  exception when unique_violation then
    raise exception 'Un paiement est déjà enregistré pour ce cycle' using errcode = '23505';
  end;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'declare');
end $$;

create or replace function saisir_especes(p_id uuid, p_membership uuid, p_cycle uuid, p_amount int,
                                          p_paid_on date default null, p_debt uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old payments%rowtype; v_m memberships%rowtype; v_c cycles%rowtype; v_d debts%rowtype;
begin
  select * into v_old from payments where id = p_id;
  if found then
    if v_old.declared_by = auth.uid() then
      return jsonb_build_object('ok', true, 'duplicate', true, 'status', v_old.status);
    end if;
    raise exception 'Identifiant de paiement déjà utilisé' using errcode = '23505';
  end if;

  select * into v_m from memberships where id = p_membership;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_m.group_id);
  select * into v_c from cycles where id = p_cycle;
  if not found or v_c.group_id <> v_m.group_id then raise exception 'Cycle introuvable' using errcode = 'P0002'; end if;
  if v_m.status = 'retire' then raise exception 'Ce membre est retiré' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide' using errcode = '22023'; end if;

  if p_debt is null then
    if v_c.status <> 'ouvert' then raise exception 'Ce cycle est clos' using errcode = 'P0001'; end if;
  else
    select * into v_d from debts where id = p_debt;
    if not found or v_d.membership_id <> p_membership or v_d.cycle_id <> p_cycle then
      raise exception 'Dette introuvable' using errcode = 'P0002';
    end if;
    if v_d.settled_at is not null then raise exception 'Cette dette est déjà réglée' using errcode = 'P0001'; end if;
  end if;

  begin
    insert into payments(id, group_id, cycle_id, membership_id, debt_id, amount, method, paid_on,
                         status, declared_by, validated_by, validated_at)
    values (p_id, v_m.group_id, p_cycle, p_membership, p_debt, p_amount, 'especes', coalesce(p_paid_on, current_date),
            'valide', auth.uid(), auth.uid(), now());
  exception when unique_violation then
    raise exception 'Un paiement est déjà enregistré pour ce cycle' using errcode = '23505';
  end;
  if p_debt is not null then update debts set settled_at = now() where id = p_debt; end if;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'valide');
end $$;

create or replace function valider_paiement(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p payments%rowtype;
begin
  select * into v_p from payments where id = p_payment for update;
  if not found then raise exception 'Paiement introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_p.group_id);
  if v_p.status <> 'declare' then
    raise exception 'Ce paiement n''est pas en attente de validation' using errcode = 'P0001';
  end if;
  update payments set status = 'valide', validated_by = auth.uid(), validated_at = now() where id = p_payment;
  if v_p.debt_id is not null then update debts set settled_at = now() where id = v_p.debt_id; end if;
end $$;

create or replace function contester_paiement(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_p payments%rowtype; v_cycle_status cycle_status; v_nom text;
begin
  select * into v_p from payments where id = p_payment for update;
  if not found then raise exception 'Paiement introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_p.group_id);
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'Motif obligatoire' using errcode = '22023'; end if;
  if v_p.status = 'conteste' then raise exception 'Ce paiement est déjà contesté' using errcode = 'P0001'; end if;
  select status into v_cycle_status from cycles where id = v_p.cycle_id;
  if v_p.debt_id is null and v_cycle_status = 'clos' then
    raise exception 'Ce cycle est clos' using errcode = 'P0001';
  end if;

  update payments set status = 'conteste', contest_reason = btrim(p_reason),
                      validated_by = auth.uid(), validated_at = now()
   where id = p_payment;
  if v_p.debt_id is not null then update debts set settled_at = null where id = v_p.debt_id; end if;

  select display_name into v_nom from memberships where id = v_p.membership_id;
  perform journaliser(v_p.group_id, 'paiement_conteste',
    jsonb_build_object('nom', v_nom, 'montant', v_p.amount, 'motif', btrim(p_reason)), false);
end $$;

revoke execute on function declarer_paiement(uuid, uuid, int, pay_method, text, date, uuid),
                           saisir_especes(uuid, uuid, uuid, int, date, uuid),
                           valider_paiement(uuid), contester_paiement(uuid, text) from public, anon;
grant  execute on function declarer_paiement(uuid, uuid, int, pay_method, text, date, uuid),
                           saisir_especes(uuid, uuid, uuid, int, date, uuid),
                           valider_paiement(uuid), contester_paiement(uuid, text) to authenticated;
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\db && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add db/tests/paiements.test.mjs supabase/migrations/0005_paiements.sql && git commit -m "Lot 1 : déclaration, validation et contestation des paiements

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tours et cagnotte

**Files:**
- Create: `supabase/migrations/0006_tours.sql`, `db/tests/tours.test.mjs`

**Interfaces:**
- Consumes: `ouvrir_cycle`, `clore_cycle`, `designer_beneficiaires` (Task 4), `exiger_tresorier`, `journaliser`.
- Produces : `exiger_tontine(uuid) → void` (interne) ; `ordonner_tours(p_group uuid, p_order uuid[]) → void` ; `tirer_au_sort(p_group uuid) → jsonb` (tableau des noms dans le nouvel ordre) ; `echanger_tours(p_a uuid, p_b uuid) → void` ; `remplacer_beneficiaire(p_payout uuid, p_membership uuid) → void` ; `enregistrer_remise(p_payout uuid, p_amount int, p_method pay_method, p_reference text default null, p_paid_on date default null) → jsonb {ecart}` ; `nouveau_tour(p_group uuid) → int`.

- [ ] **Step 1: Écrire le test (échoue)**

`db/tests/tours.test.mjs` :
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc, as, pgArray } from "../harness.mjs";
import { seedPilot, G, M, P } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const positions = async () => Object.fromEntries((await q(
  `select id, position from memberships where group_id = '${G.tontine}'`)).map((r) => [r.id, r.position]));
const prevu = async (c) => (await q(`select id, membership_id from payouts where cycle_id = '${c}' and status = 'prevu'`))[0];
const ouvrir = (label = "Cycle") => rpc(db, P.tres, "ouvrir_cycle", [G.tontine, label]);

test("ordonner les tours à la main, avant verrouillage seulement", () => scenario(db, async () => {
  await seedPilot(db);
  await as(db, P.tres, "select ordonner_tours($1, $2::uuid[])", [G.tontine, pgArray([M.bob, M.alice, M.tres, M.invite])]);
  assert.deepEqual(await positions(), { [M.tres]: 3, [M.alice]: 2, [M.bob]: 1, [M.invite]: 4 });
  await assert.rejects(as(db, P.tres, "select ordonner_tours($1, $2::uuid[])",
    [G.tontine, pgArray([M.bob, M.bob, M.tres, M.invite])]), /chaque membre une seule fois/);
  await assert.rejects(as(db, P.alice, "select ordonner_tours($1, $2::uuid[])",
    [G.tontine, pgArray([M.bob, M.alice, M.tres, M.invite])]), /Réservé aux trésoriers/);
  await ouvrir();
  await assert.rejects(as(db, P.tres, "select ordonner_tours($1, $2::uuid[])",
    [G.tontine, pgArray([M.tres, M.alice, M.bob, M.invite])]), /verrouillé/);
}));

test("tirage au sort : ordre complet, journal visible des membres", () => scenario(db, async () => {
  await seedPilot(db);
  const noms = await rpc(db, P.tres, "tirer_au_sort", [G.tontine]);
  assert.deepEqual([...noms].sort(), ["Alice", "Bob", "Ines", "Tina"]);
  assert.deepEqual(Object.values(await positions()).sort(), [1, 2, 3, 4]);
  assert.equal((await as(db, P.alice, "select * from journal where action = 'tirage_au_sort'")).length, 1);
  await assert.rejects(rpc(db, P.xavier, "tirer_au_sort", [G.autre]), /Réservé aux tontines/);
}));

test("échanger deux tours après verrouillage échange aussi le bénéficiaire prévu", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await ouvrir();
  await rpc(db, P.tres, "echanger_tours", [M.tres, M.bob]);
  assert.equal((await prevu(c)).membership_id, M.bob);
  const pos = await positions();
  assert.deepEqual([pos[M.tres], pos[M.bob]], [3, 1]);
  assert.equal((await as(db, P.alice, "select * from journal where action = 'tours_echanges'")).length, 1);
}));

test("remplacer le bénéficiaire puis remettre la cagnotte", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await ouvrir();
  const p = await prevu(c);
  await rpc(db, P.tres, "remplacer_beneficiaire", [p.id, M.alice]);
  assert.equal((await prevu(c)).membership_id, M.alice);
  await assert.rejects(rpc(db, P.tres, "enregistrer_remise", [p.id, 19000, "mtn_momo", ""]), /Référence/);
  assert.deepEqual(await rpc(db, P.tres, "enregistrer_remise", [p.id, 19000, "mtn_momo", "MP55"]), { ecart: -1000 });
  await assert.rejects(rpc(db, P.tres, "enregistrer_remise", [p.id, 19000, "especes"]), /déjà remise/);
  await assert.rejects(rpc(db, P.tres, "echanger_tours", [M.alice, M.bob]), /déjà reçu sa part/);
}));

test("tour complet : 4 cycles, puis nouveau tour", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.tres, "nouveau_tour", [G.tontine]), /pas terminé/);
  for (let i = 1; i <= 4; i++) {
    const c = await ouvrir(`Cycle ${i}`);
    await rpc(db, P.tres, "enregistrer_remise", [(await prevu(c)).id, 20000, "especes"]);
    await rpc(db, P.tres, "clore_cycle", [c]);
  }
  await assert.rejects(ouvrir("Cycle 5"), /Tour terminé/);
  assert.equal((await q(`select count(*)::int n from cycles where group_id = '${G.tontine}'`))[0].n, 4);
  assert.equal(await rpc(db, P.tres, "nouveau_tour", [G.tontine]), 2);
  assert.equal((await q(`select order_locked from groups where id = '${G.tontine}'`))[0].order_locked, false);
  const c = await ouvrir("Tour 2, cycle 1");
  assert.deepEqual(await q(`select round, number from cycles where id = '${c}'`), [{ round: 2, number: 1 }]);
  assert.equal((await prevu(c)).membership_id, M.tres);
}));
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\db && npm test`
Expected: FAIL — `function ordonner_tours(unknown, uuid[]) does not exist`.

- [ ] **Step 3: Écrire `supabase/migrations/0006_tours.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : ordre des tours et remise de la cagnotte (tontines uniquement)
-- =====================================================================

create or replace function exiger_tontine(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = p_group and type = 'tontine') then
    raise exception 'Réservé aux tontines' using errcode = 'P0001';
  end if;
end $$;

create or replace function ordonner_tours(p_group uuid, p_order uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype; v_attendus uuid[]; v_recus uuid[];
begin
  perform exiger_tresorier(p_group);
  perform exiger_tontine(p_group);
  select * into v_g from groups where id = p_group for update;
  if v_g.order_locked then
    raise exception 'L''ordre est verrouillé : utilisez l''échange de tours' using errcode = 'P0001';
  end if;
  select array_agg(id order by id) into v_attendus from memberships where group_id = p_group and status <> 'retire';
  select array_agg(x order by x) into v_recus from unnest(p_order) x;
  if v_recus is distinct from v_attendus then
    raise exception 'La liste doit contenir chaque membre une seule fois' using errcode = '22023';
  end if;

  update memberships m set position = o.rang
    from unnest(p_order) with ordinality as o(id, rang)
   where m.id = o.id;
  perform journaliser(p_group, 'ordre_modifie', jsonb_build_object('ordre',
    (select jsonb_agg(display_name order by position) from memberships where group_id = p_group and status <> 'retire')), true);
end $$;

create or replace function tirer_au_sort(p_group uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype; v_ordre jsonb;
begin
  perform exiger_tresorier(p_group);
  perform exiger_tontine(p_group);
  select * into v_g from groups where id = p_group for update;
  if v_g.order_locked then
    raise exception 'L''ordre est verrouillé : utilisez l''échange de tours' using errcode = 'P0001';
  end if;

  update memberships m set position = r.rang
    from (select id, row_number() over (order by gen_random_uuid()) as rang
            from memberships where group_id = p_group and status <> 'retire') r
   where m.id = r.id;
  select jsonb_agg(display_name order by position) into v_ordre
    from memberships where group_id = p_group and status <> 'retire';
  perform journaliser(p_group, 'tirage_au_sort', jsonb_build_object('ordre', v_ordre), true);
  return v_ordre;
end $$;

create or replace function echanger_tours(p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_a memberships%rowtype; v_b memberships%rowtype; v_round int;
begin
  select * into v_a from memberships where id = p_a for update;
  select * into v_b from memberships where id = p_b for update;
  if v_a.id is null or v_b.id is null then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  if v_a.group_id <> v_b.group_id or v_a.id = v_b.id then
    raise exception 'Échange impossible entre ces membres' using errcode = '22023';
  end if;
  perform exiger_tresorier(v_a.group_id);
  perform exiger_tontine(v_a.group_id);
  if v_a.status = 'retire' or v_b.status = 'retire' then raise exception 'Ce membre est retiré' using errcode = 'P0001'; end if;
  select current_round into v_round from groups where id = v_a.group_id;
  if exists (select 1 from payouts where membership_id in (p_a, p_b) and round = v_round and status = 'remis') then
    raise exception 'Un de ces membres a déjà reçu sa part dans ce tour' using errcode = 'P0001';
  end if;

  update memberships set position = case id when p_a then v_b.position else v_a.position end
   where id in (p_a, p_b);
  -- Les contraintes d'unicité de payouts sont « deferrable » : l'échange se vérifie en fin d'instruction
  update payouts set membership_id = case membership_id when p_a then p_b else p_a end
   where membership_id in (p_a, p_b) and round = v_round and status = 'prevu';
  perform journaliser(v_a.group_id, 'tours_echanges',
    jsonb_build_object('a', v_a.display_name, 'b', v_b.display_name), true);
end $$;

create or replace function remplacer_beneficiaire(p_payout uuid, p_membership uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p payouts%rowtype;
begin
  select * into v_p from payouts where id = p_payout;
  if not found then raise exception 'Bénéficiaire introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_p.group_id);
  if v_p.status <> 'prevu' then raise exception 'Cette cagnotte est déjà remise' using errcode = 'P0001'; end if;
  perform echanger_tours(v_p.membership_id, p_membership);
end $$;

create or replace function enregistrer_remise(p_payout uuid, p_amount int, p_method pay_method,
                                              p_reference text default null, p_paid_on date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p payouts%rowtype; v_nom text;
begin
  select * into v_p from payouts where id = p_payout for update;
  if not found then raise exception 'Bénéficiaire introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_p.group_id);
  if v_p.status <> 'prevu' then raise exception 'Cette cagnotte est déjà remise' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide' using errcode = '22023'; end if;
  if p_method in ('mtn_momo', 'orange_money') and length(btrim(coalesce(p_reference, ''))) = 0 then
    raise exception 'Référence de transaction obligatoire pour MoMo et Orange Money' using errcode = '22023';
  end if;

  update payouts set amount = p_amount, method = p_method, reference = nullif(btrim(p_reference), ''),
                     paid_on = coalesce(p_paid_on, current_date), status = 'remis', recorded_by = auth.uid()
   where id = p_payout;
  select display_name into v_nom from memberships where id = v_p.membership_id;
  perform journaliser(v_p.group_id, 'cagnotte_remise', jsonb_build_object('nom', v_nom, 'montant', p_amount), true);
  return jsonb_build_object('ecart', p_amount - v_p.amount_expected);
end $$;

create or replace function nouveau_tour(p_group uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype;
begin
  perform exiger_tresorier(p_group);
  perform exiger_tontine(p_group);
  select * into v_g from groups where id = p_group for update;
  if exists (select 1 from cycles where group_id = p_group and status = 'ouvert') then
    raise exception 'Clôturez d''abord le cycle en cours' using errcode = 'P0001';
  end if;
  if exists (select 1 from memberships m
              where m.group_id = p_group and m.status <> 'retire'
                and not exists (select 1 from payouts p where p.membership_id = m.id
                                  and p.round = v_g.current_round and p.status = 'remis')) then
    raise exception 'Le tour n''est pas terminé : tous les membres n''ont pas reçu leur part' using errcode = 'P0001';
  end if;

  update groups set current_round = current_round + 1, order_locked = false where id = p_group;
  perform journaliser(p_group, 'nouveau_tour', jsonb_build_object('tour', v_g.current_round + 1), true);
  return v_g.current_round + 1;
end $$;

revoke execute on function exiger_tontine(uuid) from public, anon, authenticated;
revoke execute on function ordonner_tours(uuid, uuid[]), tirer_au_sort(uuid), echanger_tours(uuid, uuid),
                           remplacer_beneficiaire(uuid, uuid), enregistrer_remise(uuid, int, pay_method, text, date),
                           nouveau_tour(uuid) from public, anon;
grant  execute on function ordonner_tours(uuid, uuid[]), tirer_au_sort(uuid), echanger_tours(uuid, uuid),
                           remplacer_beneficiaire(uuid, uuid), enregistrer_remise(uuid, int, pay_method, text, date),
                           nouveau_tour(uuid) to authenticated;
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\db && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add db/tests/tours.test.mjs supabase/migrations/0006_tours.sql && git commit -m "Lot 1 : ordre des tours et remise de la cagnotte

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Liste blanche des privilèges

**Files:**
- Create: `db/tests/privileges.test.mjs`
- Modify (seulement si le test échoue) : la migration qui a créé la fonction en trop, pour y ajouter son `revoke`.

**Interfaces:**
- Consumes: toutes les migrations 0001–0006.
- Produces: la liste blanche officielle des fonctions appelables par l'application (lots 2 à 5).

- [ ] **Step 1: Écrire le test**

`db/tests/privileges.test.mjs` :
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../harness.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;

/** Seules fonctions appelables par l'application (rôle authenticated). */
export const ALLOWED = [
  "ajouter_membre", "apercu_retrait", "changer_role", "clore_cycle", "contester_paiement", "creer_groupe",
  "declarer_paiement", "echanger_tours", "enregistrer_remise", "is_member", "is_platform_admin", "is_treasurer",
  "nouveau_tour", "ordonner_tours", "ordre_tours", "ouvrir_cycle", "recouvrement", "remplacer_beneficiaire",
  "retirer_membre", "rouvrir_cycle", "saisir_especes", "tirer_au_sort", "valider_paiement",
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
```

- [ ] **Step 2: Lancer les tests**

Run: `cd D:\njangi237\db && npm test`
Expected: PASS. Si « authenticated n'exécute que la liste blanche » échoue, le message liste la fonction en trop (ou manquante) : ajouter son `revoke … from public, anon, authenticated` (ou son `grant`) dans la migration qui la crée, puis relancer jusqu'au PASS.

- [ ] **Step 3: Commit**

```bash
cd D:\njangi237 && git add db/tests/privileges.test.mjs supabase/migrations && git commit -m "Lot 1 : liste blanche des privilèges

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Déploiement sur Supabase

**Files:**
- Create: `db/remote_smoke.sql`
- Modify: `README.md` (section « v2 — base de données »)

**Interfaces:**
- Consumes: migrations 0001–0006 testées.
- Produces: projet Supabase `njangi237` (ref et URL notées dans le README) utilisé par les lots 2 à 6.

- [ ] **Step 1: Demander l'accord d'Olivier**

Point d'arrêt obligatoire. Vérifier d'abord avec `list_projects` que l'organisation « cyberIA org » (`xvxutqqlyrqvwotgdewl`) a de la place sur l'offre gratuite (projets actifs : `kolitrack` ; `DCFMInternalMailManagement` en pause). Puis demander en clair : « Je crée le projet Supabase `njangi237` (cyberIA org, eu-west-1, offre gratuite) ? ». Ne rien créer sans un oui explicite.

- [ ] **Step 2: Créer le projet**

Avec l'outil Supabase : `get_cost` (type `project`, organisation `xvxutqqlyrqvwotgdewl`) → `confirm_cost` → `create_project` (nom `njangi237`, région `eu-west-1`). Attendre que `get_project` renvoie le statut `ACTIVE_HEALTHY`.

- [ ] **Step 3: Appliquer les migrations**

`apply_migration` six fois, dans l'ordre, avec le contenu exact des fichiers : `schema` (0001), `acces` (0002), `groupes_membres` (0003), `cycles` (0004), `paiements` (0005), `tours` (0006). Puis `execute_sql` : `alter database postgres set timezone to 'Africa/Douala';`.
Expected: chaque appel renvoie `success`. En cas d'échec, corriger le fichier, relancer `npm test`, réappliquer la migration fautive.

- [ ] **Step 4: Écrire `db/remote_smoke.sql`**

```sql
-- Vérification rapide sur Supabase : tout est annulé à la fin (rollback).
begin;
insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-000000000002','237690000002@njangi237.local'),
  ('00000000-0000-4000-8000-000000000003','237690000003@njangi237.local');
insert into people(id, phone, full_name) values
  ('00000000-0000-4000-8000-000000000002','237690000002','Tina'),
  ('00000000-0000-4000-8000-000000000003','237690000003','Alice');
insert into groups(id, name, amount) values ('00000000-0000-4000-8000-000000000101','Smoke',5000);
insert into memberships(id, group_id, person_id, display_name, phone, role, status, position) values
  ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000002','Tina','237690000002','tresorier','actif',1),
  ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000003','Alice','237690000003','membre','actif',2);
create temp table r(etape text, res jsonb) on commit drop;
grant insert, select on r to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into r select 'ouvrir', to_jsonb(ouvrir_cycle('00000000-0000-4000-8000-000000000101', 'Smoke 1'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
insert into r select 'declarer', declarer_paiement('00000000-0000-4000-8000-000000000301',
  (select (res #>> '{}')::uuid from r where etape = 'ouvrir'), 5000, 'mtn_momo', 'MP1');
insert into r select 'alice_voit_paiements', to_jsonb((select count(*) from payments));
insert into r select 'alice_voit_adhesions', to_jsonb((select count(*) from memberships));
insert into r select 'ordre', (select jsonb_agg(display_name) from ordre_tours('00000000-0000-4000-8000-000000000101'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select valider_paiement('00000000-0000-4000-8000-000000000301');
insert into r select 'recouvrement', (select to_jsonb(x) from recouvrement('00000000-0000-4000-8000-000000000101') x);
reset role;
select * from r;
rollback;
```

- [ ] **Step 5: Lancer la vérification distante**

`execute_sql` avec le contenu de `db/remote_smoke.sql`.
Expected (lignes de `r`) : `ouvrir` = un uuid ; `declarer` = `{"ok": true, "status": "declare", "duplicate": false}` ; `alice_voit_paiements` = 1 ; `alice_voit_adhesions` = 1 ; `ordre` = `["Tina", "Alice"]` ; `recouvrement` avec `payes` = 1, `collecte` = 5000, `attendu` = 10000. Puis `execute_sql` : `select count(*) from groups;` → 0 (rien n'est resté).

- [ ] **Step 6: Analyse de sécurité**

`get_advisors` (type `security`).
Expected : uniquement des avertissements « authenticated security definer function executable » sur les fonctions de la liste blanche (voulu : ce sont les points d'entrée de l'application). Toute autre alerte (RLS désactivée, search_path mutable, vue security definer) = corriger dans une nouvelle migration `0007_correctifs.sql`, l'ajouter aux tests, l'appliquer.

- [ ] **Step 7: Documenter et commit**

Ajouter au `README.md`, avant « ## Utilisation immédiate (sans hébergement) » :
````markdown
## v2 — base de données (en cours)

- Projet Supabase `njangi237` : ref `<ref renvoyée à l'étape 2>`, URL `https://<ref>.supabase.co`, région eu-west-1, fuseau Africa/Douala.
- Migrations : `supabase/migrations/0001…0006`. Tests locaux sans Docker :
  ```bash
  cd db && npm install && npm test
  ```
- Vérification après déploiement : exécuter `db/remote_smoke.sql` dans l'éditeur SQL (tout est annulé à la fin).
````
(L'exécutant remplace `<ref renvoyée à l'étape 2>` et `<ref>` par la valeur réelle avant de committer.)

```bash
cd D:\njangi237 && git add README.md db/remote_smoke.sql && git commit -m "Lot 1 : base déployée sur Supabase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
