# Njangi237 v2 — Lot 5 : tours et journal — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au trésorier d'une tontine l'onglet **Tours** (régler l'ordre à la main ou par tirage au sort, échanger deux tours, remplacer un bénéficiaire, remettre la cagnotte avec le montant proposé et l'écart, commencer un nouveau tour) et l'onglet **Journal** (historique lisible des actions du groupe, avec l'auteur).

**Architecture:** Les six fonctions des tours existent depuis le lot 1 (`ordonner_tours`, `tirer_au_sort`, `echanger_tours`, `remplacer_beneficiaire`, `enregistrer_remise`, `nouveau_tour`) : ce lot les branche. Une seule migration, `0008_journal.sql`, ajoute `lire_journal` : un membre ne peut pas lire la fiche (`people`) des autres, donc le nom de l'auteur d'une entrée ne peut venir que d'une fonction serveur qui applique la même règle de visibilité que la RLS du journal. Logique pure testée dans `lib/tours.ts` et `lib/journal.ts` ; écrans testés avec la fausse `Api`.

**Tech Stack:** PostgreSQL (Supabase) testé avec PGlite 0.5.8 ; React 18.3.1, TypeScript, Vitest 4.1.11, React Testing Library 16.3.3, user-event 14.6.7 ; supabase-js.

**Spec:** `docs/superpowers/specs/2026-10-16-njangi237-v2-design.md` — section 4 (Tours et cagnotte), section 5 écran 4 (onglets Tours et Journal), section 9 lot 5.

### Écarts assumés par rapport à la spec

1. **Journal réservé au trésorier dans l'interface** : la fonction `lire_journal` sert aussi les membres (entrées « visibles des membres »), mais l'espace membre n'a pas d'onglet Journal dans ce lot ; la spec ne le prévoit pas sur l'écran 3.
2. **Montant proposé à la remise** : « collecté ÷ k » quand les paiements du cycle sont chargés (cycle ouvert ou dernier cycle clos) ; pour un cycle plus ancien, le montant attendu enregistré à l'ouverture.

## Global Constraints

