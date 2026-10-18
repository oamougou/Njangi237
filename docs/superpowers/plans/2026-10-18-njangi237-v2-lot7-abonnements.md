# Njangi237 v2 — Lot 7 : offres et abonnements — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire payer les trésoriers et associations (jamais les membres) : offre en vigueur par groupe, limites appliquées par la base (blocage doux), demande de paiement par le trésorier, activation par l'administrateur, onglet Abonnement et section Abonnements de l'administration.

**Architecture:** Deux migrations. `0009_abonnements.sql` crée les abonnements, la fonction `offre_en_vigueur` et branche les limites dans `ajouter_membre` et `ouvrir_cycle` ; elle donne l'offre Pilote aux groupes existants. `0010_demandes_abonnement.sql` ajoute les demandes, les prix, les fonctions d'administration et deux lectures en JSON (`mon_abonnement`, `admin_abonnements`). L'application ajoute des méthodes au contrat `Api`, une logique pure (`lib/abonnement.ts`), l'onglet Abonnement du groupe et la section Abonnements de l'administration.

**Tech Stack:** PostgreSQL (Supabase) testé avec PGlite 0.5.8 (`node --test`) ; React 18.3.1, TypeScript, Vitest 4.1.11, React Testing Library 16.3.3, user-event 14.6.7 ; supabase-js.

**Spec:** `docs/superpowers/specs/2026-10-18-njangi237-lot7-abonnements-design.md`

### Écarts assumés par rapport à la spécification

1. **Deux migrations au lieu d'une** (`0009` offres et limites, `0010` demandes et administration) : chaque tâche a sa migration et ses tests.
2. **Prolongation par allongement** : accepter une demande allonge la date de fin de l'abonnement payant en cours de même offre (aucun jour perdu) au lieu de créer une période qui commence à sa fin. L'historique montre une ligne par abonnement.
3. **Prix de lancement de l'offre Diaspora arrondi à l'euro supérieur** (3 € par mois, 25 € par an) : les montants sont des entiers.
4. **Acceptation d'une demande Association** : l'administrateur coche jusqu'à 4 autres groupes au moment d'accepter.

## Global Constraints

- Les membres ne paient jamais et ne voient rien des abonnements ; seuls le trésorier du groupe et l'administrateur de la plateforme y ont accès.
- Blocage doux : seuls `ajouter_membre` (limite atteinte) et `ouvrir_cycle` (limite dépassée) sont refusés ; tout le reste continue.
- Limites : Découverte 10 ; Essai, Groupe, Association, Diaspora, Pilote 50 (et jamais plus que `groups.max_members`). Essai = 30 jours après la création du groupe.
- Prix (FCFA sauf Diaspora) : Groupe 2 000 / mois, 20 000 / an ; Association 7 500 / 75 000 ; Diaspora 5 € / 50 €. Prix de lancement : moitié prix arrondi à l'unité supérieure, 50 groupes au plus.
- Groupes existants à l'application de la migration : offre Pilote jusqu'au 31 janvier 2027 inclus, heure de Douala (fin = `2027-02-01 00:00:00+01`).
- Messages d'erreur en français, repris tels quels par l'application.
- Tables nouvelles sans aucun droit pour `anon` et `authenticated` (accès par fonctions seulement) ; nouvelles fonctions appelables révoquées pour `public, anon` et accordées à `authenticated` ; fonctions internes révoquées pour tous.
- La migration ne s'applique sur Supabase qu'après le feu vert d'Olivier (aperçu et production partagent la base).
- Branche `v2-lot7` ; commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commandes : `cd D:\njangi237\db && npm test` (≈ 2 min) ; `cd D:\njangi237\app && npm test` ; `npm run build && npm run verifier`.

## Review Focus

1. **Payer à nouveau avant la fin** : la nouvelle durée s'ajoute à la date de fin, aucun jour payé n'est perdu → test Task 2 (« prolongation »).
2. **Deux trésoriers du même groupe envoient une demande** : la seconde est refusée tant que la première est en attente → test Task 2.
3. **Groupe couvert à la fois par une Association et par une offre Pilote** : l'offre payante l'emporte → test Task 1.
4. **Date de fin du Pilote** : fin de la journée choisie à Douala, pas minuit UTC → test Task 2.
5. **Bandeau de blocage visible sur les autres onglets** (Cycle, Membres), pas seulement dans l'onglet Abonnement → test Task 4.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0009_abonnements.sql` | Tables d'abonnement, `offre_en_vigueur`, limites dans `ajouter_membre` / `ouvrir_cycle`, reprise Pilote |
| `supabase/migrations/0010_demandes_abonnement.sql` | Demandes, prix, fonctions d'administration, lectures `mon_abonnement` et `admin_abonnements` |
| `db/tests/abonnements.test.mjs` | Offre en vigueur, limites, blocage doux, reprise Pilote |
| `db/tests/demandes.test.mjs` | Demandes, acceptation, refus, Pilote, Association, prix de lancement, droits, lectures |
| `db/tests/privileges.test.mjs` | Liste blanche complétée |
| `app/src/lib/types.ts` | Types et méthodes du contrat `Api` |
| `app/src/lib/abonnement.ts` | Libellés, tarifs, prix, alerte |
| `app/src/lib/supabaseApi.ts`, `app/src/lib/demo/demoApi.ts` | Implémentations |
| `app/src/lib/journal.ts` | Phrases des nouvelles entrées du journal |
| `app/src/lib/routes.ts` | Onglet `abonnement` |
| `app/src/test/fauxApi.ts`, `app/src/test/donnees.ts` | Fausse Api et données |
| `app/src/ui/groupe/OngletAbonnement.tsx` | Onglet du trésorier |
| `app/src/ui/groupe/Groupe.tsx` | Onglet et bandeau |
| `app/src/ui/AdminAbonnements.tsx`, `app/src/ui/Admin.tsx` | Section de l'administration |

---

### Task 1: Offre en vigueur et limites (base)

**Files:**
- Create: `supabase/migrations/0009_abonnements.sql`, `db/tests/abonnements.test.mjs`