- Onglet Tours uniquement pour les groupes de type `tontine` (la base refuse déjà : « Réservé aux tontines »).
- Avant verrouillage (`order_locked = false`) : réglage manuel ou tirage ; après : seulement l'échange de tours (la base refuse sinon : « L'ordre est verrouillé : utilisez l'échange de tours »).
- Référence obligatoire pour une remise par MTN MoMo ou Orange Money ; montant entier > 0.
- Toute action d'un onglet passe par un panneau `Confirmer` quand elle est irréversible ou visible des membres (tirage au sort, nouveau tour, échange).
- Hors ligne : les onglets restent consultables, tous les boutons désactivés (le `fieldset` de `Groupe` s'en charge déjà).
- Branche `v2-lot5` ; commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commandes : `cd D:\njangi237\db && npm test` (≈ 2 min) ; `cd D:\njangi237\app && npm test` ; `npm run build`.

## Review Focus

1. **Membre retiré dans la liste des tours** : il n'apparaît ni dans l'ordre, ni dans les choix d'échange ou de remplacement, et ne bloque pas la fin du tour → test Task 2 (`etatTour` ignore les retirés).
2. **Membre invité (compte pas encore créé)** : il compte dans l'ordre et dans la fin du tour, comme en base → test Task 2 (`etatTour` : invité non servi → tour non terminé).
3. **Remise MoMo sans référence** : bouton désactivé avant même l'appel → test Task 4.
4. **Journal d'un autre groupe ou entrée réservée au trésorier** : jamais renvoyée à un membre → tests Task 1.
5. **Échange avec un membre déjà servi** : impossible à choisir dans l'interface (la base le refuse aussi) → test Task 4.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0008_journal.sql` | `lire_journal(groupe, avant, limite)` avec le nom de l'auteur |
| `db/tests/journal.test.mjs` | Visibilité, ordre, pagination, refus |
| `db/tests/privileges.test.mjs` | Liste blanche : ajoute `lire_journal` |
| `app/src/lib/types.ts` | `Groupe.order_locked`, `VueGroupe.remises`, `EntreeJournal`, méthodes `Api` |
| `app/src/lib/tours.ts` | `deplacer`, `etatTour`, `montantPropose` |
| `app/src/lib/journal.ts` | `libelleJournal` : une phrase par action |
| `app/src/lib/routes.ts` | Onglets `tours` et `journal` |
| `app/src/lib/supabaseApi.ts` | Appels des fonctions, remises dans `chargerGroupe` |
| `app/src/test/donnees.ts`, `app/src/test/fauxApi.ts` | Données et fausse Api |
| `app/src/ui/groupe/OngletTours.tsx` | Écran Tours |
| `app/src/ui/groupe/OngletJournal.tsx` | Écran Journal |
| `app/src/ui/groupe/Groupe.tsx` | Quatre onglets (Tours masqué hors tontine) |

---

### Task 1: `lire_journal` (base)

**Files:**
- Create: `supabase/migrations/0008_journal.sql`
- Create: `db/tests/journal.test.mjs`
- Modify: `db/tests/privileges.test.mjs` (liste `ALLOWED`)

**Interfaces:**
- Produces: `lire_journal(p_group uuid, p_avant bigint default null, p_limite int default 50) returns table(id bigint, action text, details jsonb, created_at timestamptz, auteur text, visible boolean)` — du plus récent au plus ancien ; trésorier : tout ; membre : `visible_to_members` seulement ; autre : erreur `42501` « Réservé aux membres du groupe » ; limite bornée entre 1 et 200.

- [ ] **Step 1: Écrire les tests**

`db/tests/journal.test.mjs` :

```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, as } from "../harness.mjs";
import { seedPilot, G, P } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const journal = (uid, ...args) =>
  as(db, uid, `select * from lire_journal(${args.map((_, i) => `$${i + 1}`).join(", ")})`, args);

async function remplir() {
  await seedPilot(db);
  await db.exec(`insert into journal(group_id, actor, action, details, visible_to_members) values
    ('${G.tontine}', '${P.tres}', 'tirage_au_sort', '{"ordre":["Bob","Alice"]}', true),
    ('${G.tontine}', '${P.tres}', 'paiement_conteste', '{"nom":"Bob","montant":5000,"motif":"x"}', false),
    ('${G.tontine}', null, 'cycle_ouvert', '{"cycle":"Octobre"}', true),
    ('${G.autre}', '${P.xavier}', 'cycle_ouvert', '{"cycle":"Autre"}', true)`);
}

test("trésorier : tout le journal du groupe, du plus récent au plus ancien, avec l'auteur", () => scenario(db, async () => {
  await remplir();
  const r = await journal(P.tres, G.tontine);
  assert.deepEqual(r.map((e) => e.action), ["cycle_ouvert", "paiement_conteste", "tirage_au_sort"]);
  assert.equal(r[2].auteur, "Tina");
  assert.equal(r[0].auteur, null);
  assert.equal(r[1].visible, false);
  assert.deepEqual(r[2].details, { ordre: ["Bob", "Alice"] });
}));

test("membre : seulement les entrées visibles des membres", () => scenario(db, async () => {
  await remplir();
  assert.deepEqual((await journal(P.alice, G.tontine)).map((e) => e.action), ["cycle_ouvert", "tirage_au_sort"]);
}));

test("hors du groupe ou anonyme : refusé", () => scenario(db, async () => {
  await remplir();
  await assert.rejects(journal(P.xavier, G.tontine), /Réservé aux membres du groupe/);
  await assert.rejects(journal(null, G.tontine), /permission denied/);
}));

test("pagination : avant un identifiant, taille bornée", () => scenario(db, async () => {
  await remplir();
  const tout = await journal(P.tres, G.tontine);
  const suite = await journal(P.tres, G.tontine, Number(tout[0].id), 1);
  assert.deepEqual(suite.map((e) => e.action), ["paiement_conteste"]);
  assert.equal((await journal(P.tres, G.tontine, null, 0)).length, 1);
}));
```

Dans `db/tests/privileges.test.mjs`, remplacer la ligne :

```js
  "declarer_paiement", "echanger_tours", "enregistrer_remise", "inviter", "is_member", "is_platform_admin", "is_treasurer",
  "nouveau_tour", "ordonner_tours", "ordre_tours", "ouvrir_cycle", "recouvrement", "remplacer_beneficiaire",
```

par :

```js
  "declarer_paiement", "echanger_tours", "enregistrer_remise", "inviter", "is_member", "is_platform_admin", "is_treasurer",
  "lire_journal", "nouveau_tour", "ordonner_tours", "ordre_tours", "ouvrir_cycle", "recouvrement", "remplacer_beneficiaire",
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd D:\njangi237\db && node --test --test-concurrency=1 tests/journal.test.mjs tests/privileges.test.mjs`
Expected: FAIL — `function lire_journal(...) does not exist` ; la liste blanche diffère (`lire_journal` absent).

- [ ] **Step 3: Écrire la migration**

`supabase/migrations/0008_journal.sql` :

```sql
-- =====================================================================
-- Njangi237 v2 : lecture du journal avec le nom de l'auteur
-- Un membre ne lit pas la fiche `people` des autres : le nom passe par cette fonction,
-- qui applique la même règle que la RLS du journal (trésorier : tout ; membre : entrées visibles).
-- =====================================================================

create or replace function lire_journal(p_group uuid, p_avant bigint default null, p_limite int default 50)
returns table(id bigint, action text, details jsonb, created_at timestamptz, auteur text, visible boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_tres boolean;
begin
  if not is_member(p_group) then
    raise exception 'Réservé aux membres du groupe' using errcode = '42501';
  end if;
  v_tres := is_treasurer(p_group);
  return query
    select j.id, j.action, j.details, j.created_at, p.full_name, j.visible_to_members
      from journal j left join people p on p.id = j.actor
     where j.group_id = p_group
       and (v_tres or j.visible_to_members)
       and (p_avant is null or j.id < p_avant)
     order by j.id desc
     limit least(greatest(coalesce(p_limite, 50), 1), 200);
end $$;

revoke execute on function lire_journal(uuid, bigint, int) from public, anon;
grant  execute on function lire_journal(uuid, bigint, int) to authenticated;
```

- [ ] **Step 4: Vérifier le succès, puis toute la suite**

Run: `cd D:\njangi237\db && node --test --test-concurrency=1 tests/journal.test.mjs tests/privileges.test.mjs`
Expected: PASS.
Run: `cd D:\njangi237\db && npm test`
Expected: tous les tests passent (67 existants + 4 nouveaux = 71).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_journal.sql db/tests/journal.test.mjs db/tests/privileges.test.mjs
git commit -m "Lot 5 : lire_journal (journal lisible avec l'auteur, même visibilité que la RLS)"
```

---

### Task 2: logique des tours, libellés du journal, routes

**Files:**
- Modify: `app/src/lib/types.ts`, `app/src/lib/tours.ts`, `app/src/lib/routes.ts`, `app/src/ui/groupe/Groupe.tsx` (type de l'onglet), `app/src/test/donnees.ts`
- Create: `app/src/lib/journal.ts`, `app/src/lib/journal.test.ts`
- Test: `app/src/lib/tours.test.ts`, `app/src/lib/routes.test.ts`

**Interfaces:**
- Produces (types.ts) : `Groupe.order_locked: boolean` ; `VueGroupe.remises: Remise[]` ; `interface EntreeJournal { id: number; action: string; details: Record<string, unknown>; created_at: string; auteur: string | null; visible: boolean }`.
- Produces (tours.ts) : `deplacer<T>(liste: T[], i: number, delta: number): T[]` ; `interface LigneTour { membre: Membre; servi: Remise | null; prevu: Remise | null }` ; `interface EtatTour { lignes: LigneTour[]; termine: boolean; aRemettre: Remise[] }` ; `etatTour(membres: Membre[], remises: Remise[], round: number): EtatTour` ; `montantPropose(remise: Remise, collecte: number | null, k: number): number`.
- Produces (journal.ts) : `libelleJournal(e: EntreeJournal): string`.
- Produces (routes.ts) : `type OngletGroupe = "cycle" | "membres" | "tours" | "journal"` ; la route `groupe` porte `onglet: OngletGroupe`.

- [ ] **Step 1: Écrire les tests**

Ajouter à la fin de `app/src/lib/tours.test.ts` (adapter la ligne d'import existante pour y ajouter `deplacer, etatTour, montantPropose` et le type `Membre, Remise` depuis `./types`) :

```ts
describe("réglage et état du tour", () => {
  const m = (id: string, position: number | null, status: Membre["status"] = "actif"): Membre => ({
    id, display_name: id.toUpperCase(), phone: "", role: "membre", status, position, person_id: null, left_balance: null,
    created_at: "2026-09-01T00:00:00Z" });
  const r = (id: string, membre: string, status: Remise["status"], round = 1): Remise => ({
    id, cycle_id: "c", round, membership_id: membre, amount_expected: 20000, amount: status === "remis" ? 20000 : null,
    status, paid_on: status === "remis" ? "2026-10-30" : null });

  it("deplacer : monte, descend, ignore les bords", () => {
    expect(deplacer(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(deplacer(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    const l = ["a", "b"];
    expect(deplacer(l, 0, -1)).toBe(l);
    expect(deplacer(l, 1, 1)).toBe(l);
  });

  it("etatTour : ordre par position, retirés exclus, servis et prévus du tour courant seulement", () => {
    const e = etatTour([m("c", 3), m("a", 1), m("x", 2, "retire"), m("b", 2, "invite")],
      [r("r1", "a", "remis"), r("r2", "b", "prevu"), r("r0", "c", "remis", 0)], 1);
    expect(e.lignes.map((l) => l.membre.id)).toEqual(["a", "b", "c"]);
    expect(e.lignes.map((l) => [Boolean(l.servi), Boolean(l.prevu)])).toEqual([[true, false], [false, true], [false, false]]);
    expect(e.aRemettre.map((x) => x.id)).toEqual(["r2"]);
    expect(e.termine).toBe(false);
  });

  it("etatTour : terminé quand chaque membre non retiré (invités compris) a reçu sa part", () => {
    const membres = [m("a", 1), m("b", 2, "invite"), m("x", 3, "retire")];
    expect(etatTour(membres, [r("r1", "a", "remis")], 1).termine).toBe(false);
    expect(etatTour(membres, [r("r1", "a", "remis"), r("r2", "b", "remis")], 1).termine).toBe(true);
    expect(etatTour([], [], 1).termine).toBe(false);
  });

  it("montantPropose : collecté ÷ k, sinon le montant attendu", () => {
    expect(montantPropose(r("r", "a", "prevu"), 15000, 2)).toBe(7500);
    expect(montantPropose(r("r", "a", "prevu"), 5001, 2)).toBe(2500);
    expect(montantPropose(r("r", "a", "prevu"), null, 1)).toBe(20000);
  });
});
```

`app/src/lib/journal.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { libelleJournal } from "./journal";
import type { EntreeJournal } from "./types";

const e = (action: string, details: Record<string, unknown>): EntreeJournal =>
  ({ id: 1, action, details, created_at: "2026-10-16T10:00:00Z", auteur: "Tina", visible: true });

describe("libellés du journal", () => {
  it("une phrase claire par action", () => {
    expect(libelleJournal(e("tirage_au_sort", { ordre: ["Bob", "Alice"] }))).toBe("Tirage au sort de l'ordre : 1. Bob, 2. Alice");
    expect(libelleJournal(e("tours_echanges", { a: "Alice", b: "Bob" }))).toBe("Tours échangés entre Alice et Bob");
    expect(libelleJournal(e("cagnotte_remise", { nom: "Tina", montant: 20000 }))).toBe("Cagnotte remise à Tina : 20 000 FCFA");
    expect(libelleJournal(e("cycle_clos", { cycle: "Octobre 2026", dettes: 2 }))).toBe("Cycle « Octobre 2026 » clos · 2 dettes");
    expect(libelleJournal(e("cycle_clos", { cycle: "Octobre 2026", dettes: 0 }))).toBe("Cycle « Octobre 2026 » clos");
    expect(libelleJournal(e("paiement_conteste", { nom: "Alice", montant: 5000, motif: "Référence introuvable" })))
      .toBe("Paiement d'Alice contesté (5 000 FCFA) : Référence introuvable");
    expect(libelleJournal(e("role_change", { nom: "Bob", role: "tresorier" }))).toBe("Bob devient trésorier");
    expect(libelleJournal(e("nouveau_tour", { tour: 2 }))).toBe("Nouveau tour (tour 2)");
    expect(libelleJournal(e("membre_rejoint", { nom: "Ines" }))).toBe("Ines a rejoint le groupe");
  });

  it("action inconnue ou détails manquants : jamais d'erreur", () => {
    expect(libelleJournal(e("action_future", {}))).toBe("action future");
    expect(libelleJournal(e("tirage_au_sort", {}))).toBe("Tirage au sort de l'ordre : ");
  });
});
```

Dans `app/src/lib/routes.test.ts`, après la ligne `expect(lireRoute("#/groupe/abc-123/membres"))…`, ajouter :

```ts
    expect(lireRoute("#/groupe/abc-123/tours")).toEqual({ nom: "groupe", id: "abc-123", onglet: "tours" });
    expect(lireRoute("#/groupe/abc-123/journal")).toEqual({ nom: "groupe", id: "abc-123", onglet: "journal" });
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd D:\njangi237\app && npx vitest run src/lib/tours.test.ts src/lib/journal.test.ts src/lib/routes.test.ts`
Expected: FAIL — `deplacer`/`etatTour`/`montantPropose` non exportés, `./journal` introuvable, onglets `tours`/`journal` lus comme `cycle`.

- [ ] **Step 3: Écrire le code**

`app/src/lib/types.ts` :
- dans `interface Groupe`, remplacer `beneficiaries_per_cycle: number; current_round: number;` par `beneficiaries_per_cycle: number; current_round: number; order_locked: boolean;` ;
- remplacer la ligne `export interface VueGroupe { … }` par :

```ts
export interface VueGroupe {
  role: RoleGroupe; groupe: Groupe; membres: Membre[]; cycles: Cycle[]; paiements: Paiement[]; dettes: Dette[]; remises: Remise[];
}
/** Entrée du journal lue par `lire_journal` (auteur = nom de la personne, null pour une action automatique). */
export interface EntreeJournal {
  id: number; action: string; details: Record<string, unknown>; created_at: string; auteur: string | null; visible: boolean;
}
```

Ajouter à la fin de `app/src/lib/tours.ts` (et `Membre, Remise` à l'import de types) :

```ts
/** Déplace l'élément `i` de `delta` places (−1 = monter) ; hors limites, la liste est rendue telle quelle. */
export function deplacer<T>(liste: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (i < 0 || i >= liste.length || j < 0 || j >= liste.length) return liste;
  const r = [...liste];
  [r[i], r[j]] = [r[j]!, r[i]!];
  return r;
}

export interface LigneTour { membre: Membre; servi: Remise | null; prevu: Remise | null }
export interface EtatTour { lignes: LigneTour[]; termine: boolean; aRemettre: Remise[] }

/**
 * Tour courant, avec les mêmes règles que la base : les membres non retirés (invités compris) dans l'ordre des positions,
 * qui a reçu sa part, qui est prévu ; le tour est terminé quand chacun a reçu la sienne.
 */
export function etatTour(membres: Membre[], remises: Remise[], round: number): EtatTour {
  const duTour = remises.filter((r) => r.round === round);
  const lignes = membres.filter((m) => m.status !== "retire")
    .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.display_name.localeCompare(b.display_name, "fr"))
    .map((membre) => ({
      membre,
      servi: duTour.find((r) => r.membership_id === membre.id && r.status === "remis") ?? null,
      prevu: duTour.find((r) => r.membership_id === membre.id && r.status === "prevu") ?? null,
    }));
  return { lignes, termine: lignes.length > 0 && lignes.every((l) => l.servi), aRemettre: duTour.filter((r) => r.status === "prevu") };
}

/** Montant proposé à la remise : collecté du cycle ÷ bénéficiaires ; sans paiements connus, le montant attendu. */
export function montantPropose(remise: Remise, collecte: number | null, k: number): number {
  return collecte === null ? remise.amount_expected : Math.floor(collecte / Math.max(k, 1));
}
```

`app/src/lib/journal.ts` :

```ts
import { de, fcfa } from "./format";
import type { EntreeJournal } from "./types";

const ROLE: Record<string, string> = { tresorier: "trésorier", membre: "membre" };

/** Une phrase lisible par entrée du journal ; une action inconnue (version future) reste affichable. */
export function libelleJournal(e: EntreeJournal): string {
  const s = (k: string) => String(e.details[k] ?? "");
  const n = (k: string) => Number(e.details[k] ?? 0);
  const ordre = Array.isArray(e.details.ordre) ? (e.details.ordre as unknown[]).map((x, i) => `${i + 1}. ${String(x)}`).join(", ") : "";
  switch (e.action) {
    case "groupe_cree": return `Groupe « ${s("nom")} » créé`;
    case "membre_ajoute": return `${s("nom")} ajouté au groupe`;
    case "membre_rejoint": return `${s("nom")} a rejoint le groupe`;
    case "membre_retire": return `${s("nom")} a quitté le groupe`;
    case "solde_depart": return `Solde de départ ${de(s("nom"))} : ${fcfa(n("montant_restant"))}`;
    case "role_change": return `${s("nom")} devient ${ROLE[s("role")] ?? s("role")}`;
    case "invitation_envoyee": return `Invitation envoyée à ${s("nom")}`;
    case "nouveau_pin_envoye": return `Lien de nouveau PIN envoyé à ${s("nom")}`;
    case "pin_reinitialise": return `${s("nom")} a choisi un nouveau PIN`;
    case "cycle_ouvert": return `Cycle « ${s("cycle")} » ouvert`;
    case "cycle_clos": return `Cycle « ${s("cycle")} » clos${n("dettes") ? ` · ${n("dettes")} dette${n("dettes") > 1 ? "s" : ""}` : ""}`;
    case "cycle_rouvert": return `Cycle « ${s("cycle")} » rouvert`;
    case "paiement_conteste": return `Paiement ${de(s("nom"))} contesté (${fcfa(n("montant"))}) : ${s("motif")}`;
    case "ordre_modifie": return `Ordre des tours modifié : ${ordre}`;
    case "tirage_au_sort": return `Tirage au sort de l'ordre : ${ordre}`;
    case "tours_echanges": return `Tours échangés entre ${s("a")} et ${s("b")}`;
    case "cagnotte_remise": return `Cagnotte remise à ${s("nom")} : ${fcfa(n("montant"))}`;
    case "nouveau_tour": return `Nouveau tour (tour ${n("tour")})`;
    default: return e.action.replace(/_/g, " ");
  }
}
```

`app/src/lib/routes.ts` : remplacer le fichier par :

```ts
export type OngletGroupe = "cycle" | "membres" | "tours" | "journal";
export type Route =
  | { nom: "accueil" } | { nom: "profil" } | { nom: "admin" } | { nom: "amorcer" }
  | { nom: "invitation" | "nouveau-pin"; jeton: string }
  | { nom: "groupe"; id: string; onglet: OngletGroupe };

const ONGLETS: OngletGroupe[] = ["membres", "tours", "journal"];

/** « #/invitation/<jeton> » → { nom: "invitation", jeton } ; tout le reste retombe sur l'accueil. */
export function lireRoute(hash: string): Route {
  const [, a, b, c] = hash.replace(/^#/, "").split("/");
  if ((a === "invitation" || a === "nouveau-pin") && b) return { nom: a, jeton: b };
  if (a === "groupe" && b) return { nom: "groupe", id: b, onglet: ONGLETS.find((o) => o === c) ?? "cycle" };
  if (a === "profil" || a === "admin" || a === "amorcer") return { nom: a };
  return { nom: "accueil" };
}
```

`app/src/ui/groupe/Groupe.tsx` : remplacer `onglet: "cycle" | "membres";` par `onglet: OngletGroupe;` et ajouter `import type { OngletGroupe } from "../../lib/routes";`. (Les nouveaux onglets sont branchés en Task 5 ; d'ici là, tout onglet autre que `cycle` affiche Membres, comme avant.)

`app/src/test/donnees.ts`, dans `vueTest()` :
- le groupe devient `{ id: "g1", name: "Tontine des amis", type: "tontine", amount: 5000, frequency: "mensuelle", beneficiaries_per_cycle: 1, current_round: 1, order_locked: true }` ;
- après `dettes: [],` ajouter :

```ts
    remises: [{ id: "r-oct", cycle_id: "c-oct", round: 1, membership_id: "m-tina", amount_expected: 20000, amount: null,
      status: "prevu", paid_on: null }],
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd D:\njangi237\app && npm test`
Expected: tous les tests passent (112 + 4 tours + 2 journal = 118 ; routes compte toujours 2).
Ne pas lancer `npm run build` ici : il échoue tant que `supabaseApi.chargerGroupe` ne renvoie pas `remises` (« Property 'remises' is missing »), ce que corrige Task 3.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib app/src/test/donnees.ts app/src/ui/groupe/Groupe.tsx
git commit -m "Lot 5 : état du tour, montant proposé, libellés du journal, onglets Tours et Journal dans les routes"
```

---

### Task 3: Api des tours et du journal

**Files:**
- Modify: `app/src/lib/types.ts` (interface `Api`), `app/src/lib/supabaseApi.ts`, `app/src/test/fauxApi.ts`

**Interfaces:**
- Consumes: `EntreeJournal`, `Remise`, `MoyenPaiement` (Task 2).
- Produces (Api) :
  - `ordonnerTours(groupId: string, ordre: string[]): Promise<void>`
  - `tirerAuSort(groupId: string): Promise<string[]>` (noms dans le nouvel ordre)
  - `echangerTours(a: string, b: string): Promise<void>` (identifiants d'adhésion)
  - `remplacerBeneficiaire(remiseId: string, membershipId: string): Promise<void>`
  - `enregistrerRemise(remiseId: string, montant: number, moyen: MoyenPaiement, reference: string | null): Promise<{ ecart: number }>`
  - `nouveauTour(groupId: string): Promise<number>` (numéro du nouveau tour)
  - `lireJournal(groupId: string, avant?: number): Promise<EntreeJournal[]>` (50 entrées au plus)
  - `chargerGroupe` renvoie aussi `remises` (toutes les remises du groupe) et `groupe.order_locked`.

- [ ] **Step 1: Constater l'échec du typage**

Run: `cd D:\njangi237\app && npm run build`
Expected: FAIL — `Property 'remises' is missing in type …` (supabaseApi.chargerGroupe).

- [ ] **Step 2: Écrire le code**

`app/src/lib/types.ts`, dans `interface Api`, après `abonner(…): () => void;` :

```ts
  // Tours et journal (lot 5)
  ordonnerTours(groupId: string, ordre: string[]): Promise<void>;
  /** Tirage côté serveur, inscrit au journal ; renvoie les noms dans le nouvel ordre. */
  tirerAuSort(groupId: string): Promise<string[]>;
  echangerTours(a: string, b: string): Promise<void>;
  remplacerBeneficiaire(remiseId: string, membershipId: string): Promise<void>;
  /** `ecart` = montant remis − montant attendu. */
  enregistrerRemise(remiseId: string, montant: number, moyen: MoyenPaiement, reference: string | null): Promise<{ ecart: number }>;
  nouveauTour(groupId: string): Promise<number>;
  /** 50 entrées au plus, de la plus récente à la plus ancienne ; `avant` = identifiant de la dernière entrée déjà affichée. */
  lireJournal(groupId: string, avant?: number): Promise<EntreeJournal[]>;
```

`app/src/lib/supabaseApi.ts` :
- dans les deux `sb.from("groups").select("id, name, type, amount, frequency, beneficiaries_per_cycle, current_round")`, remplacer la liste par `"id, name, type, amount, frequency, beneficiaries_per_cycle, current_round, order_locked"` ;
- dans `chargerGroupe`, remplacer :

```ts
      const [g, m, c, d] = await Promise.all([
```

par :

```ts
      const [g, m, c, d, r] = await Promise.all([
```

et ajouter, après la ligne `sb.from("debts")…eq("group_id", groupId),` du même `Promise.all` :

```ts
        sb.from("payouts").select("id, cycle_id, round, membership_id, amount_expected, amount, status, paid_on").eq("group_id", groupId),
```

puis, après `const dettes = must(d) as VueGroupe["dettes"];` :

```ts
      const remises = must(r) as VueGroupe["remises"];
```

et remplacer `groupe, membres, cycles, paiements, dettes,` (dans le `return` de `chargerGroupe`) par `groupe, membres, cycles, paiements, dettes, remises,` ;
- ajouter à l'import des types `EntreeJournal` et `MoyenPaiement` s'ils n'y sont pas ;
- ajouter les méthodes, après `abonner` :

```ts
    async ordonnerTours(groupId, ordre) { must(await sb.rpc("ordonner_tours", { p_group: groupId, p_order: ordre })); },
    async tirerAuSort(groupId) { return must(await sb.rpc("tirer_au_sort", { p_group: groupId })) as string[]; },
    async echangerTours(a, b) { must(await sb.rpc("echanger_tours", { p_a: a, p_b: b })); },
    async remplacerBeneficiaire(remiseId, membershipId) {
      must(await sb.rpc("remplacer_beneficiaire", { p_payout: remiseId, p_membership: membershipId }));
    },
    async enregistrerRemise(remiseId, montant, moyen, reference) {
      return must(await sb.rpc("enregistrer_remise", { p_payout: remiseId, p_amount: montant, p_method: moyen, p_reference: reference })) as
        { ecart: number };
    },
    async nouveauTour(groupId) { return must(await sb.rpc("nouveau_tour", { p_group: groupId })) as number; },
    async lireJournal(groupId, avant) {
      const lignes = must(await sb.rpc("lire_journal", { p_group: groupId, p_avant: avant ?? null, p_limite: 50 })) as
        (Omit<EntreeJournal, "id"> & { id: number | string })[];
      return lignes.map((e) => ({ ...e, id: Number(e.id) }));   // bigint : PostgREST peut le renvoyer en texte
    },
```

`app/src/test/fauxApi.ts`, après `abonner: …,` :

```ts
    ordonnerTours: vi.fn(async () => {}),
    tirerAuSort: vi.fn(async () => ["Bob", "Tina", "Ines", "Alice"]),
    echangerTours: vi.fn(async () => {}),
    remplacerBeneficiaire: vi.fn(async () => {}),
    enregistrerRemise: vi.fn(async () => ({ ecart: 0 })),
    nouveauTour: vi.fn(async () => 2),
    lireJournal: vi.fn(async () => [] as EntreeJournal[]),
```

et `import type { Api, EntreeJournal, VueGroupe } from "../lib/types";`.

- [ ] **Step 3: Vérifier**

Run: `cd D:\njangi237\app && npm run build`
Expected: build OK.
Run: `cd D:\njangi237\app && npm test`
Expected: 118 tests passent.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/types.ts app/src/lib/supabaseApi.ts app/src/test/fauxApi.ts
git commit -m "Lot 5 : Api des tours (ordre, tirage, échange, remplacement, remise, nouveau tour) et du journal"
```

---

### Task 4: onglet Tours

**Files:**
- Create: `app/src/ui/groupe/OngletTours.tsx`, `app/src/ui/groupe/OngletTours.test.tsx`

**Interfaces:**
- Consumes: `etatTour`, `deplacer`, `montantPropose` (Task 2) ; `bilanCycle(cycle, membres, paiements).collecte` (`lib/cycle.ts`) ; méthodes Api de Task 3 ; `Confirmer`, `Champ`.
- Produces: `OngletTours({ api, vue, recharger }: { api: Api; vue: VueGroupe; recharger: () => void })`.

- [ ] **Step 1: Écrire les tests**

`app/src/ui/groupe/OngletTours.test.tsx` :

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletTours } from "./OngletTours";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";
import type { VueGroupe } from "../../lib/types";

afterEach(cleanup);
const ordre = () => within(screen.getByRole("list", { name: "Ordre des tours" })).getAllByRole("listitem").map((li) => li.textContent);
const nonVerrouille = (): VueGroupe => {
  const v = vueTest();
  return { ...v, groupe: { ...v.groupe, order_locked: false }, cycles: [], paiements: [], remises: [] };
};

describe("onglet Tours", () => {
  it("avant verrouillage : monter un membre puis enregistrer l'ordre", async () => {
    const api = fauxApi(); const recharger = vi.fn();
    render(<OngletTours api={api} vue={nonVerrouille()} recharger={recharger} />);
    expect((screen.getByRole("button", { name: "Enregistrer l'ordre" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Monter Bob" }));
    expect(ordre()[1]).toContain("Bob");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer l'ordre" }));
    expect(api.ordonnerTours).toHaveBeenCalledWith("g1", ["m-tina", "m-bob", "m-alice", "m-ines"]);
    expect(recharger).toHaveBeenCalled();
  });

  it("tirage au sort : confirmation, puis résultat affiché", async () => {
    const api = fauxApi();
    render(<OngletTours api={api} vue={nonVerrouille()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Tirer au sort" }));
    expect(api.tirerAuSort).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("dialog", { name: "Tirer au sort l'ordre ?" })).getByRole("button", { name: "Tirer au sort" }));
    expect(api.tirerAuSort).toHaveBeenCalledWith("g1");
    expect(await screen.findByText("Ordre tiré au sort : 1. Bob, 2. Tina, 3. Ines, 4. Alice")).toBeTruthy();
  });

  it("après verrouillage : pas de réglage, bénéficiaire affiché, échange entre membres non servis", async () => {
    const api = fauxApi();
    const v = vueTest();
    v.remises.push({ id: "r-sep", cycle_id: "c-sep", round: 1, membership_id: "m-bob", amount_expected: 20000, amount: 20000,
      status: "remis", paid_on: "2026-09-30" });
    render(<OngletTours api={api} vue={v} recharger={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Monter Bob" })).toBeNull();
    expect(ordre()[0]).toContain("Bénéficiaire · Octobre 2026");
    expect(ordre()[2]).toContain("A reçu sa part");
    await userEvent.click(screen.getByRole("button", { name: "Échanger deux tours" }));
    const premier = screen.getByLabelText("Premier membre") as HTMLSelectElement;
    expect([...premier.options].map((o) => o.text)).not.toContain("Bob");   // déjà servi
    await userEvent.selectOptions(premier, "m-alice");
    await userEvent.selectOptions(screen.getByLabelText("Second membre"), "m-ines");
    await userEvent.click(screen.getByRole("button", { name: "Échanger" }));
    expect(api.echangerTours).toHaveBeenCalledWith("m-alice", "m-ines");
  });

  it("remise : montant proposé, référence exigée pour MoMo, écart affiché", async () => {
    const api = fauxApi();
    api.enregistrerRemise.mockResolvedValueOnce({ ecart: -15000 });
    render(<OngletTours api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Remettre la cagnotte à Tina" }));
    expect((screen.getByLabelText("Montant remis (FCFA)") as HTMLInputElement).value).toBe("5000");   // collecté 5 000 ÷ 1
    await userEvent.selectOptions(screen.getByLabelText("Moyen"), "mtn_momo");
    const valider = screen.getByRole("button", { name: "Enregistrer la remise" }) as HTMLButtonElement;
    expect(valider.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Référence de la transaction"), "MP9");
    await userEvent.click(valider);
    expect(api.enregistrerRemise).toHaveBeenCalledWith("r-oct", 5000, "mtn_momo", "MP9");
    expect(await screen.findByText(/Cagnotte remise à Tina : 5 000 FCFA\. Écart avec le montant attendu : −15 000 FCFA/)).toBeTruthy();
  });

  it("remplacer le bénéficiaire par un membre non servi", async () => {
    const api = fauxApi();
    render(<OngletTours api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Remplacer Tina" }));
    await userEvent.selectOptions(screen.getByLabelText("Nouveau bénéficiaire"), "m-bob");
    await userEvent.click(screen.getByRole("button", { name: "Confirmer le remplacement" }));
    expect(api.remplacerBeneficiaire).toHaveBeenCalledWith("r-oct", "m-bob");
  });

  it("tour terminé : nouveau tour après confirmation", async () => {
    const api = fauxApi();
    const v = vueTest();
    v.cycles = [{ ...v.cycles[0]!, status: "clos", closed_at: "2026-10-30T20:00:00Z" }];
    v.remises = v.membres.map((m, i) => ({ id: `r${i}`, cycle_id: "c-oct", round: 1, membership_id: m.id, amount_expected: 20000,
      amount: 20000, status: "remis" as const, paid_on: "2026-10-30" }));
    render(<OngletTours api={api} vue={v} recharger={vi.fn()} />);
    expect(screen.getByText("Tour 1 terminé 🎉")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Commencer le tour 2" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Commencer le tour 2 ?" })).getByRole("button", { name: "Commencer" }));
    expect(api.nouveauTour).toHaveBeenCalledWith("g1");
  });

  it("refus de la base : message affiché", async () => {
    const api = fauxApi();
    api.ordonnerTours.mockRejectedValueOnce(new Error("L'ordre est verrouillé : utilisez l'échange de tours"));
    render(<OngletTours api={api} vue={nonVerrouille()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Descendre Tina" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer l'ordre" }));
    expect((await screen.findByRole("alert")).textContent).toContain("verrouillé");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd D:\njangi237\app && npx vitest run src/ui/groupe/OngletTours.test.tsx`
Expected: FAIL — `./OngletTours` introuvable.

- [ ] **Step 3: Écrire l'écran**

`app/src/ui/groupe/OngletTours.tsx` :

```tsx
import { useState } from "react";
import { bilanCycle } from "../../lib/cycle";
import { dateCourte, fcfa } from "../../lib/format";
import { deplacer, etatTour, montantPropose } from "../../lib/tours";
import type { Api, MoyenPaiement, Remise, VueGroupe } from "../../lib/types";
import { Champ } from "../Champ";
import { Confirmer } from "../Confirmer";

const MOYENS: [MoyenPaiement, string][] = [["especes", "Espèces"], ["mtn_momo", "MTN MoMo"], ["orange_money", "Orange Money"], ["autre", "Autre"]];
const ecartTexte = (e: number) => (e === 0 ? "" : ` Écart avec le montant attendu : ${e > 0 ? "+" : "−"}${fcfa(Math.abs(e))}.`);

interface SaisieRemise { remise: Remise; nom: string; montant: string; moyen: MoyenPaiement; reference: string }

/** Onglet Tours du trésorier d'une tontine : ordre, tirage, échanges, remises de la cagnotte, nouveau tour. */
export function OngletTours({ api, vue, recharger }: { api: Api; vue: VueGroupe; recharger: () => void }) {
  const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [occupe, setOccupe] = useState(false);
  const [brouillon, setBrouillon] = useState<string[] | null>(null);
  const [confirmer, setConfirmer] = useState<"tirage" | "nouveau" | null>(null);
  const [echange, setEchange] = useState<{ a: string; b: string } | null>(null);
  const [saisie, setSaisie] = useState<SaisieRemise | null>(null);
  const [remplacement, setRemplacement] = useState<{ remise: Remise; par: string } | null>(null);

  const g = vue.groupe;
  if (g.type !== "tontine") return <p className="note">Les tours ne concernent que les tontines.</p>;
  const etat = etatTour(vue.membres, vue.remises, g.current_round);
  const nom = (id: string) => vue.membres.find((m) => m.id === id)?.display_name ?? "?";
  const cycle = (id: string) => vue.cycles.find((c) => c.id === id);
  const nonServis = etat.lignes.filter((l) => !l.servi).map((l) => l.membre);
  const dernierClos = [...vue.cycles].reverse().find((c) => c.status === "clos");
  const ids = brouillon ?? etat.lignes.map((l) => l.membre.id);

  const agir = async (f: () => Promise<string>) => {
    setOccupe(true); setErr(""); setInfo("");
    try { setInfo(await f()); recharger(); } catch (e) { setErr((e as Error).message); } finally { setOccupe(false); }
  };

  const ouvrirRemise = (r: Remise) => {
    const c = cycle(r.cycle_id);
    const connu = c && (c.status === "ouvert" || c.id === dernierClos?.id);
    const collecte = connu ? bilanCycle(c, vue.membres, vue.paiements).collecte : null;
    setSaisie({ remise: r, nom: nom(r.membership_id), montant: String(montantPropose(r, collecte, g.beneficiaries_per_cycle)),
      moyen: "especes", reference: "" });
  };
  const montant = saisie ? parseInt(saisie.montant || "0", 10) : 0;
  const saisieValide = saisie && montant > 0
    && !((saisie.moyen === "mtn_momo" || saisie.moyen === "orange_money") && !saisie.reference.trim());

  return (
    <section>
      {err && <p className="alerte flottante" role="alert">{err}</p>}
      {info && <p className="ok">{info}</p>}

      {etat.termine && (
        <div className="carte succes">
          <h3>Tour {g.current_round} terminé 🎉</h3>
          <p className="note">Tous les membres ont reçu leur part.</p>
          <button className="btn principal" onClick={() => setConfirmer("nouveau")}>Commencer le tour {g.current_round + 1}</button>
        </div>)}

      <div className="carte">
        <div className="ligne"><h3>Ordre des tours</h3><span className="note">Tour {g.current_round}</span></div>
        <p className="note">{g.order_locked
          ? "Ordre verrouillé depuis l'ouverture du premier cycle du tour : seul l'échange de deux tours reste possible."
          : "Réglez l'ordre à la main ou tirez-le au sort. Il sera verrouillé à l'ouverture du premier cycle."}</p>
        <ol className="liste tours" aria-label="Ordre des tours">
          {ids.map((id, i) => {
            const l = etat.lignes.find((x) => x.membre.id === id)!;
            const n = l.membre.display_name;
            return (
              <li key={id} className="ligne">
                <span><b>{i + 1}.</b> {n}</span>
                {g.order_locked ? (
                  <span className={l.servi ? "pastille paye" : l.prevu ? "pastille declare" : "note"}>
                    {l.servi ? `A reçu sa part ✓${l.servi.paid_on ? ` (${dateCourte(l.servi.paid_on).slice(0, 5)})` : ""}`
                      : l.prevu ? `Bénéficiaire · ${cycle(l.prevu.cycle_id)?.label ?? "cycle"}` : ""}
                  </span>
                ) : (
                  <span className="actions" style={{ margin: 0 }}>
                    <button className="btn petit" aria-label={`Monter ${n}`} disabled={i === 0}
                      onClick={() => setBrouillon(deplacer(ids, i, -1))}>↑</button>
                    <button className="btn petit" aria-label={`Descendre ${n}`} disabled={i === ids.length - 1}
                      onClick={() => setBrouillon(deplacer(ids, i, 1))}>↓</button>
                  </span>)}
              </li>);
          })}
        </ol>
        {!g.order_locked ? (
          <div className="actions">
            <button className="btn principal" disabled={!brouillon || occupe}
              onClick={() => agir(async () => { await api.ordonnerTours(g.id, ids); setBrouillon(null); return "Ordre des tours enregistré."; })}>
              Enregistrer l'ordre</button>
            <button className="btn" disabled={occupe} onClick={() => setConfirmer("tirage")}>Tirer au sort</button>
          </div>
        ) : !echange && nonServis.length >= 2 && (
          <button className="btn" onClick={() => setEchange({ a: "", b: "" })}>Échanger deux tours</button>)}
      </div>

      {confirmer === "tirage" && <Confirmer titre="Tirer au sort l'ordre ?" libelle="Tirer au sort" occupe={occupe}
        message="Le tirage est fait par le serveur et inscrit au journal, visible de tous les membres. Il remplace l'ordre actuel."
        onNon={() => setConfirmer(null)}
        onOui={() => agir(async () => {
          const noms = await api.tirerAuSort(g.id); setConfirmer(null); setBrouillon(null);
          return `Ordre tiré au sort : ${noms.map((x, i) => `${i + 1}. ${x}`).join(", ")}`;
        })} />}

      {confirmer === "nouveau" && <Confirmer titre={`Commencer le tour ${g.current_round + 1} ?`} libelle="Commencer" occupe={occupe}
        message="L'ordre sera de nouveau modifiable (à la main ou par tirage) jusqu'à l'ouverture du premier cycle."
        onNon={() => setConfirmer(null)}
        onOui={() => agir(async () => {
          const n = await api.nouveauTour(g.id); setConfirmer(null);
          return `Tour ${n} commencé : réglez l'ordre ou tirez-le au sort, puis ouvrez le premier cycle.`;
        })} />}

      {echange && (
        <div className="carte confirmer">
          <h3>Échanger deux tours</h3>
          {(["a", "b"] as const).map((k) => (
            <label key={k} className="champ"><span>{k === "a" ? "Premier membre" : "Second membre"}</span>
              <select value={echange[k]} onChange={(e) => setEchange({ ...echange, [k]: e.target.value })}>
                <option value="">Choisir…</option>
                {nonServis.filter((m) => m.id !== (k === "a" ? echange.b : echange.a))
                  .map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select></label>))}
          <p className="note">L'échange est inscrit au journal, visible des membres.</p>
          <div className="ligne">
            <button className="btn" onClick={() => setEchange(null)} disabled={occupe}>Annuler</button>
            <button className="btn principal" disabled={!echange.a || !echange.b || occupe}
              onClick={() => agir(async () => {
                await api.echangerTours(echange.a, echange.b); setEchange(null);
                return `Tours échangés entre ${nom(echange.a)} et ${nom(echange.b)}.`;
              })}>Échanger</button>
          </div>
        </div>)}

      {etat.aRemettre.length > 0 && (
        <div className="carte">
          <h3>Cagnottes à remettre</h3>
          <ul className="liste">{etat.aRemettre.map((r) => (
            <li key={r.id} className="carte" style={{ marginBottom: 8 }}>
              <div className="ligne"><b>{nom(r.membership_id)}</b><span className="note">{cycle(r.cycle_id)?.label ?? ""}</span></div>
              <p className="note">Montant attendu : {fcfa(r.amount_expected)}</p>
              <div className="actions">
                <button className="btn principal petit" onClick={() => ouvrirRemise(r)}>Remettre la cagnotte à {nom(r.membership_id)}</button>
                <button className="btn petit" aria-label={`Remplacer ${nom(r.membership_id)}`}
                  onClick={() => setRemplacement({ remise: r, par: "" })}>Remplacer</button>
              </div>
            </li>))}
          </ul>
        </div>)}

      {remplacement && (
        <div className="carte confirmer">
          <h3>Remplacer {nom(remplacement.remise.membership_id)}</h3>
          <label className="champ"><span>Nouveau bénéficiaire</span>
            <select value={remplacement.par} onChange={(e) => setRemplacement({ ...remplacement, par: e.target.value })}>
              <option value="">Choisir…</option>
              {nonServis.filter((m) => m.id !== remplacement.remise.membership_id)
                .map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select></label>
          <p className="note">Les deux membres échangent leur tour ; l'échange est inscrit au journal.</p>
          <div className="ligne">
            <button className="btn" onClick={() => setRemplacement(null)} disabled={occupe}>Annuler</button>
            <button className="btn principal" disabled={!remplacement.par || occupe}
              onClick={() => agir(async () => {
                await api.remplacerBeneficiaire(remplacement.remise.id, remplacement.par); setRemplacement(null);
                return `${nom(remplacement.par)} devient bénéficiaire à la place de ${nom(remplacement.remise.membership_id)}.`;
              })}>Confirmer le remplacement</button>
          </div>
        </div>)}

      {saisie && (
        <form className="carte confirmer" onSubmit={(e) => {
          e.preventDefault();
          if (!saisieValide) return;
          agir(async () => {
            const { ecart } = await api.enregistrerRemise(saisie.remise.id, montant, saisie.moyen, saisie.reference.trim() || null);
            setSaisie(null);
            return `Cagnotte remise à ${saisie.nom} : ${fcfa(montant)}.${ecartTexte(ecart)}`;
          });
        }}>
          <h3>Remettre la cagnotte à {saisie.nom}</h3>
          <Champ label="Montant remis (FCFA)" inputMode="numeric" value={saisie.montant}
            onChange={(e) => setSaisie({ ...saisie, montant: e.target.value.replace(/\D/g, "") })}
            aide={`Proposé : collecté ÷ ${g.beneficiaries_per_cycle} bénéficiaire${g.beneficiaries_per_cycle > 1 ? "s" : ""}. Attendu : ${fcfa(saisie.remise.amount_expected)}.`} />
          <label className="champ"><span>Moyen</span>
            <select value={saisie.moyen} onChange={(e) => setSaisie({ ...saisie, moyen: e.target.value as MoyenPaiement })}>
              {MOYENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          {saisie.moyen !== "especes" && <Champ label="Référence de la transaction" value={saisie.reference}
            onChange={(e) => setSaisie({ ...saisie, reference: e.target.value })} />}
          <div className="ligne">
            <button type="button" className="btn" onClick={() => setSaisie(null)} disabled={occupe}>Annuler</button>
            <button className="btn principal" disabled={!saisieValide || occupe}>Enregistrer la remise</button>
          </div>
        </form>)}
    </section>
  );
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd D:\njangi237\app && npx vitest run src/ui/groupe/OngletTours.test.tsx`
Expected: 7 tests passent.
Run: `cd D:\njangi237\app && npm test && npm run build`
Expected: 125 tests passent ; build OK.

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/groupe/OngletTours.tsx app/src/ui/groupe/OngletTours.test.tsx
git commit -m "Lot 5 : onglet Tours (ordre, tirage, échange, remplacement, remise de la cagnotte, nouveau tour)"
```

---

### Task 5: onglet Journal et quatre onglets

**Files:**
- Create: `app/src/ui/groupe/OngletJournal.tsx`, `app/src/ui/groupe/OngletJournal.test.tsx`
- Modify: `app/src/ui/groupe/Groupe.tsx`, `app/src/ui/groupe/Groupe.test.tsx`

**Interfaces:**
- Consumes: `api.lireJournal`, `libelleJournal`, `EntreeJournal`, `OngletTours`, `OngletGroupe`.
- Produces: `OngletJournal({ api, groupId }: { api: Api; groupId: string })`.

- [ ] **Step 1: Écrire les tests**

`app/src/ui/groupe/OngletJournal.test.tsx` :

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletJournal } from "./OngletJournal";
import { fauxApi } from "../../test/fauxApi";
import type { EntreeJournal } from "../../lib/types";

afterEach(cleanup);
const entree = (id: number, action = "cycle_ouvert", visible = true): EntreeJournal =>
  ({ id, action, details: { cycle: `C${id}` }, created_at: "2026-10-16T09:05:00Z", auteur: id % 2 ? "Tina" : null, visible });

describe("onglet Journal", () => {
  it("phrases lisibles, auteur, mention « visible des membres »", async () => {
    const api = fauxApi();
    api.lireJournal.mockResolvedValueOnce([entree(3), entree(2, "cycle_rouvert", false)]);
    render(<OngletJournal api={api} groupId="g1" />);
    expect(await screen.findByText("Cycle « C3 » ouvert")).toBeTruthy();
    expect(screen.getByText("Cycle « C2 » rouvert")).toBeTruthy();
    expect(screen.getByText(/Tina/)).toBeTruthy();
    expect(screen.getAllByText("Visible des membres")).toHaveLength(1);
    expect(api.lireJournal).toHaveBeenCalledWith("g1", undefined);
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull();
  });

  it("50 entrées : « Voir plus » charge la suite avant la dernière affichée", async () => {
    const api = fauxApi();
    api.lireJournal.mockResolvedValueOnce(Array.from({ length: 50 }, (_, i) => entree(100 - i)))
      .mockResolvedValueOnce([entree(10)]);
    render(<OngletJournal api={api} groupId="g1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Voir plus" }));
    expect(api.lireJournal).toHaveBeenLastCalledWith("g1", 51);
    expect(await screen.findByText("Cycle « C10 » ouvert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Voir plus" })).toBeNull();
  });

  it("journal vide, puis erreur de chargement", async () => {
    const api = fauxApi();
    render(<OngletJournal api={api} groupId="g1" />);
    expect(await screen.findByText("Aucune action enregistrée pour l'instant.")).toBeTruthy();
    cleanup();
    api.lireJournal.mockRejectedValueOnce(new Error("Pas de réseau : réessayez quand la connexion revient"));
    render(<OngletJournal api={api} groupId="g1" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Pas de réseau");
  });
});
```

Ajouter à la fin du `describe` de `app/src/ui/groupe/Groupe.test.tsx` (avant la dernière ligne `});`) :

```tsx
  it("trésorier d'une tontine : quatre onglets ; Tours masqué pour une cotisation", async () => {
    const api = fauxApi();
    render(<Groupe api={api} id="g1" onglet="tours" personId="u-tina" stockage={stockageMemoire()} />);
    expect(await screen.findByRole("list", { name: "Ordre des tours" })).toBeTruthy();
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(expect.arrayContaining(["Cycle", "Membres", "Tours", "Journal"]));
    cleanup();
    const v = vueTest();
    render(<Groupe api={fauxApi({ ...v, groupe: { ...v.groupe, type: "cotisation" } })} id="g1" onglet="journal" personId="u-tina"
      stockage={stockageMemoire()} />);
    expect(await screen.findByText("Aucune action enregistrée pour l'instant.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Tours" })).toBeNull();
  });
```

(Si `cleanup` ou `vueTest` ne sont pas déjà importés dans ce fichier, les ajouter aux imports existants.)

- [ ] **Step 2: Vérifier l'échec**

Run: `cd D:\njangi237\app && npx vitest run src/ui/groupe/OngletJournal.test.tsx src/ui/groupe/Groupe.test.tsx`
Expected: FAIL — `./OngletJournal` introuvable ; onglets Tours/Journal absents.

- [ ] **Step 3: Écrire le code**

`app/src/ui/groupe/OngletJournal.tsx` :

```tsx
import { useEffect, useState } from "react";
import { libelleJournal } from "../../lib/journal";
import type { Api, EntreeJournal } from "../../lib/types";

const PAGE = 50;
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Journal du groupe (trésorier) : de la plus récente à la plus ancienne action, par pages de 50. */
export function OngletJournal({ api, groupId }: { api: Api; groupId: string }) {
  const [entrees, setEntrees] = useState<EntreeJournal[] | null>(null);
  const [encore, setEncore] = useState(false);
  const [err, setErr] = useState(""); const [occupe, setOccupe] = useState(false);

  const charger = async (avant?: number) => {
    setOccupe(true); setErr("");
    try {
      const page = await api.lireJournal(groupId, avant);
      setEntrees((e) => (avant === undefined ? page : [...(e ?? []), ...page]));
      setEncore(page.length === PAGE);
    } catch (e) { setErr((e as Error).message); } finally { setOccupe(false); }
  };
  useEffect(() => { void charger(); }, [groupId]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      {err && <p className="alerte" role="alert">{err}</p>}
      {entrees === null ? (!err && <p className="note">Chargement…</p>)
        : entrees.length === 0 ? <p className="note">Aucune action enregistrée pour l'instant.</p>
        : (
          <ul className="liste">{entrees.map((e) => (
            <li key={e.id} className="carte" style={{ gap: 4 }}>
              <span>{libelleJournal(e)}</span>
              <span className="note">{quand(e.created_at)}{e.auteur ? ` · ${e.auteur}` : ""}</span>
              {e.visible && <span className="pastille" style={{ justifySelf: "start" }}>Visible des membres</span>}
            </li>))}
          </ul>)}
      {encore && <button className="btn" disabled={occupe} onClick={() => charger(entrees![entrees!.length - 1]!.id)}>Voir plus</button>}
    </section>
  );
}
```

`app/src/ui/groupe/Groupe.tsx` :
- ajouter les imports `import { OngletJournal } from "./OngletJournal";` et `import { OngletTours } from "./OngletTours";` ;
- remplacer le bloc `<nav className="onglets">…</nav>` par :

```tsx
      <nav className="onglets">
        <a href={`#/groupe/${id}`} className={onglet === "cycle" ? "actif" : ""}>Cycle</a>
        <a href={`#/groupe/${id}/membres`} className={onglet === "membres" ? "actif" : ""}>Membres</a>
        {vue.groupe.type === "tontine" && <a href={`#/groupe/${id}/tours`} className={onglet === "tours" ? "actif" : ""}>Tours</a>}
        <a href={`#/groupe/${id}/journal`} className={onglet === "journal" ? "actif" : ""}>Journal</a>
      </nav>