**Interfaces:**
- Produces (SQL): tables `abonnements(id, offre, debut, fin, cree_par, created_at)`, `abonnements_groupes(abonnement_id, group_id)`, `parametres_plateforme(cle, valeur)` ; colonne `groups.prix_lancement` ; `libelle_offre(text) → text` ; `offre_en_vigueur(uuid) → table(offre text, limite int, fin timestamptz)` (une ligne) ; `reprendre_groupes_pilote(timestamptz) → int`. Toutes internes (non appelables par l'application).

- [ ] **Step 1: Se placer sur la branche**

```bash
cd D:\njangi237 && git checkout v2-lot7 && git log --oneline -1
```

Expected: `Lot 7 : conception des offres et abonnements`.

- [ ] **Step 2: Écrire les tests qui échouent — `db/tests/abonnements.test.mjs`**

```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const offre = async (g = G.tontine) => (await q(`select * from offre_en_vigueur($1)`, [g]))[0];
const vieillir = (jours, g = G.tontine) => db.exec(`update groups set created_at = now() - interval '${jours} days' where id = '${g}'`);
async function abonner(offreCode, debut, fin, groupes = [G.tontine]) {
  const [{ id }] = await q(`insert into abonnements(offre, debut, fin) values ($1, now() + $2::interval, now() + $3::interval) returning id`,
    [offreCode, debut, fin]);
  for (const g of groupes) await q(`insert into abonnements_groupes values ($1, $2)`, [id, g]);
  return id;
}
/** Ajoute n membres invités à la tontine (qui en compte déjà 4). */
async function ajouter(n, debut = 10) {
  for (let i = 0; i < n; i++) await rpc(db, P.tres, "ajouter_membre", [G.tontine, `Membre ${debut + i}`, `6910000${String(debut + i).padStart(2, "0")}`]);
}

test("groupe neuf : essai de 30 jours, 50 membres", () => scenario(db, async () => {
  await seedPilot(db);
  const o = await offre();
  assert.equal(o.offre, "essai");
  assert.equal(o.limite, 50);
  const [{ attendu }] = await q(`select created_at + interval '30 days' as attendu from groups where id = $1`, [G.tontine]);
  assert.equal(o.fin.getTime(), attendu.getTime());
}));

test("après 30 jours sans abonnement : Découverte, 10 membres, sans date de fin", () => scenario(db, async () => {
  await seedPilot(db); await vieillir(31);
  assert.deepEqual({ ...(await offre()) }, { offre: "decouverte", limite: 10, fin: null });
}));

test("Pilote en cours, puis offre payante qui l'emporte, puis retour à Découverte quand tout est échu", () => scenario(db, async () => {
  await seedPilot(db); await vieillir(60);
  await abonner("pilote", "-1 day", "10 days");
  assert.equal((await offre()).offre, "pilote");
  await abonner("association", "-1 day", "5 days", [G.tontine, G.autre]);
  assert.equal((await offre()).offre, "association");
  assert.equal((await offre(G.autre)).offre, "association");
  await db.exec(`update abonnements set fin = now() - interval '1 hour', debut = now() - interval '2 days'`);
  assert.equal((await offre()).offre, "decouverte");
}));

test("Découverte : le 11e membre est refusé avec le message de l'offre", () => scenario(db, async () => {
  await seedPilot(db); await vieillir(31);
  await ajouter(6);                       // 4 + 6 = 10
  await assert.rejects(ajouter(1, 30),
    /Limite de l'offre Découverte atteinte \(10 membres\) : passez à l'offre Groupe dans l'onglet Abonnement/);
}));

test("offres à 50 : le message de limite reste celui du maximum du groupe", () => scenario(db, async () => {
  await seedPilot(db);
  await db.exec(`update groups set max_members = 4 where id = '${G.tontine}'`);
  await assert.rejects(ajouter(1), /Nombre maximum de membres atteint \(4\)/);
}));

test("fin d'essai au-dessus de la limite : pas de nouveau cycle, mais tout le reste continue", () => scenario(db, async () => {
  await seedPilot(db);
  await ajouter(8);                       // 12 membres pendant l'essai
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await vieillir(31);
  await rpc(db, P.tres, "saisir_especes", [u(901), M.alice, c, 5000]);   // encaissement permis malgré le blocage
  await rpc(db, P.tres, "clore_cycle", [c]);                             // clôture permise aussi
  await assert.rejects(rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Novembre"]),
    /Votre groupe compte 12 membres, l'offre Découverte en permet 10 : choisissez une offre dans l'onglet Abonnement/);
  await assert.rejects(ajouter(1, 40), /Limite de l'offre Découverte atteinte/);
}));

test("reprise : chaque groupe sans abonnement reçoit l'offre Pilote, une seule fois", () => scenario(db, async () => {
  await seedPilot(db); await vieillir(90); await vieillir(90, G.autre);
  assert.equal((await q(`select reprendre_groupes_pilote('2027-02-01 00:00:00+01') as n`))[0].n, 2);
  assert.equal((await q(`select reprendre_groupes_pilote('2027-02-01 00:00:00+01') as n`))[0].n, 0);
  const o = await offre();
  assert.equal(o.offre, "pilote");
  assert.equal(o.fin.toISOString(), "2027-01-31T23:00:00.000Z");
}));

test("schéma : prix de lancement faux par défaut, ancienne colonne plan retirée, tables fermées à l'application", () => scenario(db, async () => {
  await seedPilot(db);
  assert.equal((await q(`select prix_lancement from groups where id = $1`, [G.tontine]))[0].prix_lancement, false);
  assert.equal((await q(`select count(*)::int n from information_schema.columns where table_name = 'groups' and column_name = 'plan'`))[0].n, 0);
  assert.equal((await q(`select count(*)::int n from information_schema.role_table_grants
    where table_name in ('abonnements','abonnements_groupes','parametres_plateforme') and grantee in ('anon','authenticated')`))[0].n, 0);
}));
```

- [ ] **Step 3: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\db && node --test tests/abonnements.test.mjs`
Expected: FAIL (`function offre_en_vigueur(unknown) does not exist`).

- [ ] **Step 4: Écrire `supabase/migrations/0009_abonnements.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : offres et abonnements (lot 7)
-- Offre en vigueur d'un groupe : abonnement payant en cours > Pilote en cours > essai (30 jours) > Découverte.
-- Blocage doux : seuls l'ajout de membres et l'ouverture de cycle dépendent de la limite.
-- =====================================================================

alter table groups drop column plan;
alter table groups add column prix_lancement boolean not null default false;

create table abonnements (
  id         uuid primary key default gen_random_uuid(),
  offre      text not null check (offre in ('groupe', 'association', 'diaspora', 'pilote')),
  debut      timestamptz not null default now(),
  fin        timestamptz not null,
  cree_par   uuid references people(id),
  created_at timestamptz not null default now(),
  check (fin > debut)
);
create table abonnements_groupes (
  abonnement_id uuid not null references abonnements(id) on delete cascade,
  group_id      uuid not null references groups(id) on delete cascade,
  primary key (abonnement_id, group_id)
);
create index abonnements_groupes_groupe_idx on abonnements_groupes(group_id);
create table parametres_plateforme (cle text primary key, valeur text);

alter table abonnements           enable row level security;
alter table abonnements_groupes   enable row level security;
alter table parametres_plateforme enable row level security;
-- Aucune lecture directe : tout passe par les fonctions (comme les invitations)
revoke all on abonnements, abonnements_groupes, parametres_plateforme from anon, authenticated;

create or replace function libelle_offre(p_offre text) returns text
language sql immutable set search_path = public as $$
  select case p_offre when 'decouverte' then 'Découverte' when 'essai' then 'Essai' when 'groupe' then 'Groupe'
    when 'association' then 'Association' when 'diaspora' then 'Diaspora' when 'pilote' then 'Pilote' else p_offre end
$$;

create or replace function offre_en_vigueur(p_group uuid)
returns table (offre text, limite int, fin timestamptz)
language sql stable security definer set search_path = public as $$
  with choix as (
    select a.offre, a.fin
      from abonnements a join abonnements_groupes ag on ag.abonnement_id = a.id
     where ag.group_id = p_group and a.debut <= now() and now() < a.fin
     order by (a.offre = 'pilote'), a.fin desc
     limit 1
  )
  select c.offre, 50, c.fin from choix c
  union all
  select case when now() < g.created_at + interval '30 days' then 'essai' else 'decouverte' end,
         case when now() < g.created_at + interval '30 days' then 50 else 10 end,
         case when now() < g.created_at + interval '30 days' then g.created_at + interval '30 days' end
    from groups g
   where g.id = p_group and not exists (select 1 from choix)
$$;

-- Lot 1 + limite de l'offre en vigueur
create or replace function ajouter_membre(p_group uuid, p_name text, p_phone text, p_role member_role default 'membre')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := normaliser_telephone(p_phone);
  v_g     groups%rowtype;
  v_old   memberships%rowtype;
  v_count int;
  v_pos   int;
  v_id    uuid;
  v_o     record;
begin
  perform exiger_tresorier(p_group);
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Nom obligatoire' using errcode = '22023'; end if;

  select * into v_g from groups where id = p_group for update;
  select count(*) into v_count from memberships where group_id = p_group and status <> 'retire';
  select * into v_o from offre_en_vigueur(p_group);
  if v_o.offre = 'decouverte' and v_count >= v_o.limite then
    raise exception 'Limite de l''offre Découverte atteinte (% membres) : passez à l''offre Groupe dans l''onglet Abonnement', v_o.limite
      using errcode = 'P0001';
  end if;
  if v_count >= least(v_g.max_members, v_o.limite) then
    raise exception 'Nombre maximum de membres atteint (%)', least(v_g.max_members, v_o.limite) using errcode = 'P0001';
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

-- Lot 1 + refus quand le groupe dépasse la limite de son offre
create or replace function ouvrir_cycle(p_group uuid, p_label text, p_due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype; v_id uuid; v_num int; v_n int; v_o record;
begin
  perform exiger_tresorier(p_group);
  if length(btrim(coalesce(p_label, ''))) = 0 then raise exception 'Libellé du cycle obligatoire' using errcode = '22023'; end if;
  select * into v_g from groups where id = p_group for update;
  if exists (select 1 from cycles where group_id = p_group and status = 'ouvert') then
    raise exception 'Un cycle est déjà ouvert : clôturez-le d''abord' using errcode = 'P0001';
  end if;
  select count(*) into v_n from memberships where group_id = p_group and status <> 'retire';
  if v_n = 0 then raise exception 'Aucun membre dans le groupe' using errcode = 'P0001'; end if;
  select * into v_o from offre_en_vigueur(p_group);
  if v_n > v_o.limite then
    raise exception 'Votre groupe compte % membres, l''offre % en permet % : choisissez une offre dans l''onglet Abonnement',
      v_n, libelle_offre(v_o.offre), v_o.limite using errcode = 'P0001';
  end if;

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

-- Offre Pilote pour chaque groupe qui n'a encore aucun abonnement (reprise des groupes existants)
create or replace function reprendre_groupes_pilote(p_fin timestamptz) returns int
language plpgsql security definer set search_path = public as $$
declare v_g uuid; v_a uuid; v_n int := 0;
begin
  for v_g in select g.id from groups g
              where not exists (select 1 from abonnements_groupes ag where ag.group_id = g.id) loop
    insert into abonnements(offre, fin) values ('pilote', p_fin) returning id into v_a;
    insert into abonnements_groupes(abonnement_id, group_id) values (v_a, v_g);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Groupes existants : Pilote jusqu'au 31 janvier 2027 inclus, heure de Douala
select reprendre_groupes_pilote('2027-02-01 00:00:00+01');

revoke execute on function libelle_offre(text), offre_en_vigueur(uuid), reprendre_groupes_pilote(timestamptz)
  from public, anon, authenticated;
```

- [ ] **Step 5: Lancer les tests**

Run: `cd D:\njangi237\db && node --test tests/abonnements.test.mjs && npm test`
Expected: PASS (8 tests du lot ; toute la suite, 71 tests existants inclus, passe : les groupes des fixtures sont créés « maintenant », donc en essai).

- [ ] **Step 6: Commit**

```bash
cd D:\njangi237 && git add supabase/migrations/0009_abonnements.sql db/tests/abonnements.test.mjs && git commit -m "Lot 7 : offre en vigueur, limites dans ajouter_membre et ouvrir_cycle, Pilote pour les groupes existants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Demandes, administration et lectures (base)

**Files:**
- Create: `supabase/migrations/0010_demandes_abonnement.sql`, `db/tests/demandes.test.mjs`
- Modify: `db/tests/privileges.test.mjs` (liste blanche)

**Interfaces:**
- Consumes: Task 1 (`offre_en_vigueur`, tables).
- Produces (SQL, appelables par `authenticated`) :
  - `demander_abonnement(p_group uuid, p_offre text, p_duree int, p_moyen pay_method, p_reference text default null, p_precisions text default null) → uuid`
  - `annuler_demande(p_demande uuid) → void`
  - `accepter_demande(p_demande uuid, p_autres uuid[] default '{}') → timestamptz` (nouvelle fin)
  - `refuser_demande(p_demande uuid, p_motif text) → void`
  - `attribuer_pilote(p_group uuid, p_fin date) → timestamptz`
  - `creer_association(p_groupes uuid[], p_duree int) → timestamptz`
  - `changer_prix_lancement(p_group uuid, p_actif boolean) → void`
  - `regler_paiement(p_mtn text, p_orange text, p_beneficiaire text) → void`
  - `mon_abonnement(p_group uuid) → jsonb` : `{offre, limite, fin, membres, prix_lancement, demande, historique[], paiement{mtn, orange, beneficiaire}}`
  - `admin_abonnements() → jsonb` : `{demandes[], groupes[], lancements, paiement{…}}`
- Produces (internes) : `prix_offre(text, int, boolean) → table(montant int, devise text)`, `exiger_admin()`, `prolonger_abonnement(uuid[], text, int) → timestamptz`.

- [ ] **Step 1: Écrire les tests qui échouent — `db/tests/demandes.test.mjs`**

```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc } from "../harness.mjs";
import { seedPilot, G, P } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const demander = (who = P.tres, offre = "groupe", duree = 1, moyen = "mtn_momo", ref = "MP1", g = G.tontine, precisions = null) =>
  rpc(db, who, "demander_abonnement", [g, offre, duree, moyen, ref, precisions]);
const etat = (who = P.tres, g = G.tontine) => rpc(db, who, "mon_abonnement", [g]);

test("le trésorier demande : montant calculé, une seule demande en attente, référence obligatoire", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(demander(P.tres, "groupe", 1, "orange_money", " "), /Référence de transaction obligatoire/);
  await assert.rejects(demander(P.tres, "groupe", 3), /Durée invalide : 1 ou 12 mois/);
  await assert.rejects(demander(P.tres, "pilote"), /Offre inconnue/);
  await demander(P.tres, "groupe", 12);
  const e = await etat();
  assert.equal(e.demande.statut, "en_attente");
  assert.equal(e.demande.montant, 20000);
  assert.equal(e.demande.devise, "XAF");
  await assert.rejects(demander(), /Une demande est déjà en attente pour ce groupe/);
  assert.equal((await q(`select count(*)::int n from journal where action = 'abonnement_demande' and not visible_to_members`))[0].n, 1);
}));

test("droits : membre, trésorier d'un autre groupe, anonyme", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(demander(P.alice), /Réservé aux trésoriers du groupe/);
  await assert.rejects(demander(P.xavier), /Réservé aux trésoriers du groupe/);
  await assert.rejects(etat(P.alice), /Réservé aux trésoriers du groupe/);
  await assert.rejects(rpc(db, P.tres, "admin_abonnements", []), /Réservé aux administrateurs de la plateforme/);
  await assert.rejects(rpc(db, null, "mon_abonnement", [G.tontine]), /permission denied/);
}));

test("annulation par le trésorier, puis nouvelle demande possible", () => scenario(db, async () => {
  await seedPilot(db);
  const id = await demander();
  await rpc(db, P.tres, "annuler_demande", [id]);
  await assert.rejects(rpc(db, P.tres, "annuler_demande", [id]), /Cette demande a déjà été traitée/);
  await demander();
}));

test("acceptation : offre Groupe active ; prolongation sans jour perdu", () => scenario(db, async () => {
  await seedPilot(db);
  const fin1 = await rpc(db, P.admin, "accepter_demande", [await demander()]);
  let e = await etat();
  assert.equal(e.offre, "groupe");
  assert.equal(e.demande.statut, "acceptee");
  const fin2 = await rpc(db, P.admin, "accepter_demande", [await demander(P.tres, "groupe", 12)]);
  const [{ attendu }] = await q(`select ($1::timestamptz + interval '12 months') as attendu`, [fin1]);
  assert.equal(new Date(fin2).getTime(), attendu.getTime());
  e = await etat();
  assert.equal(e.historique.length, 1);
  assert.equal(new Date(e.fin).getTime(), new Date(fin2).getTime());
}));

test("refus avec motif obligatoire, visible du trésorier", () => scenario(db, async () => {
  await seedPilot(db);
  const id = await demander();
  await assert.rejects(rpc(db, P.admin, "refuser_demande", [id, "  "]), /Motif obligatoire/);
  await rpc(db, P.admin, "refuser_demande", [id, "Référence introuvable"]);
  assert.deepEqual([(await etat()).demande.statut, (await etat()).demande.motif], ["refusee", "Référence introuvable"]);
  await assert.rejects(rpc(db, P.admin, "accepter_demande", [id]), /Cette demande a déjà été traitée/);
}));

test("Association : acceptée avec d'autres groupes, 5 au plus ; refusée pour une autre offre", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.admin, "accepter_demande", [await demander(), [G.autre]]),
    /Seule l'offre Association couvre plusieurs groupes/);
  await db.exec(`update demandes_abonnement set statut = 'annulee'`);
  await rpc(db, P.admin, "accepter_demande", [await demander(P.tres, "association", 1, "mtn_momo", "MP2", G.tontine, "et la cotisation"), [G.autre]]);
  assert.equal((await etat(P.xavier, G.autre)).offre, "association");
  const autres = [];
  for (let i = 0; i < 5; i++) {
    const [{ id }] = await q(`insert into groups(name, amount) values ($1, 1000) returning id`, [`G${i}`]);
    autres.push(id);
  }
  await assert.rejects(rpc(db, P.admin, "creer_association", [autres.concat([G.tontine]), 12]), /Choisissez de 1 à 5 groupes/);
  await rpc(db, P.admin, "creer_association", [autres, 12]);
}));

test("Pilote : fin de la journée choisie, heure de Douala ; date passée refusée", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.admin, "attribuer_pilote", [G.tontine, "2020-01-01"]), /La date de fin doit être dans le futur/);
  const fin = await rpc(db, P.admin, "attribuer_pilote", [G.tontine, "2099-01-31"]);
  assert.equal(new Date(fin).toISOString(), "2099-01-31T23:00:00.000Z");
  assert.equal((await etat()).offre, "pilote");
}));

test("prix de lancement : moitié prix, arrondi à l'unité supérieure, 50 groupes au plus", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.admin, "changer_prix_lancement", [G.tontine, true]);
  await demander(P.tres, "diaspora", 1);
  assert.deepEqual([(await etat()).demande.montant, (await etat()).demande.devise], [3, "EUR"]);
  await db.exec(`update groups set prix_lancement = true where id = '${G.autre}';
    insert into groups(name, amount, prix_lancement) select 'L' || i, 1000, true from generate_series(1, 48) i`);
  const [{ id }] = await q(`insert into groups(name, amount) values ('Le 51e', 1000) returning id`);
  await assert.rejects(rpc(db, P.admin, "changer_prix_lancement", [id, true]), /Les 50 prix de lancement sont déjà attribués/);
  await rpc(db, P.admin, "changer_prix_lancement", [G.tontine, false]);
  await rpc(db, P.admin, "changer_prix_lancement", [id, true]);
}));

test("administration : demandes en attente, groupes avec leur offre, numéros de paiement", () => scenario(db, async () => {
  await seedPilot(db);
  await demander();
  await rpc(db, P.admin, "regler_paiement", ["677000001", " ", "Olivier A."]);
  const v = await rpc(db, P.admin, "admin_abonnements", []);
  assert.equal(v.demandes.length, 1);
  assert.equal(v.demandes[0].groupe, "Tontine des amis");
  assert.equal(v.demandes[0].demandeur, "Tina");
  assert.deepEqual(v.groupes.map((g) => [g.nom, g.offre, g.membres, g.limite]),
    [["Cotisation quartier", "essai", 1, 50], ["Tontine des amis", "essai", 4, 50]]);
  assert.deepEqual(v.paiement, { mtn: "677000001", orange: null, beneficiaire: "Olivier A." });
  assert.deepEqual((await etat()).paiement, v.paiement);
  await assert.rejects(rpc(db, P.tres, "regler_paiement", ["1", "2", "3"]), /Réservé aux administrateurs de la plateforme/);
}));
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\db && node --test tests/demandes.test.mjs`
Expected: FAIL (`function demander_abonnement(…) does not exist`).

- [ ] **Step 3: Écrire `supabase/migrations/0010_demandes_abonnement.sql`**

```sql
-- =====================================================================
-- Njangi237 v2 : demandes d'abonnement, prix et administration (lot 7)
-- Le trésorier paie sur un numéro marchand puis déclare ; l'administrateur accepte ou refuse.
-- =====================================================================

create table demandes_abonnement (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  offre       text not null check (offre in ('groupe', 'association', 'diaspora')),
  duree_mois  int not null check (duree_mois in (1, 12)),
  montant     int not null check (montant > 0),
  devise      text not null check (devise in ('XAF', 'EUR')),
  moyen       pay_method not null,
  reference   text,
  precisions  text,
  statut      text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee', 'annulee')),
  motif       text,
  demande_par uuid references people(id),
  traitee_par uuid references people(id),
  created_at  timestamptz not null default now(),
  traitee_le  timestamptz,
  check (moyen not in ('mtn_momo', 'orange_money') or length(btrim(coalesce(reference, ''))) > 0)
);
create unique index demandes_une_en_attente on demandes_abonnement(group_id) where statut = 'en_attente';
alter table demandes_abonnement enable row level security;
revoke all on demandes_abonnement from anon, authenticated;

-- Prix de lancement : moitié prix arrondi à l'unité supérieure
create or replace function prix_offre(p_offre text, p_duree int, p_lancement boolean)
returns table (montant int, devise text)
language sql immutable set search_path = public as $$
  select ceil(t.base * case when coalesce(p_lancement, false) then 0.5 else 1 end)::int, t.dev
    from (values ('groupe', 1, 2000, 'XAF'), ('groupe', 12, 20000, 'XAF'),
                 ('association', 1, 7500, 'XAF'), ('association', 12, 75000, 'XAF'),
                 ('diaspora', 1, 5, 'EUR'), ('diaspora', 12, 50, 'EUR')) as t(offre, duree, base, dev)
   where t.offre = p_offre and t.duree = p_duree
$$;

create or replace function exiger_admin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'Réservé aux administrateurs de la plateforme' using errcode = '42501';
  end if;
end $$;

-- Allonge l'abonnement en cours de même offre du premier groupe, sinon en crée un ; rattache les groupes donnés
create or replace function prolonger_abonnement(p_groupes uuid[], p_offre text, p_duree int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_a abonnements%rowtype; v_g uuid; v_n int;
begin
  if exists (select 1 from unnest(p_groupes) x where not exists (select 1 from groups g where g.id = x)) then
    raise exception 'Groupe introuvable' using errcode = 'P0002';
  end if;
  select a.* into v_a from abonnements a join abonnements_groupes ag on ag.abonnement_id = a.id
   where ag.group_id = p_groupes[1] and a.offre = p_offre and a.debut <= now() and now() < a.fin
   order by a.fin desc limit 1;
  if found then
    update abonnements set fin = fin + make_interval(months => p_duree) where id = v_a.id returning * into v_a;
  else
    insert into abonnements(offre, debut, fin, cree_par)
    values (p_offre, now(), now() + make_interval(months => p_duree), auth.uid()) returning * into v_a;
  end if;
  foreach v_g in array p_groupes loop
    insert into abonnements_groupes(abonnement_id, group_id) values (v_a.id, v_g) on conflict do nothing;
  end loop;
  select count(*) into v_n from abonnements_groupes where abonnement_id = v_a.id;
  if v_n > case when p_offre = 'association' then 5 else 1 end then
    raise exception 'Une offre Association couvre au plus 5 groupes' using errcode = 'P0001';
  end if;
  return v_a.fin;
end $$;

create or replace function demander_abonnement(p_group uuid, p_offre text, p_duree int, p_moyen pay_method,
                                               p_reference text default null, p_precisions text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_p record; v_id uuid;
begin
  perform exiger_tresorier(p_group);
  if p_offre is null or p_offre not in ('groupe', 'association', 'diaspora') then
    raise exception 'Offre inconnue' using errcode = '22023';
  end if;
  if p_duree is null or p_duree not in (1, 12) then raise exception 'Durée invalide : 1 ou 12 mois' using errcode = '22023'; end if;
  if p_moyen in ('mtn_momo', 'orange_money') and length(btrim(coalesce(p_reference, ''))) = 0 then
    raise exception 'Référence de transaction obligatoire pour MoMo et Orange Money' using errcode = '22023';
  end if;
  if exists (select 1 from demandes_abonnement where group_id = p_group and statut = 'en_attente') then
    raise exception 'Une demande est déjà en attente pour ce groupe' using errcode = 'P0001';
  end if;
  select * into v_p from prix_offre(p_offre, p_duree, (select prix_lancement from groups where id = p_group));
  insert into demandes_abonnement(group_id, offre, duree_mois, montant, devise, moyen, reference, precisions, demande_par)
  values (p_group, p_offre, p_duree, v_p.montant, v_p.devise, p_moyen, nullif(btrim(p_reference), ''),
          nullif(btrim(p_precisions), ''), auth.uid())
  returning id into v_id;
  perform journaliser(p_group, 'abonnement_demande',
    jsonb_build_object('offre', p_offre, 'duree', p_duree, 'montant', v_p.montant, 'devise', v_p.devise), false);
  return v_id;
end $$;

create or replace function annuler_demande(p_demande uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_d demandes_abonnement%rowtype;
begin
  select * into v_d from demandes_abonnement where id = p_demande for update;
  if not found then raise exception 'Demande introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_d.group_id);
  if v_d.statut <> 'en_attente' then raise exception 'Cette demande a déjà été traitée' using errcode = 'P0001'; end if;
  update demandes_abonnement set statut = 'annulee', traitee_le = now() where id = p_demande;
  perform journaliser(v_d.group_id, 'abonnement_annule', jsonb_build_object('offre', v_d.offre), false);
end $$;

create or replace function accepter_demande(p_demande uuid, p_autres uuid[] default '{}') returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_d demandes_abonnement%rowtype; v_fin timestamptz;
begin
  perform exiger_admin();
  select * into v_d from demandes_abonnement where id = p_demande for update;
  if not found then raise exception 'Demande introuvable' using errcode = 'P0002'; end if;
  if v_d.statut <> 'en_attente' then raise exception 'Cette demande a déjà été traitée' using errcode = 'P0001'; end if;
  if v_d.offre <> 'association' and coalesce(cardinality(p_autres), 0) > 0 then
    raise exception 'Seule l''offre Association couvre plusieurs groupes' using errcode = '22023';
  end if;
  v_fin := prolonger_abonnement(array[v_d.group_id] || coalesce(p_autres, '{}'), v_d.offre, v_d.duree_mois);
  update demandes_abonnement set statut = 'acceptee', traitee_par = auth.uid(), traitee_le = now() where id = p_demande;
  perform journaliser(v_d.group_id, 'abonnement_accepte', jsonb_build_object('offre', v_d.offre, 'fin', v_fin), false);
  return v_fin;
end $$;

create or replace function refuser_demande(p_demande uuid, p_motif text) returns void
language plpgsql security definer set search_path = public as $$
declare v_d demandes_abonnement%rowtype;
begin
  perform exiger_admin();
  if length(btrim(coalesce(p_motif, ''))) = 0 then raise exception 'Motif obligatoire' using errcode = '22023'; end if;
  select * into v_d from demandes_abonnement where id = p_demande for update;
  if not found then raise exception 'Demande introuvable' using errcode = 'P0002'; end if;
  if v_d.statut <> 'en_attente' then raise exception 'Cette demande a déjà été traitée' using errcode = 'P0001'; end if;
  update demandes_abonnement set statut = 'refusee', motif = btrim(p_motif), traitee_par = auth.uid(), traitee_le = now()
   where id = p_demande;
  perform journaliser(v_d.group_id, 'abonnement_refuse', jsonb_build_object('offre', v_d.offre, 'motif', btrim(p_motif)), false);
end $$;

-- Fin = lendemain 00:00 à Douala (la journée choisie est incluse)
create or replace function attribuer_pilote(p_group uuid, p_fin date) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_fin timestamptz := ((p_fin + 1)::timestamp at time zone 'Africa/Douala'); v_a uuid;
begin
  perform exiger_admin();
  if not exists (select 1 from groups where id = p_group) then raise exception 'Groupe introuvable' using errcode = 'P0002'; end if;
  if p_fin is null or v_fin <= now() then raise exception 'La date de fin doit être dans le futur' using errcode = '22023'; end if;
  select a.id into v_a from abonnements a join abonnements_groupes ag on ag.abonnement_id = a.id
   where ag.group_id = p_group and a.offre = 'pilote' and a.debut <= now() and now() < a.fin limit 1;
  if found then
    update abonnements set fin = v_fin where id = v_a;
  else
    insert into abonnements(offre, fin, cree_par) values ('pilote', v_fin, auth.uid()) returning id into v_a;
    insert into abonnements_groupes(abonnement_id, group_id) values (v_a, p_group);
  end if;
  perform journaliser(p_group, 'pilote_attribue', jsonb_build_object('fin', v_fin), false);
  return v_fin;
end $$;

create or replace function creer_association(p_groupes uuid[], p_duree int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_a uuid; v_g uuid; v_fin timestamptz;
begin
  perform exiger_admin();
  if coalesce(cardinality(p_groupes), 0) not between 1 and 5 then raise exception 'Choisissez de 1 à 5 groupes' using errcode = '22023'; end if;
  if p_duree is null or p_duree not in (1, 12) then raise exception 'Durée invalide : 1 ou 12 mois' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_groupes) x where not exists (select 1 from groups g where g.id = x)) then
    raise exception 'Groupe introuvable' using errcode = 'P0002';
  end if;
  insert into abonnements(offre, debut, fin, cree_par) values ('association', now(), now() + make_interval(months => p_duree), auth.uid())
  returning id, fin into v_a, v_fin;
  foreach v_g in array p_groupes loop
    insert into abonnements_groupes(abonnement_id, group_id) values (v_a, v_g) on conflict do nothing;
    perform journaliser(v_g, 'abonnement_accepte', jsonb_build_object('offre', 'association', 'fin', v_fin), false);
  end loop;
  return v_fin;
end $$;

create or replace function changer_prix_lancement(p_group uuid, p_actif boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  if not exists (select 1 from groups where id = p_group) then raise exception 'Groupe introuvable' using errcode = 'P0002'; end if;
  if p_actif and not (select prix_lancement from groups where id = p_group)
     and (select count(*) from groups where prix_lancement) >= 50 then
    raise exception 'Les 50 prix de lancement sont déjà attribués' using errcode = 'P0001';
  end if;
  update groups set prix_lancement = coalesce(p_actif, false) where id = p_group;
end $$;

create or replace function regler_paiement(p_mtn text, p_orange text, p_beneficiaire text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  insert into parametres_plateforme(cle, valeur) values
    ('mtn', nullif(btrim(p_mtn), '')), ('orange', nullif(btrim(p_orange), '')), ('beneficiaire', nullif(btrim(p_beneficiaire), ''))
  on conflict (cle) do update set valeur = excluded.valeur;
end $$;

create or replace function paiement_plateforme() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mtn', (select valeur from parametres_plateforme where cle = 'mtn'),
    'orange', (select valeur from parametres_plateforme where cle = 'orange'),
    'beneficiaire', (select valeur from parametres_plateforme where cle = 'beneficiaire'))
$$;

create or replace function mon_abonnement(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_o record; v_n int;
begin
  perform exiger_tresorier(p_group);
  select * into v_o from offre_en_vigueur(p_group);
  select count(*) into v_n from memberships where group_id = p_group and status <> 'retire';
  return jsonb_build_object(
    'offre', v_o.offre, 'limite', v_o.limite, 'fin', v_o.fin, 'membres', v_n,
    'prix_lancement', (select prix_lancement from groups where id = p_group),
    'demande', (select jsonb_build_object('id', d.id, 'offre', d.offre, 'duree_mois', d.duree_mois, 'montant', d.montant,
                  'devise', d.devise, 'moyen', d.moyen, 'reference', d.reference, 'precisions', d.precisions, 'statut', d.statut,
                  'motif', d.motif, 'created_at', d.created_at, 'traitee_le', d.traitee_le)
                  from demandes_abonnement d where d.group_id = p_group order by d.created_at desc limit 1),
    'historique', coalesce((select jsonb_agg(jsonb_build_object('offre', a.offre, 'debut', a.debut, 'fin', a.fin) order by a.debut desc)
                  from abonnements a join abonnements_groupes ag on ag.abonnement_id = a.id where ag.group_id = p_group), '[]'::jsonb),
    'paiement', paiement_plateforme());
end $$;

create or replace function admin_abonnements() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exiger_admin();
  return jsonb_build_object(
    'demandes', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'group_id', d.group_id, 'groupe', g.name,
                  'demandeur', p.full_name, 'offre', d.offre, 'duree_mois', d.duree_mois, 'montant', d.montant, 'devise', d.devise,
                  'moyen', d.moyen, 'reference', d.reference, 'precisions', d.precisions, 'statut', d.statut, 'motif', d.motif,
                  'created_at', d.created_at, 'traitee_le', d.traitee_le) order by d.created_at)
                  from demandes_abonnement d join groups g on g.id = d.group_id left join people p on p.id = d.demande_par
                 where d.statut = 'en_attente'), '[]'::jsonb),
    'groupes', coalesce((select jsonb_agg(jsonb_build_object('group_id', g.id, 'nom', g.name, 'offre', o.offre, 'fin', o.fin,
                  'limite', o.limite, 'prix_lancement', g.prix_lancement,
                  'membres', (select count(*) from memberships m where m.group_id = g.id and m.status <> 'retire')) order by g.name)
                  from groups g cross join lateral offre_en_vigueur(g.id) o), '[]'::jsonb),
    'lancements', (select count(*) from groups where prix_lancement),
    'paiement', paiement_plateforme());
end $$;

revoke execute on function prix_offre(text, int, boolean), exiger_admin(), prolonger_abonnement(uuid[], text, int),
                           paiement_plateforme()
  from public, anon, authenticated;
revoke execute on function demander_abonnement(uuid, text, int, pay_method, text, text), annuler_demande(uuid),
                           accepter_demande(uuid, uuid[]), refuser_demande(uuid, text), attribuer_pilote(uuid, date),
                           creer_association(uuid[], int), changer_prix_lancement(uuid, boolean), regler_paiement(text, text, text),
                           mon_abonnement(uuid), admin_abonnements()
  from public, anon;
grant execute on function demander_abonnement(uuid, text, int, pay_method, text, text), annuler_demande(uuid),
                          accepter_demande(uuid, uuid[]), refuser_demande(uuid, text), attribuer_pilote(uuid, date),
                          creer_association(uuid[], int), changer_prix_lancement(uuid, boolean), regler_paiement(text, text, text),
                          mon_abonnement(uuid), admin_abonnements()
  to authenticated;
```

- [ ] **Step 4: Compléter la liste blanche** — dans `db/tests/privileges.test.mjs`, remplacer `ALLOWED` par :

```js
export const ALLOWED = [
  "accepter_demande", "admin_abonnements", "ajouter_membre", "annuler_demande", "apercu_retrait", "attribuer_pilote",
  "changer_prix_lancement", "changer_role", "clore_cycle", "contester_paiement", "creer_association", "creer_groupe",
  "declarer_paiement", "demander_abonnement", "echanger_tours", "enregistrer_remise", "inviter", "is_member",
  "is_platform_admin", "is_treasurer", "lire_journal", "mon_abonnement", "nouveau_tour", "ordonner_tours", "ordre_tours",
  "ouvrir_cycle", "recouvrement", "refuser_demande", "regler_paiement", "remplacer_beneficiaire", "retirer_membre",
  "rouvrir_cycle", "saisir_especes", "tirer_au_sort", "valider_paiement",
];
```

- [ ] **Step 5: Lancer les tests**

Run: `cd D:\njangi237\db && node --test tests/demandes.test.mjs && npm test`
Expected: PASS (9 tests du lot ; toute la suite passe, liste blanche comprise).

- [ ] **Step 6: Commit**

```bash
cd D:\njangi237 && git add supabase/migrations/0010_demandes_abonnement.sql db/tests/demandes.test.mjs db/tests/privileges.test.mjs && git commit -m "Lot 7 : demandes d'abonnement, prix, administration et lectures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Contrat, logique pure et implémentations (application)

**Files:**
- Create: `app/src/lib/abonnement.ts`, `app/src/lib/abonnement.test.ts`
- Modify: `app/src/lib/types.ts`, `app/src/lib/supabaseApi.ts`, `app/src/lib/demo/demoApi.ts`, `app/src/lib/journal.ts`, `app/src/lib/journal.test.ts`, `app/src/lib/routes.ts`, `app/src/lib/routes.test.ts`, `app/src/test/fauxApi.ts`, `app/src/test/donnees.ts`

**Interfaces:**
- Consumes: fonctions SQL de la Task 2.
- Produces (`types.ts`) :

```ts
export type Offre = "decouverte" | "essai" | "groupe" | "association" | "diaspora" | "pilote";
export type OffrePayante = "groupe" | "association" | "diaspora";
export type Devise = "XAF" | "EUR";
export interface DemandeAbonnement {
  id: string; offre: OffrePayante; duree_mois: 1 | 12; montant: number; devise: Devise; moyen: MoyenPaiement;
  reference: string | null; precisions: string | null; statut: "en_attente" | "acceptee" | "refusee" | "annulee";
  motif: string | null; created_at: string; traitee_le: string | null;
}
export interface PaiementPlateforme { mtn: string | null; orange: string | null; beneficiaire: string | null }
export interface EtatAbonnement {
  offre: Offre; limite: number; fin: string | null; membres: number; prix_lancement: boolean;
  demande: DemandeAbonnement | null; historique: { offre: Offre; debut: string; fin: string }[];
  paiement: PaiementPlateforme; demo?: boolean;
}
export interface NouvelleDemande {
  groupId: string; offre: OffrePayante; dureeMois: 1 | 12; moyen: MoyenPaiement; reference: string | null; precisions: string | null;
}
export interface DemandeAdmin extends DemandeAbonnement { group_id: string; groupe: string; demandeur: string | null }
export interface GroupeAdmin { group_id: string; nom: string; offre: Offre; fin: string | null; limite: number; membres: number; prix_lancement: boolean }
export interface VueAdminAbonnements { demandes: DemandeAdmin[]; groupes: GroupeAdmin[]; lancements: number; paiement: PaiementPlateforme }
```

  Méthodes ajoutées à `Api` : `etatAbonnement(groupId)`, `demanderAbonnement(d: NouvelleDemande)`, `annulerDemande(demandeId)`, `adminAbonnements()`, `accepterDemande(demandeId, autres?: string[])`, `refuserDemande(demandeId, motif)`, `attribuerPilote(groupId, fin: string /* AAAA-MM-JJ */)`, `creerAssociation(groupIds: string[], dureeMois: 1 | 12)`, `changerPrixLancement(groupId, actif: boolean)`, `reglerPaiement(mtn, orange, beneficiaire)` — toutes `Promise<void>` sauf `etatAbonnement` → `Promise<EtatAbonnement>` et `adminAbonnements` → `Promise<VueAdminAbonnements>`.
- Produces (`abonnement.ts`) : `LIBELLE_OFFRE`, `LIBELLE_MOYEN`, `TARIFS`, `prix(offre, duree, lancement) → { montant, devise }`, `montantTexte(montant, devise)`, `finAffichee(fin) → "JJ/MM/AAAA"` (dernier jour inclus, heure de Douala), `joursRestants(fin, maintenant?)`, `alerteAbonnement(e, maintenant?) → { niveau: "bloque" | "bientot"; texte } | null`.
- Produces (tests) : `etatAbonnementTest()`, `adminAbonnementsTest()` dans `test/donnees.ts` ; la fausse Api les renvoie.

- [ ] **Step 1: Écrire les tests qui échouent — `app/src/lib/abonnement.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { alerteAbonnement, finAffichee, joursRestants, montantTexte, prix } from "./abonnement";
import { etatAbonnementTest } from "../test/donnees";

const MAINTENANT = new Date("2026-10-18T10:00:00Z");

describe("abonnement", () => {
  it("prix : comme en base, moitié prix arrondie à l'unité supérieure", () => {
    expect(prix("groupe", 1, false)).toEqual({ montant: 2000, devise: "XAF" });
    expect(prix("association", 12, true)).toEqual({ montant: 37500, devise: "XAF" });
    expect(prix("diaspora", 1, true)).toEqual({ montant: 3, devise: "EUR" });
    expect(montantTexte(3, "EUR")).toBe("3 €");
    expect(montantTexte(20000, "XAF")).toBe("20 000 FCFA");
  });
  it("date de fin affichée : le dernier jour inclus, à Douala", () => {
    expect(finAffichee("2027-01-31T23:00:00Z")).toBe("31/01/2027");      // fin = 1er février 00:00 à Douala
    expect(finAffichee("2026-11-18T10:00:00Z")).toBe("18/11/2026");
  });
  it("jours restants, arrondis au jour supérieur ; aucun sans date de fin", () => {
    expect(joursRestants("2026-10-20T09:00:00Z", MAINTENANT)).toBe(2);
    expect(joursRestants(null, MAINTENANT)).toBeNull();
  });
  it("alerte : bloqué au-dessus de la limite, limite atteinte en Découverte, fin proche, sinon rien", () => {
    const e = etatAbonnementTest();
    expect(alerteAbonnement({ ...e, offre: "decouverte", limite: 10, fin: null, membres: 12 }, MAINTENANT)).toEqual({ niveau: "bloque",
      texte: "Votre groupe compte 12 membres, l'offre Découverte en permet 10 : pas de nouveau cycle ni de nouveau membre. Choisissez une offre." });
    expect(alerteAbonnement({ ...e, offre: "decouverte", limite: 10, fin: null, membres: 10 }, MAINTENANT)?.texte)
      .toBe("Limite de l'offre Découverte atteinte (10 membres) : passez à l'offre Groupe pour en ajouter.");
    expect(alerteAbonnement({ ...e, offre: "essai", fin: "2026-10-21T10:00:00Z" }, MAINTENANT))
      .toEqual({ niveau: "bientot", texte: "Essai gratuit : plus que 3 jours. Choisissez une offre pour continuer sans limite." });
    expect(alerteAbonnement({ ...e, offre: "groupe", fin: "2026-12-30T00:00:00Z" }, MAINTENANT)).toBeNull();
  });
});
```

Ajouter à `app/src/lib/journal.test.ts`, dans le `describe` existant :

```ts
  it("abonnements : demande, acceptation, refus, Pilote", () => {
    const e = (action: string, details: Record<string, unknown>) => ({ id: 1, action, details, created_at: "2026-10-18T10:00:00Z", auteur: "Tina", visible: false });
    expect(libelleJournal(e("abonnement_demande", { offre: "groupe", duree: 12, montant: 20000, devise: "XAF" })))
      .toBe("Demande d'abonnement Groupe (12 mois, 20 000 FCFA)");
    expect(libelleJournal(e("abonnement_accepte", { offre: "groupe", fin: "2027-10-18T10:00:00Z" }))).toBe("Abonnement Groupe activé jusqu'au 18/10/2027");
    expect(libelleJournal(e("abonnement_refuse", { offre: "groupe", motif: "Référence introuvable" }))).toBe("Demande d'abonnement refusée : Référence introuvable");
    expect(libelleJournal(e("abonnement_annule", { offre: "groupe" }))).toBe("Demande d'abonnement annulée");
    expect(libelleJournal(e("pilote_attribue", { fin: "2027-01-31T23:00:00Z" }))).toBe("Offre Pilote jusqu'au 31/01/2027");
  });
```

Ajouter à `app/src/lib/routes.test.ts`, dans le `describe` existant :

```ts
  it("onglet Abonnement", () => {
    expect(lireRoute("#/groupe/abc-123/abonnement")).toEqual({ nom: "groupe", id: "abc-123", onglet: "abonnement" });
  });
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/lib/abonnement.test.ts src/lib/journal.test.ts src/lib/routes.test.ts`
Expected: FAIL (`./abonnement` introuvable, `etatAbonnementTest` introuvable, libellés et onglet absents).

- [ ] **Step 3: Types** — dans `app/src/lib/types.ts`, ajouter les types de l'encadré **Interfaces** avant `export interface Api`, et à la fin de l'interface `Api` :

```ts
  // Abonnements (lot 7)
  /** Trésorier du groupe : offre en vigueur, limite, demande en cours, historique et numéros de paiement. */
  etatAbonnement(groupId: string): Promise<EtatAbonnement>;
  demanderAbonnement(d: NouvelleDemande): Promise<void>;
  annulerDemande(demandeId: string): Promise<void>;
  /** Administrateur de la plateforme. */
  adminAbonnements(): Promise<VueAdminAbonnements>;
  /** `autres` : groupes supplémentaires d'une offre Association (4 au plus). */
  accepterDemande(demandeId: string, autres?: string[]): Promise<void>;
  refuserDemande(demandeId: string, motif: string): Promise<void>;
  /** `fin` : dernier jour inclus, AAAA-MM-JJ. */
  attribuerPilote(groupId: string, fin: string): Promise<void>;
  creerAssociation(groupIds: string[], dureeMois: 1 | 12): Promise<void>;
  changerPrixLancement(groupId: string, actif: boolean): Promise<void>;
  reglerPaiement(mtn: string, orange: string, beneficiaire: string): Promise<void>;
```

- [ ] **Step 4: Écrire `app/src/lib/abonnement.ts`**

```ts
import { fcfa } from "./format";
import type { Devise, EtatAbonnement, MoyenPaiement, Offre, OffrePayante } from "./types";

export const LIBELLE_OFFRE: Record<Offre, string> = {
  decouverte: "Découverte", essai: "Essai gratuit", groupe: "Groupe", association: "Association", diaspora: "Diaspora", pilote: "Pilote",
};
export const LIBELLE_MOYEN: Record<MoyenPaiement, string> = { mtn_momo: "MTN MoMo", orange_money: "Orange Money", especes: "Espèces", autre: "Autre" };

/** Mêmes montants que `prix_offre` en base. */
export const TARIFS: { offre: OffrePayante; nom: string; pourQui: string; mois: number; an: number; devise: Devise }[] = [
  { offre: "groupe", nom: "Groupe", pourQui: "jusqu'à 50 membres", mois: 2000, an: 20000, devise: "XAF" },
  { offre: "association", nom: "Association", pourQui: "jusqu'à 5 groupes de 50 membres", mois: 7500, an: 75000, devise: "XAF" },
  { offre: "diaspora", nom: "Diaspora", pourQui: "jusqu'à 50 membres, payé en euros", mois: 5, an: 50, devise: "EUR" },
];

export function prix(offre: OffrePayante, duree: 1 | 12, lancement: boolean): { montant: number; devise: Devise } {
  const t = TARIFS.find((x) => x.offre === offre)!;
  const base = duree === 12 ? t.an : t.mois;
  return { montant: Math.ceil(lancement ? base / 2 : base), devise: t.devise };
}

export const montantTexte = (montant: number, devise: Devise) => (devise === "EUR" ? `${montant} €` : fcfa(montant));

/** Une fin est exclusive (ex. 1er février 00:00) : on affiche le dernier jour inclus, à l'heure de Douala. */
export const finAffichee = (fin: string) =>
  new Date(new Date(fin).getTime() - 1).toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" });

export function joursRestants(fin: string | null, maintenant = new Date()): number | null {
  if (!fin) return null;
  return Math.ceil((new Date(fin).getTime() - maintenant.getTime()) / 86_400_000);
}

/** Message pour le trésorier : blocage (mêmes règles que la base) ou fin proche (7 jours). */
export function alerteAbonnement(e: EtatAbonnement, maintenant = new Date()): { niveau: "bloque" | "bientot"; texte: string } | null {
  const nom = LIBELLE_OFFRE[e.offre];
  if (e.membres > e.limite)
    return { niveau: "bloque", texte: `Votre groupe compte ${e.membres} membres, l'offre ${nom} en permet ${e.limite} : pas de nouveau cycle ni de nouveau membre. Choisissez une offre.` };
  if (e.offre === "decouverte" && e.membres >= e.limite)
    return { niveau: "bloque", texte: `Limite de l'offre ${nom} atteinte (${e.limite} membres) : passez à l'offre Groupe pour en ajouter.` };
  const j = joursRestants(e.fin, maintenant);
  if (j !== null && j >= 0 && j <= 7)
    return { niveau: "bientot", texte: `${nom} : plus que ${j} jour${j > 1 ? "s" : ""}. Choisissez une offre pour continuer sans limite.` };
  return null;
}
```

- [ ] **Step 5: Libellés du journal et onglet**

Dans `app/src/lib/journal.ts`, ajouter l'import `import { finAffichee, LIBELLE_OFFRE, montantTexte } from "./abonnement";` et `import type { Devise, Offre } from "./types";`, puis, avant `default:` :

```ts
    case "abonnement_demande": return `Demande d'abonnement ${LIBELLE_OFFRE[s("offre") as Offre] ?? s("offre")} (${n("duree")} mois, ${montantTexte(n("montant"), s("devise") as Devise)})`;
    case "abonnement_accepte": return `Abonnement ${LIBELLE_OFFRE[s("offre") as Offre] ?? s("offre")} activé jusqu'au ${finAffichee(s("fin"))}`;
    case "abonnement_refuse": return `Demande d'abonnement refusée : ${s("motif")}`;
    case "abonnement_annule": return "Demande d'abonnement annulée";
    case "pilote_attribue": return `Offre Pilote jusqu'au ${finAffichee(s("fin"))}`;
```

(Une fin est exclusive : `finAffichee` montre le dernier jour inclus, « 31/01/2027 » pour le Pilote.)

Dans `app/src/lib/routes.ts` : `export type OngletGroupe = "cycle" | "membres" | "tours" | "journal" | "abonnement";` et `const ONGLETS: OngletGroupe[] = ["membres", "tours", "journal", "abonnement"];`.

- [ ] **Step 6: Données de test et fausse Api**

Ajouter à la fin de `app/src/test/donnees.ts` (et `EtatAbonnement, VueAdminAbonnements` à l'import des types) :

```ts
/** Tontine des amis en essai, 4 membres sur 50, sans demande. */
export function etatAbonnementTest(): EtatAbonnement {
  return { offre: "essai", limite: 50, fin: "2026-11-10T10:00:00Z", membres: 4, prix_lancement: false, demande: null, historique: [],
    paiement: { mtn: "677000001", orange: "699000001", beneficiaire: "Olivier A." } };
}

/** Une demande en attente (Tontine des amis, offre Groupe 1 mois) et deux groupes. */
export function adminAbonnementsTest(): VueAdminAbonnements {
  return {
    demandes: [{ id: "d1", group_id: "g1", groupe: "Tontine des amis", demandeur: "Tina", offre: "groupe", duree_mois: 1, montant: 2000,
      devise: "XAF", moyen: "mtn_momo", reference: "MP77", precisions: null, statut: "en_attente", motif: null,
      created_at: "2026-10-18T09:00:00Z", traitee_le: null }],
    groupes: [
      { group_id: "g1", nom: "Tontine des amis", offre: "essai", fin: "2026-11-10T10:00:00Z", limite: 50, membres: 4, prix_lancement: false },
      { group_id: "g2", nom: "LE BON WEEKEND", offre: "pilote", fin: "2027-01-31T23:00:00Z", limite: 50, membres: 14, prix_lancement: true },
    ],
    lancements: 1, paiement: { mtn: "677000001", orange: null, beneficiaire: "Olivier A." },
  };
}
```

Dans `app/src/test/fauxApi.ts`, importer `adminAbonnementsTest, etatAbonnementTest` et ajouter dans l'objet :

```ts
    etatAbonnement: vi.fn(async () => etatAbonnementTest()),
    demanderAbonnement: vi.fn(async () => {}), annulerDemande: vi.fn(async () => {}),
    adminAbonnements: vi.fn(async () => adminAbonnementsTest()),
    accepterDemande: vi.fn(async () => {}), refuserDemande: vi.fn(async () => {}), attribuerPilote: vi.fn(async () => {}),
    creerAssociation: vi.fn(async () => {}), changerPrixLancement: vi.fn(async () => {}), reglerPaiement: vi.fn(async () => {}),
```

- [ ] **Step 7: Implémentation Supabase** — dans `app/src/lib/supabaseApi.ts`, ajouter à l'objet `api` (et les types à l'import) :

```ts
    etatAbonnement: async (groupId) => must(await sb.rpc("mon_abonnement", { p_group: groupId })) as EtatAbonnement,
    async demanderAbonnement(d) {
      must(await sb.rpc("demander_abonnement", { p_group: d.groupId, p_offre: d.offre, p_duree: d.dureeMois, p_moyen: d.moyen,
        p_reference: d.reference, p_precisions: d.precisions }));
    },
    async annulerDemande(id) { must(await sb.rpc("annuler_demande", { p_demande: id })); },
    adminAbonnements: async () => must(await sb.rpc("admin_abonnements")) as VueAdminAbonnements,
    async accepterDemande(id, autres) { must(await sb.rpc("accepter_demande", { p_demande: id, p_autres: autres ?? [] })); },
    async refuserDemande(id, motif) { must(await sb.rpc("refuser_demande", { p_demande: id, p_motif: motif })); },
    async attribuerPilote(groupId, fin) { must(await sb.rpc("attribuer_pilote", { p_group: groupId, p_fin: fin })); },
    async creerAssociation(groupIds, dureeMois) { must(await sb.rpc("creer_association", { p_groupes: groupIds, p_duree: dureeMois })); },
    async changerPrixLancement(groupId, actif) { must(await sb.rpc("changer_prix_lancement", { p_group: groupId, p_actif: actif })); },
    async reglerPaiement(mtn, orange, beneficiaire) {
      must(await sb.rpc("regler_paiement", { p_mtn: mtn, p_orange: orange, p_beneficiaire: beneficiaire }));
    },
```

- [ ] **Step 8: Démo** — dans `app/src/lib/demo/demoApi.ts`, importer `comptes` depuis `./etat` et ajouter à l'objet renvoyé :

```ts
    // Abonnements : la démo n'est pas bridée ; l'onglet est en lecture seule
    etatAbonnement: (groupId) => voir((e) => ({ offre: "groupe" as const, limite: 50, fin: null, membres: comptes(e, groupId).length,
      prix_lancement: false, demande: null, historique: [], paiement: { mtn: null, orange: null, beneficiaire: null }, demo: true })),
    demanderAbonnement: indisponible, annulerDemande: indisponible, adminAbonnements: indisponible, accepterDemande: indisponible,
    refuserDemande: indisponible, attribuerPilote: indisponible, creerAssociation: indisponible, changerPrixLancement: indisponible,
    reglerPaiement: indisponible,
```

Ajouter à `app/src/lib/demo/demoApi.test.ts`, dans le `describe` existant :

```ts
  it("abonnement en démo : offre Groupe, sans limite à payer, en lecture seule", async () => {
    const api = createDemoApi(options());
    const g = await tontine(api);
    expect(await api.etatAbonnement(g)).toMatchObject({ offre: "groupe", limite: 50, membres: 12, demo: true });
    await expect(api.demanderAbonnement({ groupId: g, offre: "groupe", dureeMois: 1, moyen: "mtn_momo", reference: "x", precisions: null }))
      .rejects.toThrow(INDISPONIBLE);
  });
```

- [ ] **Step 9: Lancer les tests et la compilation**

Run: `cd D:\njangi237\app && npm test && npx tsc -b`
Expected: PASS (tous les tests, 179 existants + ceux de la tâche) ; `tsc` sans erreur.

- [ ] **Step 10: Commit**

```bash
cd D:\njangi237 && git add app/src/lib app/src/test && git commit -m "Lot 7 : contrat Api des abonnements, tarifs et alertes, implémentations Supabase et démo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Onglet Abonnement et bandeau (trésorier)

**Files:**
- Create: `app/src/ui/groupe/OngletAbonnement.tsx`, `app/src/ui/groupe/OngletAbonnement.test.tsx`
- Modify: `app/src/ui/groupe/Groupe.tsx`, `app/src/ui/groupe/Groupe.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`etatAbonnement`, `demanderAbonnement`, `annulerDemande`, `alerteAbonnement`, `prix`, `TARIFS`, `LIBELLE_OFFRE`, `montantTexte`).
- Produces: `OngletAbonnement({ api, groupId, onChange? })`.

- [ ] **Step 1: Écrire les tests qui échouent — `OngletAbonnement.test.tsx`**

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fauxApi } from "../../test/fauxApi";
import { etatAbonnementTest } from "../../test/donnees";
import { OngletAbonnement } from "./OngletAbonnement";

afterEach(cleanup);

describe("OngletAbonnement", () => {
  it("montre l'offre, la limite, les prix et les numéros de paiement", async () => {
    render(<OngletAbonnement api={fauxApi()} groupId="g1" />);
    expect(await screen.findByText("Offre Essai gratuit")).toBeTruthy();
    expect(screen.getByText("4 membres sur 50")).toBeTruthy();
    expect(screen.getByText("677000001")).toBeTruthy();
    expect(screen.getByText("20 000 FCFA")).toBeTruthy();
  });
  it("envoie une demande ; la référence est obligatoire pour MoMo", async () => {
    const api = fauxApi();
    render(<OngletAbonnement api={api} groupId="g1" />);
    await screen.findByText("Offre Essai gratuit");
    const envoyer = screen.getByRole("button", { name: "Envoyer la demande" }) as HTMLButtonElement;
    expect(envoyer.disabled).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText("Durée"), "12");
    expect(screen.getByText(/Montant à payer/).textContent).toContain("20 000 FCFA");
    await userEvent.type(screen.getByLabelText("Référence de la transaction"), "MP123");
    await userEvent.click(envoyer);
    expect(api.demanderAbonnement).toHaveBeenCalledWith({ groupId: "g1", offre: "groupe", dureeMois: 12, moyen: "mtn_momo", reference: "MP123", precisions: null });
  });
  it("demande en attente : récapitulatif et annulation ; demande refusée : motif affiché", async () => {
    const api = fauxApi();
    const demande = { id: "d1", offre: "groupe" as const, duree_mois: 1 as const, montant: 2000, devise: "XAF" as const, moyen: "mtn_momo" as const,
      reference: "MP77", precisions: null, statut: "en_attente" as const, motif: null, created_at: "2026-10-18T09:00:00Z", traitee_le: null };
    api.etatAbonnement.mockResolvedValueOnce({ ...etatAbonnementTest(), demande });
    render(<OngletAbonnement api={api} groupId="g1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Annuler la demande" }));
    expect(api.annulerDemande).toHaveBeenCalledWith("d1");
    cleanup();
    api.etatAbonnement.mockResolvedValueOnce({ ...etatAbonnementTest(), demande: { ...demande, statut: "refusee", motif: "Référence introuvable" } });
    render(<OngletAbonnement api={api} groupId="g1" />);
    expect(await screen.findByText("Demande précédente refusée : Référence introuvable")).toBeTruthy();
  });
  it("démo : lecture seule, pas de formulaire", async () => {
    const api = fauxApi();
    api.etatAbonnement.mockResolvedValueOnce({ ...etatAbonnementTest(), offre: "groupe", fin: null, demo: true });
    render(<OngletAbonnement api={api} groupId="g1" />);
    expect(await screen.findByText(/Mode démo/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Envoyer la demande" })).toBeNull();
  });
});
```

Ajouter à `app/src/ui/groupe/Groupe.test.tsx`, dans le `describe` existant (adapter le rendu au helper du fichier s'il en a un ; sinon reprendre ses imports `render`, `screen`, `fauxApi`, `stockageMemoire`) :

```tsx
  it("bandeau de blocage visible sur l'onglet Cycle, avec un lien vers l'abonnement", async () => {
    const api = fauxApi();
    api.etatAbonnement.mockResolvedValue({ ...etatAbonnementTest(), offre: "decouverte", limite: 10, fin: null, membres: 12 });
    render(<Groupe api={api} id="g1" onglet="cycle" personId="u-tina" stockage={stockageMemoire()} />);
    expect(await screen.findByText(/l'offre Découverte en permet 10/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir l'abonnement" }).getAttribute("href")).toBe("#/groupe/g1/abonnement");
    expect(screen.getByRole("link", { name: "Abonnement" })).toBeTruthy();
  });
```

(et `etatAbonnementTest` à l'import de `../../test/donnees`.)

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/ui/groupe/OngletAbonnement.test.tsx src/ui/groupe/Groupe.test.tsx`
Expected: FAIL (`./OngletAbonnement` introuvable ; bandeau et onglet absents).

- [ ] **Step 3: Écrire `OngletAbonnement.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { alerteAbonnement, finAffichee, LIBELLE_OFFRE, montantTexte, prix, TARIFS } from "../../lib/abonnement";
import { dateCourte } from "../../lib/format";
import type { Api, EtatAbonnement, MoyenPaiement, OffrePayante } from "../../lib/types";
import { Champ } from "../Champ";
import { Barre } from "../Decor";

/** Offre du groupe, limites, tarifs, numéros de paiement et demande d'activation (trésorier). */
export function OngletAbonnement({ api, groupId, onChange }: { api: Api; groupId: string; onChange?: () => void }) {
  const [etat, setEtat] = useState<EtatAbonnement | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [offre, setOffre] = useState<OffrePayante>("groupe"); const [duree, setDuree] = useState<1 | 12>(1);
  const [moyen, setMoyen] = useState<MoyenPaiement>("mtn_momo");
  const [reference, setReference] = useState(""); const [precisions, setPrecisions] = useState("");

  const charger = useCallback(() => {
    api.etatAbonnement(groupId).then((e) => { setEtat(e); setErr(""); }).catch((x) => setErr((x as Error).message));
  }, [api, groupId]);
  useEffect(() => { charger(); }, [charger]);

  const agir = async (f: () => Promise<unknown>) => {
    setBusy(true); setErr("");
    try { await f(); charger(); onChange?.(); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  if (!etat) return err ? <p className="alerte">{err}</p> : <p className="note">Chargement…</p>;
  const alerte = alerteAbonnement(etat);
  const aPayer = prix(offre, duree, etat.prix_lancement);
  const mobile = moyen === "mtn_momo" || moyen === "orange_money";
  const enAttente = etat.demande?.statut === "en_attente" ? etat.demande : null;

  return (
    <section>
      <div className="carte">
        <h3>Offre {LIBELLE_OFFRE[etat.offre]}</h3>
        {etat.fin && <p>Jusqu'au {finAffichee(etat.fin)} inclus</p>}
        {etat.offre === "decouverte" && <p>Gratuite, sans limite de durée.</p>}
        <p className="note">{etat.membres} membre{etat.membres > 1 ? "s" : ""} sur {etat.limite}</p>
        <Barre valeur={(100 * etat.membres) / etat.limite} libelle="Membres par rapport à la limite de l'offre" />
        {alerte && <p className={alerte.niveau === "bloque" ? "alerte" : "note"} role="status">{alerte.texte}</p>}
      </div>

      {etat.demo ? <p className="note">Mode démo : le groupe est en offre Groupe, rien à payer.</p> : <>
        <div className="carte">
          <h3>Les offres</h3>
          {etat.prix_lancement && <p className="pastille declare">Prix de lancement : moitié prix à vie</p>}
          <table className="tableau-offres">
            <thead><tr><th>Offre</th><th>Par mois</th><th>Par an</th></tr></thead>
            <tbody>{TARIFS.map((t) => {
              const m = prix(t.offre, 1, etat.prix_lancement), a = prix(t.offre, 12, etat.prix_lancement);
              return <tr key={t.offre}><td><b>{t.nom}</b><br /><span className="note">{t.pourQui}</span></td>
                <td>{montantTexte(m.montant, m.devise)}</td><td>{montantTexte(a.montant, a.devise)}</td></tr>;
            })}</tbody>
          </table>
          <p className="note">Découverte reste gratuite jusqu'à 10 membres. Les membres ne paient jamais.</p>
        </div>

        <div className="carte">
          <h3>Payer</h3>
          {etat.paiement.mtn || etat.paiement.orange ? <>
            {etat.paiement.mtn && <p>MTN MoMo : <b>{etat.paiement.mtn}</b></p>}
            {etat.paiement.orange && <p>Orange Money : <b>{etat.paiement.orange}</b></p>}
            {etat.paiement.beneficiaire && <p className="note">Au nom de {etat.paiement.beneficiaire}</p>}
          </> : <p className="note">Les numéros de paiement ne sont pas encore communiqués : contactez l'administrateur.</p>}
        </div>

        {enAttente ? (
          <div className="carte">
            <h3>Demande en attente</h3>
            <p>Offre {LIBELLE_OFFRE[enAttente.offre]}, {enAttente.duree_mois === 12 ? "12 mois" : "1 mois"}, {montantTexte(enAttente.montant, enAttente.devise)}
              {enAttente.reference ? ` · référence ${enAttente.reference}` : ""}</p>
            <p className="note">L'administrateur vérifie votre paiement puis active l'offre.</p>
            <button className="btn" disabled={busy} onClick={() => agir(() => api.annulerDemande(enAttente.id))}>Annuler la demande</button>
          </div>
        ) : (
          <form className="carte" onSubmit={(e) => {
            e.preventDefault();
            agir(async () => {
              await api.demanderAbonnement({ groupId, offre, dureeMois: duree, moyen, reference: reference.trim() || null, precisions: precisions.trim() || null });
              setReference(""); setPrecisions("");
            });
          }}>
            <h3>J'ai payé</h3>
            {etat.demande?.statut === "refusee" && <p className="alerte">Demande précédente refusée : {etat.demande.motif}</p>}
            <label className="champ"><span>Offre</span>
              <select value={offre} onChange={(e) => setOffre(e.target.value as OffrePayante)}>
                {TARIFS.map((t) => <option key={t.offre} value={t.offre}>{t.nom}</option>)}
              </select></label>
            <label className="champ"><span>Durée</span>
              <select value={duree} onChange={(e) => setDuree(Number(e.target.value) as 1 | 12)}>
                <option value={1}>1 mois</option><option value={12}>12 mois</option>
              </select></label>
            <p>Montant à payer : <b>{montantTexte(aPayer.montant, aPayer.devise)}</b></p>
            <label className="champ"><span>Moyen</span>
              <select value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenPaiement)}>
                <option value="mtn_momo">MTN MoMo</option><option value="orange_money">Orange Money</option><option value="autre">Autre</option>
              </select></label>
            <Champ label="Référence de la transaction" value={reference} onChange={(e) => setReference(e.target.value)} required={mobile} />
            {offre === "association" && <Champ label="Autres groupes à couvrir" value={precisions} onChange={(e) => setPrecisions(e.target.value)} />}
            <button className="btn principal" disabled={busy || (mobile && !reference.trim())}>Envoyer la demande</button>
          </form>
        )}

        {etat.historique.length > 0 && (
          <div className="carte">
            <h3>Historique</h3>
            <ul>{etat.historique.map((h, i) => <li key={i}>{LIBELLE_OFFRE[h.offre]} : du {dateCourte(h.debut)} au {finAffichee(h.fin)}</li>)}</ul>
          </div>
        )}
      </>}
      {err && <p className="alerte">{err}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Brancher l'onglet et le bandeau dans `Groupe.tsx`**

Imports à ajouter :

```tsx
import { useEffect, useState } from "react";
import { alerteAbonnement } from "../../lib/abonnement";
import type { EtatAbonnement } from "../../lib/types";
import { OngletAbonnement } from "./OngletAbonnement";
```

Juste après l'appel à `useVue` (avant tout `return`) :

```tsx
  // Offre du groupe (trésorier) : bandeau de blocage ou de fin proche sur tous les onglets
  const [abo, setAbo] = useState<EtatAbonnement | null>(null);
  const role = brute?.role;
  const nbMembres = brute?.membres.length ?? 0;
  useEffect(() => {
    if (role !== "tresorier") return;
    api.etatAbonnement(id).then(setAbo).catch(() => setAbo(null));
  }, [api, id, role, nbMembres]);
  const alerteAbo = abo && alerteAbonnement(abo);
```

Dans la navigation, après le lien Journal :

```tsx
        <a href={`#/groupe/${id}/abonnement`} className={onglet === "abonnement" ? "actif" : ""}>Abonnement</a>
```

Juste après `{bandeau}` :

```tsx
      {alerteAbo && onglet !== "abonnement" && (
        <p className={alerteAbo.niveau === "bloque" ? "alerte" : "note"} role="status">
          {alerteAbo.texte} <a className="lien" href={`#/groupe/${id}/abonnement`}>Voir l'abonnement</a>
        </p>)}
```

Dans le choix de l'onglet, avant `onglet === "membres"` :

```tsx
        {onglet === "abonnement" ? <OngletAbonnement api={api} groupId={id} onChange={() => api.etatAbonnement(id).then(setAbo).catch(() => {})} />
          : onglet === "membres" ? <OngletMembres api={api} vue={vue} recharger={recharger} />
```

(l'expression existante continue après `onglet === "membres" ? …` sans autre changement).

- [ ] **Step 5: Style du tableau des offres** — ajouter à la fin de `app/src/styles.css` :

```css
/* Abonnement */
.tableau-offres { width: 100%; border-collapse: collapse; font-size: 14px; }
.tableau-offres th, .tableau-offres td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.tableau-offres td:not(:first-child), .tableau-offres th:not(:first-child) { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 6: Lancer les tests**

Run: `cd D:\njangi237\app && npm test && npx tsc -b`
Expected: PASS ; `tsc` sans erreur.

- [ ] **Step 7: Commit**

```bash
cd D:\njangi237 && git add app/src && git commit -m "Lot 7 : onglet Abonnement du trésorier et bandeau de blocage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Section Abonnements de l'administration

**Files:**
- Create: `app/src/ui/AdminAbonnements.tsx`, `app/src/ui/AdminAbonnements.test.tsx`
- Modify: `app/src/ui/Admin.tsx`, `app/src/styles.css`

**Interfaces:**
- Consumes: Task 3 (`adminAbonnements`, `accepterDemande`, `refuserDemande`, `attribuerPilote`, `creerAssociation`, `changerPrixLancement`, `reglerPaiement`, `LIBELLE_OFFRE`, `LIBELLE_MOYEN`, `montantTexte`).
- Produces: `AdminAbonnements({ api })`.

- [ ] **Step 1: Écrire les tests qui échouent — `AdminAbonnements.test.tsx`**

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fauxApi } from "../test/fauxApi";
import { adminAbonnementsTest } from "../test/donnees";
import { AdminAbonnements } from "./AdminAbonnements";

afterEach(cleanup);

describe("AdminAbonnements", () => {
  it("demande : accepter, ou refuser avec un motif", async () => {
    const api = fauxApi();
    render(<AdminAbonnements api={api} />);
    const demande = await screen.findByRole("article", { name: "Demande de Tontine des amis" });
    expect(within(demande).getByText(/MP77/)).toBeTruthy();
    const refuser = within(demande).getByRole("button", { name: "Refuser" }) as HTMLButtonElement;
    expect(refuser.disabled).toBe(true);
    await userEvent.type(within(demande).getByLabelText("Motif du refus"), "Référence introuvable");
    await userEvent.click(refuser);
    expect(api.refuserDemande).toHaveBeenCalledWith("d1", "Référence introuvable");
    await userEvent.click(within(demande).getByRole("button", { name: "Accepter" }));
    expect(api.accepterDemande).toHaveBeenCalledWith("d1", []);
  });
  it("Association : jusqu'à 4 autres groupes cochés à l'acceptation", async () => {
    const api = fauxApi();
    const v = adminAbonnementsTest();
    api.adminAbonnements.mockResolvedValue({ ...v, demandes: [{ ...v.demandes[0], offre: "association", montant: 7500 }] });
    render(<AdminAbonnements api={api} />);
    const demande = await screen.findByRole("article", { name: "Demande de Tontine des amis" });
    await userEvent.click(within(demande).getByLabelText("LE BON WEEKEND"));
    await userEvent.click(within(demande).getByRole("button", { name: "Accepter" }));
    expect(api.accepterDemande).toHaveBeenCalledWith("d1", ["g2"]);
  });
  it("groupes : offre, compteur et bascule du prix de lancement", async () => {
    const api = fauxApi();
    render(<AdminAbonnements api={api} />);
    expect(await screen.findByText("Prix de lancement : 1 / 50")).toBeTruthy();
    await userEvent.click(screen.getByLabelText("Prix de lancement pour Tontine des amis"));
    expect(api.changerPrixLancement).toHaveBeenCalledWith("g1", true);
  });
  it("Pilote, Association et numéros de paiement", async () => {
    const api = fauxApi();
    render(<AdminAbonnements api={api} />);
    await screen.findByText("Prix de lancement : 1 / 50");
    await userEvent.selectOptions(screen.getByLabelText("Groupe pour l'offre Pilote"), "g1");
    await userEvent.click(screen.getByRole("button", { name: "Attribuer l'offre Pilote" }));
    expect(api.attribuerPilote).toHaveBeenCalledWith("g1", "2027-01-31");
    const asso = screen.getByRole("group", { name: "Groupes de l'offre Association" });
    await userEvent.click(within(asso).getByLabelText("Tontine des amis"));
    await userEvent.click(within(asso).getByLabelText("LE BON WEEKEND"));
    await userEvent.click(screen.getByRole("button", { name: "Créer l'offre Association" }));
    expect(api.creerAssociation).toHaveBeenCalledWith(["g1", "g2"], 12);
    const orange = screen.getByLabelText("Numéro Orange Money");
    await userEvent.type(orange, "699000002");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les numéros" }));
    expect(api.reglerPaiement).toHaveBeenCalledWith("677000001", "699000002", "Olivier A.");
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/ui/AdminAbonnements.test.tsx`
Expected: FAIL (`./AdminAbonnements` introuvable).

- [ ] **Step 3: Écrire `AdminAbonnements.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { finAffichee, LIBELLE_MOYEN, LIBELLE_OFFRE, montantTexte } from "../lib/abonnement";
import { dateCourte } from "../lib/format";
import type { Api, VueAdminAbonnements } from "../lib/types";
import { Champ } from "./Champ";

const basculer = (liste: string[], id: string, max: number) =>
  liste.includes(id) ? liste.filter((x) => x !== id) : liste.length < max ? [...liste, id] : liste;

/** Administration des abonnements : demandes, offres des groupes, Pilote, Association, prix de lancement, numéros de paiement. */
export function AdminAbonnements({ api }: { api: Api }) {
  const [v, setV] = useState<VueAdminAbonnements | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [autres, setAutres] = useState<Record<string, string[]>>({});
  const [pilote, setPilote] = useState({ groupId: "", fin: "2027-01-31" });
  const [asso, setAsso] = useState<{ groupes: string[]; duree: 1 | 12 }>({ groupes: [], duree: 12 });
  const [pay, setPay] = useState({ mtn: "", orange: "", beneficiaire: "" });

  const charger = useCallback(() => {
    api.adminAbonnements().then((x) => {
      setV(x); setErr("");
      setPay({ mtn: x.paiement.mtn ?? "", orange: x.paiement.orange ?? "", beneficiaire: x.paiement.beneficiaire ?? "" });
    }).catch((e) => setErr((e as Error).message));
  }, [api]);
  useEffect(() => { charger(); }, [charger]);

  const agir = async (f: () => Promise<unknown>) => {
    setBusy(true); setErr("");
    try { await f(); charger(); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  if (!v) return err ? <p className="alerte">{err}</p> : <p className="note">Chargement des abonnements…</p>;
  return (
    <section>
      <h2>Abonnements</h2>
      {err && <p className="alerte">{err}</p>}

      <div className="carte">
        <h3>Demandes à traiter</h3>
        {v.demandes.length === 0 && <p className="note">Aucune demande en attente.</p>}
        {v.demandes.map((d) => (
          <article key={d.id} className="demande" aria-label={`Demande de ${d.groupe}`}>
            <p><b>{d.groupe}</b> · {LIBELLE_OFFRE[d.offre]} · {d.duree_mois === 12 ? "12 mois" : "1 mois"} · {montantTexte(d.montant, d.devise)}</p>
            <p className="note">{LIBELLE_MOYEN[d.moyen]}{d.reference ? ` · référence ${d.reference}` : ""} · {d.demandeur ?? "?"}, le {dateCourte(d.created_at)}</p>
            {d.precisions && <p className="note">Précisions : {d.precisions}</p>}
            {d.offre === "association" && (
              <fieldset className="sans-cadre"><legend className="note">Autres groupes couverts (4 au plus)</legend>
                {v.groupes.filter((g) => g.group_id !== d.group_id).map((g) => (
                  <label key={g.group_id} className="case"><input type="checkbox" checked={(autres[d.id] ?? []).includes(g.group_id)}
                    onChange={() => setAutres({ ...autres, [d.id]: basculer(autres[d.id] ?? [], g.group_id, 4) })} /> {g.nom}</label>))}
              </fieldset>)}
            <button className="btn principal" disabled={busy} onClick={() => agir(() => api.accepterDemande(d.id, autres[d.id] ?? []))}>Accepter</button>
            <Champ label="Motif du refus" value={motifs[d.id] ?? ""} onChange={(e) => setMotifs({ ...motifs, [d.id]: e.target.value })} />
            <button className="btn" disabled={busy || !(motifs[d.id] ?? "").trim()}
              onClick={() => agir(() => api.refuserDemande(d.id, (motifs[d.id] ?? "").trim()))}>Refuser</button>
          </article>))}
      </div>

      <div className="carte">
        <h3>Groupes</h3>
        <p className="note">Prix de lancement : {v.lancements} / 50</p>
        <div className="defile"><table className="tableau-offres">
          <thead><tr><th>Groupe</th><th>Offre</th><th>Fin</th><th>Membres</th><th>Lancement</th></tr></thead>
          <tbody>{v.groupes.map((g) => (
            <tr key={g.group_id}>
              <td>{g.nom}</td><td>{LIBELLE_OFFRE[g.offre]}</td><td>{g.fin ? finAffichee(g.fin) : "—"}</td>
              <td>{g.membres} / {g.limite}</td>
              <td><input type="checkbox" aria-label={`Prix de lancement pour ${g.nom}`} checked={g.prix_lancement} disabled={busy}
                onChange={() => agir(() => api.changerPrixLancement(g.group_id, !g.prix_lancement))} /></td>
            </tr>))}</tbody>
        </table></div>
      </div>

      <form className="carte" onSubmit={(e) => { e.preventDefault(); agir(() => api.attribuerPilote(pilote.groupId, pilote.fin)); }}>
        <h3>Offre Pilote</h3>
        <label className="champ"><span>Groupe pour l'offre Pilote</span>
          <select value={pilote.groupId} onChange={(e) => setPilote({ ...pilote, groupId: e.target.value })}>
            <option value="">Choisir…</option>
            {v.groupes.map((g) => <option key={g.group_id} value={g.group_id}>{g.nom}</option>)}
          </select></label>
        <Champ label="Dernier jour inclus" type="date" value={pilote.fin} onChange={(e) => setPilote({ ...pilote, fin: e.target.value })} />
        <button className="btn principal" disabled={busy || !pilote.groupId || !pilote.fin}>Attribuer l'offre Pilote</button>
      </form>

      <form className="carte" onSubmit={(e) => { e.preventDefault(); agir(() => api.creerAssociation(asso.groupes, asso.duree)); }}>
        <h3>Offre Association</h3>
        <fieldset className="sans-cadre" aria-label="Groupes de l'offre Association">
          {v.groupes.map((g) => (
            <label key={g.group_id} className="case"><input type="checkbox" checked={asso.groupes.includes(g.group_id)}
              onChange={() => setAsso({ ...asso, groupes: basculer(asso.groupes, g.group_id, 5) })} /> {g.nom}</label>))}
        </fieldset>
        <label className="champ"><span>Durée</span>
          <select value={asso.duree} onChange={(e) => setAsso({ ...asso, duree: Number(e.target.value) as 1 | 12 })}>
            <option value={1}>1 mois</option><option value={12}>12 mois</option>
          </select></label>
        <button className="btn principal" disabled={busy || asso.groupes.length === 0}>Créer l'offre Association</button>
      </form>

      <form className="carte" onSubmit={(e) => { e.preventDefault(); agir(() => api.reglerPaiement(pay.mtn, pay.orange, pay.beneficiaire)); }}>
        <h3>Numéros de paiement</h3>
        <Champ label="Numéro MTN MoMo" value={pay.mtn} onChange={(e) => setPay({ ...pay, mtn: e.target.value })} inputMode="tel" />
        <Champ label="Numéro Orange Money" value={pay.orange} onChange={(e) => setPay({ ...pay, orange: e.target.value })} inputMode="tel" />
        <Champ label="Au nom de" value={pay.beneficiaire} onChange={(e) => setPay({ ...pay, beneficiaire: e.target.value })} />
        <button className="btn principal" disabled={busy}>Enregistrer les numéros</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Brancher dans `Admin.tsx` et styles**

Dans `app/src/ui/Admin.tsx` : ajouter `import { AdminAbonnements } from "./AdminAbonnements";` et, juste avant `</section>` final, `<AdminAbonnements api={api} />`.

Ajouter à la fin de `app/src/styles.css` :

```css
.demande { border-top: 1px solid var(--line); padding-top: 10px; display: grid; gap: 8px; }
.demande:first-of-type { border-top: 0; padding-top: 0; }
.case { display: flex; gap: 8px; align-items: center; font-size: 14px; padding: 4px 0; }
.defile { overflow-x: auto; }
```

- [ ] **Step 5: Lancer les tests et le build**

Run: `cd D:\njangi237\app && npm test && npm run build && npm run verifier`
Expected: PASS ; build et contrôle du dist sans erreur.

- [ ] **Step 6: Commit**

```bash
cd D:\njangi237 && git add app/src && git commit -m "Lot 7 : section Abonnements de l'administration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Mise en ligne après feu vert

**Files:** aucun fichier de code.

**Interfaces:**
- Consumes: branche `v2-lot7` complète.

- [ ] **Step 1: Suites complètes**

Run: `cd D:\njangi237\db && npm test` puis `cd D:\njangi237\app && npm test && npm run build && npm run verifier`
Expected: tout PASS.

- [ ] **Step 2: Pousser la branche, ouvrir la PR**

```bash
cd D:\njangi237 && git push -u origin v2-lot7
```

PR `v2-lot7` → `main` (même méthode qu'au lot 6), titre « Lot 7 : offres et abonnements », description résumant les Tasks 1 à 5, terminée par `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 3: ARRÊT — feu vert d'Olivier**

Présenter : la PR, les deux migrations (effet immédiat sur la base partagée : chaque groupe existant passe en offre Pilote jusqu'au 31 janvier 2027, rien ne change pour lui), et ce qu'il devra faire ensuite (saisir ses numéros marchands dans l'administration). **Rien n'est appliqué sans un « oui » explicite.**

- [ ] **Step 4: Appliquer les migrations sur Supabase (projet `jviedpdlyqixpfynekqs`)**

Avec l'outil `apply_migration` du connecteur Supabase : nom `0009_abonnements`, contenu du fichier ; puis `0010_demandes_abonnement`. Si l'outil répond « Invalid or expired requestState », vérifier avec `list_migrations` avant de relancer.

Puis, avec `execute_sql` :

```sql
select g.name, o.offre, o.fin from groups g cross join lateral offre_en_vigueur(g.id) o order by g.name;
```

Expected: chaque groupe en `pilote`, fin `2027-01-31 23:00:00+00`.

- [ ] **Step 5: Aperçu puis production**

```bash
cd D:\njangi237\app && npm run build && npm run verifier && npx wrangler pages deploy dist --project-name njangi237 --branch v2 --commit-dirty=true
```

Parcours en démo sur `https://v2.njangi237.pages.dev` (onglet Abonnement en lecture seule, aucune erreur JavaScript). Olivier vérifie avec son compte : section Abonnements de l'administration (saisie de ses numéros marchands), onglet Abonnement de « LE BON WEEKEND ». Après son accord : fusion dans `main` et

```bash
cd D:\njangi237 && git checkout main && git pull && git merge --no-ff v2-lot7 -m "Fusion du lot 7 : offres et abonnements" && git push
cd app && npm run build && npm run verifier && npx wrangler pages deploy dist --project-name njangi237 --branch main --commit-dirty=true
```

- [ ] **Step 6: Mettre à jour la note de mémoire `njangi237-project.md`.**