```

- remplacer la ligne `{onglet === "cycle" ? <OngletCycle … /> : <OngletMembres … />}` par :

```tsx
        {onglet === "membres" ? <OngletMembres api={api} vue={vue} recharger={recharger} />
          : onglet === "tours" && vue.groupe.type === "tontine" ? <OngletTours api={api} vue={vue} recharger={recharger} />
          : onglet === "journal" ? <OngletJournal key={`${vue.cycles.length}-${vue.remises.filter((r) => r.status === "remis").length}`}
            api={api} groupId={id} />
          : <OngletCycle api={api} vue={vue} recharger={recharger} />}
```

(La clé de `OngletJournal` le recharge quand un cycle s'ouvre ou qu'une cagnotte est remise, via le temps réel du groupe.)

- [ ] **Step 4: Vérifier le succès**

Run: `cd D:\njangi237\app && npm test && npm run build`
Expected: 129 tests passent ; build OK.

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/groupe
git commit -m "Lot 5 : onglet Journal et navigation Cycle / Membres / Tours / Journal"
```

---

### Task 6: mise en ligne et essai réel

**Files:**
- Modify: `README.md` (section v2)

- [ ] **Step 1: Appliquer la migration sur Supabase** (projet `jviedpdlyqixpfynekqs`) avec l'outil `apply_migration`, nom `0008_journal`, contenu de `supabase/migrations/0008_journal.sql`. Vérifier : `select proname from pg_proc where proname = 'lire_journal';` → 1 ligne.

- [ ] **Step 2: Publier l'application**

Run: `cd D:\njangi237\app && npm run build && npx wrangler pages deploy dist --project-name njangi237 --branch v2 --commit-dirty=true`
Expected: « Deployment complete », alias https://v2.njangi237.pages.dev.

- [ ] **Step 3: Essai réel avec Olivier** (« Groupe test », tontine) — étapes à lui donner :
1. Onglet **Journal** : les actions passées (cycles, contestations, invitations) s'affichent avec l'auteur.
2. Onglet **Tours** : l'ordre est verrouillé (des cycles ont déjà été ouverts dans le tour 1) ; le bénéficiaire du cycle ouvert est affiché.
3. **Remettre la cagnotte** au bénéficiaire (espèces, montant proposé) → message avec l'écart ; le membre bénéficiaire voit « a reçu sa part ».
4. **Échanger deux tours** entre deux membres non servis → le journal l'affiche, visible des membres.
Vérifier ensuite en SQL : `select action, details from journal where group_id = '<Groupe test>' order by id desc limit 5;` et `select status, amount from payouts where group_id = '<Groupe test>' order by created_at desc limit 3;`.

- [ ] **Step 4: README et commit**

Dans `README.md`, après le paragraphe « Espace membre (lot 4) … », ajouter :

```markdown
- Tours et journal (lot 5) : onglet Tours des tontines (ordre à la main ou tiré au sort par le serveur, verrouillé à
  l'ouverture du premier cycle du tour ; échange de deux tours ; remplacement d'un bénéficiaire ; remise de la cagnotte
  avec montant proposé « collecté ÷ bénéficiaires » et écart ; nouveau tour quand chacun a reçu sa part). Onglet Journal :
  historique lisible avec l'auteur (`lire_journal`, migration 0008).
```

```bash
git add README.md
git commit -m "Lot 5 : tours et journal en ligne"
```
