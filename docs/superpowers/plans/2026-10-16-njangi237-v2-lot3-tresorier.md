# Njangi237 v2 — Lot 3 : trésorier — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au trésorier son espace de groupe : onglet **Cycle** (ouvrir, suivre, valider/contester, saisir des espèces, relancer par WhatsApp, exporter, clore/rouvrir, encaisser les dettes) et onglet **Membres** (ajouter et inviter, renvoyer un lien, nouveau PIN, rôle, retrait avec aperçu de ce qui reste dû).

**Architecture:** Aucune migration : toutes les fonctions SQL existent depuis le lot 1 (testées). Le calcul de l'état du cycle, les messages de relance, l'export CSV et les libellés sont des fonctions pures testées par Vitest. Les écrans reçoivent l'`Api` en paramètre et sont testés avec React Testing Library sur une fausse `Api` — donc sans compte ni PIN. L'implémentation Supabase de l'`Api` lit directement les tables (le trésorier y a droit par la RLS) et appelle les RPC du lot 1.

**Tech Stack:** React 18.3.1, TypeScript 7.0.2, Vite 8.3.4, Vitest 4.1.11, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/user-event 14.6.7, jsdom 30.1.1, supabase-js 2.118.0.

**Spec:** `docs/superpowers/specs/2026-10-16-njangi237-v2-design.md` — section 5 (écran 4, onglets Cycle et Membres ; écran 5 pour la saisie d'espèces), section 4 (dettes, retrait), section 2 (RPC), lot 3 de la section 9.

### Écarts assumés par rapport à la spec

1. **Onglets Tours et Journal** : lot 5, comme prévu par le découpage. Le lot 3 ne livre que Cycle et Membres.
2. **Espace membre** : lot 4. Dans ce lot, un membre (non trésorier) qui ouvre un groupe voit « Votre espace membre arrive bientôt ».
3. **Temps réel** : lot 4. Ici, l'écran se recharge après chaque action et avec un bouton « Actualiser ».
4. **Corriger un paiement validé** : la spec parle de « valider ou contester » ; on autorise aussi la contestation d'un paiement **validé** tant que le cycle est ouvert (bouton « Annuler ce paiement », motif obligatoire), pour réparer une saisie d'espèces erronée. La base l'accepte déjà.
5. **Export CSV** : séparateur `;` (Excel en français), BOM UTF-8.

## Global Constraints

- Montants en FCFA entiers, affichés `1 000 FCFA` (`toLocaleString("fr-FR")`).
- Les identifiants de paiement d'espèces sont générés côté client (`crypto.randomUUID()`) : la saisie est idempotente.
- Toute action passe par l'`Api` ; après succès, l'écran appelle `recharger()`.
- Libellés d'état : `paye` « Payé », `partiel` « Partiel », `declare` « À valider », `conteste` « Contesté », `retard` « En retard ».
- Boutons d'action d'une ligne : `aria-label` explicite contenant le nom du membre (accessibilité et tests).
- Relance WhatsApp : un message par geste (les navigateurs bloquent l'ouverture de plusieurs fenêtres).
- Je ne saisis aucun PIN sur le vrai projet : la vérification en ligne est faite par Olivier.
- Branche `v2-lot3` ; commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commandes : `cd D:\njangi237\app && npm test` ; `npm run build`.

## Review Focus

1. **Clôture avec des paiements encore « À valider »** : le bouton « Clore » est désactivé et explique pourquoi (la base refuserait de toute façon) → test Task 2 « clôture bloquée ».
2. **Double clic sur « Enregistrer » en espèces** (réseau lent) : un seul paiement — le même identifiant est renvoyé et le bouton est désactivé pendant l'envoi → test Task 2 « espèces : un seul envoi ».
3. **Retrait d'un membre qui a déjà « bouffé »** : le trésorier voit ce qui reste dû avant de confirmer → test Task 3 « retrait avec aperçu ».
4. **Numéro saisi avec espaces ou +237 à l'ajout d'un membre** : accepté (normalisé par la base) ; un doublon affiche le message de la base → test Task 3 « ajout : erreur affichée ».
5. **Relancer quand personne n'est en retard** : message clair, aucune fenêtre ouverte → test Task 1 (`prochaineRelance`) et Task 2.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `app/src/lib/types.ts` (modif.) | Types `Groupe`, `Membre`, `Cycle`, `Paiement`, `Dette`, `VueGroupe`, `ApercuRetrait` ; méthodes `Api` du trésorier |
| `app/src/lib/routes.ts` (modif.) | Route `{ nom: "groupe", id, onglet }` |
| `app/src/lib/format.ts` | `fcfa`, `dateCourte` |
| `app/src/lib/cycle.ts` | `bilanCycle`, `LIBELLE_ETAT` |
| `app/src/lib/relances.ts` | `messageRelance`, `prochaineRelance` |
| `app/src/lib/csv.ts` | `csvCycle` |
| `app/src/lib/libelles.ts` | `libelleParDefaut` |
| `app/src/test/donnees.ts`, `app/src/test/fauxApi.ts` | Jeu de données et fausse `Api` des tests d'écran |
| `app/src/ui/groupe/Groupe.tsx` | Chargement de la vue, onglets |
| `app/src/ui/groupe/OngletCycle.tsx` | Onglet Cycle |
| `app/src/ui/groupe/OngletMembres.tsx` | Onglet Membres |
| `app/src/ui/Confirmer.tsx` | Panneau de confirmation |
| `app/src/lib/supabaseApi.ts` (modif.) | Implémentation Supabase des nouvelles méthodes |
| `app/src/ui/MesGroupes.tsx`, `app/src/ui/Coque.tsx` (modif.) | Accès au groupe |

---

### Task 1: Logique du cycle, des relances et de l'export

**Files:**
- Modify: `app/src/lib/types.ts`, `app/src/lib/routes.ts`, `app/src/lib/routes.test.ts`, `app/vite.config.ts`, `app/tsconfig.json`
- Create: `app/src/lib/format.ts`, `app/src/lib/cycle.ts`, `app/src/lib/relances.ts`, `app/src/lib/csv.ts`, `app/src/lib/libelles.ts`
- Test: `app/src/lib/cycle.test.ts`, `app/src/lib/relances.test.ts`, `app/src/lib/csv.test.ts`, `app/src/lib/libelles.test.ts`

**Interfaces:**
- Produces: types ci-dessous ; `fcfa(n: number): string` ; `dateCourte(iso: string): string` ; `bilanCycle(cycle: Cycle, membres: Membre[], paiements: Paiement[]): Bilan` ; `LIBELLE_ETAT: Record<Etat, string>` ; `messageRelance(nom: string, groupe: string, montant: number, echeance: string | null): string` ; `prochaineRelance(file: string[] | null, enRetard: string[]): { suivant: string | null; file: string[] }` ; `csvCycle(groupe: string, cycle: Cycle, bilan: Bilan): string` ; `libelleParDefaut(date: Date, frequence: Groupe["frequency"]): string` ; route `{ nom: "groupe"; id: string; onglet: "cycle" | "membres" }`.

- [ ] **Step 1: Ajouter les types et les méthodes de l'`Api`**

Dans `app/src/lib/types.ts`, après `export interface LienEnvoye …`, ajouter :
```ts
export type Frequence = "hebdomadaire" | "mensuelle" | "ponctuelle";
export type MoyenPaiement = "mtn_momo" | "orange_money" | "especes" | "autre";
export interface Groupe {
  id: string; name: string; type: string; amount: number; frequency: Frequence;
  beneficiaries_per_cycle: number; current_round: number;
}
export interface Membre {
  id: string; display_name: string; phone: string; role: RoleGroupe; status: "invite" | "actif" | "retire";
  position: number | null; person_id: string | null; left_balance: number | null;
}
export interface Cycle {
  id: string; round: number; number: number; label: string; due_date: string | null; amount_expected: number;
  status: "ouvert" | "clos"; opened_at: string; closed_at: string | null;
}
export interface Paiement {
  id: string; cycle_id: string; membership_id: string; debt_id: string | null; amount: number; method: MoyenPaiement;
  reference: string | null; paid_on: string; status: "declare" | "valide" | "conteste"; contest_reason: string | null; created_at: string;
}
export interface Dette { id: string; membership_id: string; cycle_id: string; amount: number; settled_at: string | null }
export interface VueGroupe { role: RoleGroupe; groupe: Groupe; membres: Membre[]; cycles: Cycle[]; paiements: Paiement[]; dettes: Dette[] }
export interface ApercuRetrait { deja_servi: boolean; cycles_restants: number; montant_restant: number; dettes: number }
```
Dans l'interface `Api`, après `inviter(…)`, ajouter :
```ts
  // Trésorier (lot 3)
  chargerGroupe(groupId: string): Promise<VueGroupe>;
  ouvrirCycle(groupId: string, libelle: string, echeance: string | null): Promise<void>;
  cloreCycle(cycleId: string): Promise<{ dettes: number; montant: number }>;
  rouvrirCycle(cycleId: string): Promise<void>;
  validerPaiement(paiementId: string): Promise<void>;
  contesterPaiement(paiementId: string, motif: string): Promise<void>;
  /** Espèces remises au trésorier ; `id` généré par l'appelant (idempotence). */
  saisirEspeces(id: string, membershipId: string, cycleId: string, montant: number, detteId?: string): Promise<void>;
  ajouterMembre(groupId: string, nom: string, telephone: string): Promise<string>;
  changerRole(membershipId: string, role: RoleGroupe): Promise<void>;
  apercuRetrait(membershipId: string): Promise<ApercuRetrait>;
  retirerMembre(membershipId: string): Promise<void>;
```
Et remplacer `frequence: "hebdomadaire" | "mensuelle" | "ponctuelle";` dans `NouveauGroupe` par `frequence: Frequence;`.

Dans `app/vite.config.ts`, remplacer `test: { environment: "node", include: ["src/**/*.test.ts"] },` par :
```ts
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
```
Dans `app/tsconfig.json`, remplacer `"exclude": ["src/**/*.test.ts"]` par `"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test"]`.

- [ ] **Step 2: Écrire les tests (échouent)**

`app/src/lib/cycle.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { bilanCycle } from "./cycle";
import type { Cycle, Membre, Paiement } from "./types";

const m = (id: string, nom: string, status: Membre["status"] = "actif", position = 1): Membre =>
  ({ id, display_name: nom, phone: "237690000000", role: "membre", status, position, person_id: null, left_balance: null });
const CYCLE: Cycle = { id: "c1", round: 1, number: 1, label: "Octobre", due_date: "2026-10-30", amount_expected: 5000,
  status: "ouvert", opened_at: "2026-10-01T00:00:00Z", closed_at: null };
const p = (id: string, membre: string, amount: number, status: Paiement["status"], debt_id: string | null = null): Paiement =>
  ({ id, cycle_id: "c1", membership_id: membre, debt_id, amount, method: "especes", reference: null, paid_on: "2026-10-10",
     status, contest_reason: null, created_at: "2026-10-10T10:00:00Z" });

describe("bilanCycle", () => {
  const membres = [m("a", "Alice", "actif", 1), m("b", "Bob", "actif", 2), m("c", "Carine", "invite", 3),
    m("d", "Didier", "actif", 4), m("e", "Eric", "actif", 5), m("r", "Retiré", "retire", 6)];
  const paiements = [
    p("p1", "a", 5000, "valide"),
    p("p2", "b", 5000, "declare"),
    p("p3", "c", 3000, "valide"),
    p("p4", "d", 5000, "conteste"),
    p("p5", "e", 5000, "valide", "dette-1"),   // règlement d'une dette : ne compte pas dans le cycle
  ];
  const b = bilanCycle(CYCLE, membres, paiements);

  it("donne l'état de chaque membre compté, dans l'ordre", () => {
    expect(b.lignes.map((l) => [l.membre.display_name, l.etat])).toEqual([
      ["Alice", "paye"], ["Bob", "declare"], ["Carine", "partiel"], ["Didier", "conteste"], ["Eric", "retard"]]);
    expect(b.lignes[1].enAttente?.id).toBe("p2");
  });
  it("totaux : seuls les paiements validés du cycle comptent", () => {
    expect(b.attendu).toBe(25000);
    expect(b.collecte).toBe(8000);
    expect(b.taux).toBe(32);
    expect(b.aValider).toBe(1);
    expect(b.enRetard.map((l) => l.membre.id)).toEqual(["c", "d", "e"]);
  });
  it("aucun membre : pas de division par zéro", () => {
    expect(bilanCycle(CYCLE, [], []).taux).toBe(0);
  });
});
```

`app/src/lib/relances.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { messageRelance, prochaineRelance } from "./relances";

describe("relances", () => {
  it("message de relance poli, montant et échéance", () => {
    const m = messageRelance("Alice", "Tontine des amis", 5000, "2026-10-30");
    expect(m).toContain("Bonjour Alice");
    expect(m).toContain("5 000 FCFA");
    expect(m).toContain("Tontine des amis");
    expect(m).toContain("30/10/2026");
    expect(messageRelance("Bob", "T", 1000, null)).not.toContain("avant le");
  });
  it("un retardataire par geste, dans l'ordre, puis la file se vide", () => {
    let r = prochaineRelance(null, ["a", "b", "c"]);
    expect(r).toEqual({ suivant: "a", file: ["b", "c"] });
    r = prochaineRelance(r.file, ["b", "c"]);
    expect(r).toEqual({ suivant: "b", file: ["c"] });
    r = prochaineRelance(r.file, ["c"]);
    expect(r).toEqual({ suivant: "c", file: [] });
  });
  it("un membre qui a payé entre-temps est sauté", () => {
    expect(prochaineRelance(["a", "b"], ["b"])).toEqual({ suivant: "b", file: [] });
  });
  it("personne en retard : rien à faire", () => {
    expect(prochaineRelance(null, [])).toEqual({ suivant: null, file: [] });
  });
});
```

`app/src/lib/csv.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { csvCycle } from "./csv";
import { bilanCycle } from "./cycle";
import type { Cycle, Membre, Paiement } from "./types";

describe("csvCycle", () => {
  const CYCLE: Cycle = { id: "c1", round: 1, number: 1, label: "Octobre", due_date: null, amount_expected: 5000,
    status: "ouvert", opened_at: "2026-10-01T00:00:00Z", closed_at: null };
  const membres: Membre[] = [
    { id: "a", display_name: 'Alice "la grande"', phone: "237690000003", role: "membre", status: "actif", position: 1, person_id: null, left_balance: null },
    { id: "b", display_name: "Bob; fils", phone: "237690000004", role: "membre", status: "actif", position: 2, person_id: null, left_balance: null },
  ];
  const paiements: Paiement[] = [{ id: "p1", cycle_id: "c1", membership_id: "a", debt_id: null, amount: 5000, method: "mtn_momo",
    reference: "MP1", paid_on: "2026-10-10", status: "valide", contest_reason: null, created_at: "2026-10-10T10:00:00Z" }];
  const csv = csvCycle("Tontine", CYCLE, bilanCycle(CYCLE, membres, paiements));

  it("BOM, séparateur point-virgule, guillemets échappés", () => {
    const lignes = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(lignes[0]).toBe('"Membre";"Téléphone";"Statut";"Montant validé (FCFA)";"Moyen";"Référence";"Date"');
    expect(lignes[1]).toBe('"Alice ""la grande""";"6 90 00 00 03";"Payé";"5000";"MTN MoMo";"MP1";"10/10/2026"');
    expect(lignes[2]).toBe('"Bob; fils";"6 90 00 00 04";"En retard";"0";"";"";""');
  });
});
```

`app/src/lib/libelles.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { libelleParDefaut } from "./libelles";

describe("libelleParDefaut", () => {
  const d = new Date(2026, 9, 16);   // 16 octobre 2026
  it("mensuel : le mois avec majuscule", () => expect(libelleParDefaut(d, "mensuelle")).toBe("Octobre 2026"));
  it("hebdomadaire : la semaine", () => expect(libelleParDefaut(d, "hebdomadaire")).toBe("Semaine du 16/10/2026"));
  it("ponctuel : la date", () => expect(libelleParDefaut(d, "ponctuelle")).toBe("Cycle du 16/10/2026"));
});
```

Dans `app/src/lib/routes.test.ts`, dans le test « écrans et valeur par défaut », ajouter :
```ts
    expect(lireRoute("#/groupe/abc-123")).toEqual({ nom: "groupe", id: "abc-123", onglet: "cycle" });
    expect(lireRoute("#/groupe/abc-123/membres")).toEqual({ nom: "groupe", id: "abc-123", onglet: "membres" });
    expect(lireRoute("#/groupe/abc-123/inconnu")).toEqual({ nom: "groupe", id: "abc-123", onglet: "cycle" });
```

- [ ] **Step 3: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\app && npm test`
Expected: FAIL — `Cannot find module './cycle'` (et `./relances`, `./csv`, `./libelles`) ; routes : `expected { nom: 'accueil' } to deeply equal { nom: 'groupe', … }`.

- [ ] **Step 4: Écrire les modules**

`app/src/lib/format.ts` :
```ts
/** « 5 000 FCFA » avec une espace ordinaire (toLocaleString met une espace fine insécable, gênante à l'export et en test). */
export const fcfa = (n: number) => `${n.toLocaleString("fr-FR").replace(/[  ]/g, " ")} FCFA`;

/** « 2026-10-30 » ou un horodatage → « 30/10/2026 ». */
export const dateCourte = (iso: string) => {
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
};
```

`app/src/lib/cycle.ts` :
```ts
import type { Cycle, Membre, Paiement } from "./types";

export type Etat = "paye" | "partiel" | "declare" | "conteste" | "retard";
export const LIBELLE_ETAT: Record<Etat, string> = {
  paye: "Payé", partiel: "Partiel", declare: "À valider", conteste: "Contesté", retard: "En retard",
};

export interface LigneCycle {
  membre: Membre; etat: Etat; valide: number;
  /** Déclaration en attente de validation. */
  enAttente: Paiement | null;
  /** Dernier paiement validé (pour l'annuler en cas d'erreur). */
  dernierValide: Paiement | null;
}
export interface Bilan { lignes: LigneCycle[]; attendu: number; collecte: number; taux: number; aValider: number; enRetard: LigneCycle[] }

/** État d'un cycle pour le trésorier : membres comptés (invités compris), paiements ordinaires du cycle seulement. */
export function bilanCycle(cycle: Cycle, membres: Membre[], paiements: Paiement[]): Bilan {
  const comptes = membres.filter((m) => m.status !== "retire")
    .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.display_name.localeCompare(b.display_name, "fr"));
  const duCycle = paiements.filter((p) => p.cycle_id === cycle.id && !p.debt_id);
  const lignes = comptes.map((membre): LigneCycle => {
    const siens = duCycle.filter((p) => p.membership_id === membre.id);
    const valides = siens.filter((p) => p.status === "valide");
    const valide = valides.reduce((s, p) => s + p.amount, 0);
    const enAttente = siens.find((p) => p.status === "declare") ?? null;
    const conteste = siens.some((p) => p.status === "conteste");
    const etat: Etat = valide >= cycle.amount_expected ? "paye" : enAttente ? "declare" : valide > 0 ? "partiel" : conteste ? "conteste" : "retard";
    return { membre, etat, valide, enAttente, dernierValide: valides[valides.length - 1] ?? null };
  });
  const attendu = cycle.amount_expected * comptes.length;
  const collecte = lignes.reduce((s, l) => s + l.valide, 0);
  return {
    lignes, attendu, collecte,
    taux: attendu ? Math.round((collecte * 100) / attendu) : 0,
    aValider: lignes.filter((l) => l.etat === "declare").length,
    enRetard: lignes.filter((l) => l.etat === "retard" || l.etat === "partiel" || l.etat === "conteste"),
  };
}
```

`app/src/lib/relances.ts` :
```ts
import { dateCourte, fcfa } from "./format";

export function messageRelance(nom: string, groupe: string, montant: number, echeance: string | null): string {
  return `Bonjour ${nom}, petit rappel pour votre cotisation de ${fcfa(montant)} à « ${groupe} »` +
    (echeance ? `, à régler avant le ${dateCourte(echeance)}` : "") +
    ". Vous pouvez payer par MTN MoMo ou Orange Money, puis déclarer votre paiement dans Njangi237. Merci !";
}

/**
 * Relance « un par un » : la file est fixée au premier geste ; chaque geste prend le suivant encore en retard.
 * Les navigateurs n'ouvrent qu'une fenêtre par geste de l'utilisateur.
 */
export function prochaineRelance(file: string[] | null, enRetard: string[]): { suivant: string | null; file: string[] } {
  const restante = (file && file.length ? file : enRetard).filter((id) => enRetard.includes(id));
  return { suivant: restante[0] ?? null, file: restante.slice(1) };
}
```

`app/src/lib/csv.ts` :
```ts
import type { Bilan } from "./cycle";
import { LIBELLE_ETAT } from "./cycle";
import { dateCourte } from "./format";
import { afficherTelephone } from "./telephone";
import type { Cycle, MoyenPaiement } from "./types";

const MOYEN: Record<MoyenPaiement, string> = { mtn_momo: "MTN MoMo", orange_money: "Orange Money", especes: "Espèces", autre: "Autre" };
const cellule = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** Suivi d'un cycle pour Excel (séparateur ; et BOM UTF-8). `groupe` et `cycle` servent au nom du fichier côté écran. */
export function csvCycle(_groupe: string, _cycle: Cycle, bilan: Bilan): string {
  const lignes = [["Membre", "Téléphone", "Statut", "Montant validé (FCFA)", "Moyen", "Référence", "Date"]];
  for (const l of bilan.lignes) {
    const p = l.dernierValide;
    lignes.push([l.membre.display_name, afficherTelephone(l.membre.phone), LIBELLE_ETAT[l.etat], String(l.valide),
      p ? MOYEN[p.method] : "", p?.reference ?? "", p ? dateCourte(p.paid_on) : ""]);
  }
  return "\uFEFF" + lignes.map((l) => l.map(cellule).join(";")).join("\r\n");
}
```

`app/src/lib/libelles.ts` :
```ts
import type { Frequence } from "./types";

const jj = (n: number) => String(n).padStart(2, "0");
const dateFr = (d: Date) => `${jj(d.getDate())}/${jj(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Libellé proposé à l'ouverture d'un cycle. */
export function libelleParDefaut(d: Date, frequence: Frequence): string {
  if (frequence === "mensuelle") {
    const m = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  return `${frequence === "hebdomadaire" ? "Semaine du" : "Cycle du"} ${dateFr(d)}`;
}
```

Dans `app/src/lib/routes.ts`, remplacer le type et la fonction par :
```ts
export type Route =
  | { nom: "accueil" } | { nom: "profil" } | { nom: "admin" } | { nom: "amorcer" }
  | { nom: "invitation" | "nouveau-pin"; jeton: string }
  | { nom: "groupe"; id: string; onglet: "cycle" | "membres" };

/** « #/invitation/<jeton> » → { nom: "invitation", jeton } ; tout le reste retombe sur l'accueil. */
export function lireRoute(hash: string): Route {
  const [, a, b, c] = hash.replace(/^#/, "").split("/");
  if ((a === "invitation" || a === "nouveau-pin") && b) return { nom: a, jeton: b };
  if (a === "groupe" && b) return { nom: "groupe", id: b, onglet: c === "membres" ? "membres" : "cycle" };
  if (a === "profil" || a === "admin" || a === "amorcer") return { nom: a };
  return { nom: "accueil" };
}
```

- [ ] **Step 5: Lancer les tests**

Run: `cd D:\njangi237\app && npm test`
Expected: PASS (8 fichiers : les 3 du lot 2 + cycle, relances, csv, libelles ; routes étendu). `npx tsc -b` échoue tant que `supabaseApi.ts` n'implémente pas les nouvelles méthodes : attendu, c'est la Task 4 (ne pas lancer `npm run build` ici).

- [ ] **Step 6: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 3 : logique du cycle, relances, export CSV et route du groupe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Écran du groupe et onglet Cycle

**Files:**
- Modify: `app/package.json` (dépendances de test), `app/src/styles.css`
- Create: `app/src/test/donnees.ts`, `app/src/test/fauxApi.ts`, `app/src/ui/Confirmer.tsx`, `app/src/ui/groupe/Groupe.tsx`, `app/src/ui/groupe/OngletCycle.tsx`
- Test: `app/src/ui/groupe/OngletCycle.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`bilanCycle`, `LIBELLE_ETAT`, `messageRelance`, `prochaineRelance`, `csvCycle`, `libelleParDefaut`, `fcfa`, `dateCourte`, types).
- Produces: `Groupe({ api, id, onglet }: { api: Api; id: string; onglet: "cycle" | "membres" })` ; `OngletCycle({ api, vue, recharger })` ; `Confirmer({ titre, message, libelle, onOui, onNon, occupe? })` ; `vueTest(): VueGroupe`, `fauxApi(vue?: VueGroupe): Api & { appels: … }` (tests).

- [ ] **Step 1: Ajouter les outils de test**

Run: `cd D:\njangi237\app && npm install -D @testing-library/react@16.3.3 @testing-library/dom@10.4.2 @testing-library/user-event@14.6.7 jsdom@30.1.1`
Expected: installation sans erreur.

`app/src/test/donnees.ts` :
```ts
import type { VueGroupe } from "../lib/types";

/** Tontine de 4 membres (Tina trésorière), cycle d'octobre ouvert : Tina a payé, Alice a déclaré, Bob et Ines sont en retard. */
export function vueTest(): VueGroupe {
  const base = { person_id: null, left_balance: null };
  return {
    role: "tresorier",
    groupe: { id: "g1", name: "Tontine des amis", type: "tontine", amount: 5000, frequency: "mensuelle", beneficiaries_per_cycle: 1, current_round: 1 },
    membres: [
      { ...base, id: "m-tina", display_name: "Tina", phone: "237690000002", role: "tresorier", status: "actif", position: 1, person_id: "u-tina" },
      { ...base, id: "m-alice", display_name: "Alice", phone: "237690000003", role: "membre", status: "actif", position: 2, person_id: "u-alice" },
      { ...base, id: "m-bob", display_name: "Bob", phone: "237690000004", role: "membre", status: "actif", position: 3, person_id: "u-bob" },
      { ...base, id: "m-ines", display_name: "Ines", phone: "237690000009", role: "membre", status: "invite", position: 4 },
    ],
    cycles: [{ id: "c-oct", round: 1, number: 1, label: "Octobre 2026", due_date: "2026-10-30", amount_expected: 5000,
      status: "ouvert", opened_at: "2026-10-01T08:00:00Z", closed_at: null }],
    paiements: [
      { id: "p-tina", cycle_id: "c-oct", membership_id: "m-tina", debt_id: null, amount: 5000, method: "especes", reference: null,
        paid_on: "2026-10-02", status: "valide", contest_reason: null, created_at: "2026-10-02T09:00:00Z" },
      { id: "p-alice", cycle_id: "c-oct", membership_id: "m-alice", debt_id: null, amount: 5000, method: "mtn_momo", reference: "MP42",
        paid_on: "2026-10-05", status: "declare", contest_reason: null, created_at: "2026-10-05T09:00:00Z" },
    ],
    dettes: [],
  };
}
```

`app/src/test/fauxApi.ts` :
```ts
import { vi } from "vitest";
import type { Api, VueGroupe } from "../lib/types";
import { vueTest } from "./donnees";

/** Fausse Api : chaque méthode est un vi.fn() qui réussit ; chargerGroupe renvoie la vue fournie. */
export function fauxApi(vue: VueGroupe = vueTest()) {
  const lien = { lien: "https://x/#/invitation/J", whatsapp: "https://wa.me/237690000009?text=x", expire: "2026-10-23T10:00:00Z", nom: "Ines" };
  const api = {
    session: vi.fn(), connexion: vi.fn(), quitter: vi.fn(), apercu: vi.fn(), accepter: vi.fn(), nouveauPin: vi.fn(),
    changerPin: vi.fn(), amorcer: vi.fn(), mesGroupes: vi.fn(async () => []), creerGroupe: vi.fn(),
    inviter: vi.fn(async () => lien),
    chargerGroupe: vi.fn(async () => vue),
    ouvrirCycle: vi.fn(async () => {}), cloreCycle: vi.fn(async () => ({ dettes: 2, montant: 10000 })), rouvrirCycle: vi.fn(async () => {}),
    validerPaiement: vi.fn(async () => {}), contesterPaiement: vi.fn(async () => {}), saisirEspeces: vi.fn(async () => {}),
    ajouterMembre: vi.fn(async () => "m-nouveau"), changerRole: vi.fn(async () => {}),
    apercuRetrait: vi.fn(async () => ({ deja_servi: false, cycles_restants: 1, montant_restant: 5000, dettes: 0 })),
    retirerMembre: vi.fn(async () => {}),
  } satisfies Api;
  return api;
}
```

- [ ] **Step 2: Écrire le test de l'onglet Cycle (échoue)**

`app/src/ui/groupe/OngletCycle.test.tsx` :
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletCycle } from "./OngletCycle";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";

afterEach(cleanup);
const ligne = (nom: string) => screen.getByText(nom, { selector: "b" }).closest("li")!;

describe("onglet Cycle", () => {
  it("affiche le bilan et l'état de chaque membre", () => {
    render(<OngletCycle api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    expect(screen.getByText("Octobre 2026")).toBeTruthy();
    expect(screen.getByText("5 000 FCFA")).toBeTruthy();          // collecté
    expect(screen.getByText("25 %")).toBeTruthy();
    expect(ligne("Tina").textContent).toContain("Payé");
    expect(ligne("Alice").textContent).toContain("À valider");
    expect(ligne("Bob").textContent).toContain("En retard");
  });

  it("valider une déclaration", async () => {
    const api = fauxApi(); const recharger = vi.fn();
    render(<OngletCycle api={api} vue={vueTest()} recharger={recharger} />);
    await userEvent.click(screen.getByRole("button", { name: "Valider le paiement d'Alice" }));
    expect(api.validerPaiement).toHaveBeenCalledWith("p-alice");
    expect(recharger).toHaveBeenCalled();
  });

  it("contester exige un motif", async () => {
    const api = fauxApi();
    render(<OngletCycle api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Contester le paiement d'Alice" }));
    const envoyer = screen.getByRole("button", { name: "Confirmer la contestation" });
    expect((envoyer as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Motif"), "Référence introuvable");
    await userEvent.click(envoyer);
    expect(api.contesterPaiement).toHaveBeenCalledWith("p-alice", "Référence introuvable");
  });

  it("espèces : montant proposé, un seul envoi même en cas de double clic", async () => {
    const api = fauxApi();
    let fini!: () => void;
    api.saisirEspeces.mockImplementation(() => new Promise<void>((r) => { fini = r; }));
    render(<OngletCycle api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Saisir des espèces pour Bob" }));
    const montant = screen.getByLabelText("Montant reçu (FCFA)") as HTMLInputElement;
    expect(montant.value).toBe("5000");
    const enregistrer = screen.getByRole("button", { name: "Enregistrer les espèces" });
    await userEvent.dblClick(enregistrer);
    expect(api.saisirEspeces).toHaveBeenCalledTimes(1);
    const [id, membre, cycle, somme] = api.saisirEspeces.mock.calls[0];
    expect([membre, cycle, somme]).toEqual(["m-bob", "c-oct", 5000]);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    fini();
  });

  it("relance : un retardataire par geste, puis plus personne", async () => {
    const ouvert = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<OngletCycle api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    const bouton = () => screen.getByRole("button", { name: /Relancer/ });
    await userEvent.click(bouton());
    expect(ouvert.mock.calls[0][0]).toContain("wa.me/237690000004");   // Bob
    expect(bouton().textContent).toContain("1 restant");
    await userEvent.click(bouton());
    expect(ouvert.mock.calls[1][0]).toContain("wa.me/237690000009");   // Ines
    expect(bouton().textContent).toBe("Relancer les retardataires");
    ouvert.mockRestore();
  });

  it("clôture bloquée tant qu'un paiement attend la validation", () => {
    render(<OngletCycle api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Clore le cycle" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/1 paiement à valider avant de clore/)).toBeTruthy();
  });

  it("clôture : confirmation avec le nombre de dettes, puis bilan", async () => {
    const vue = vueTest(); vue.paiements = vue.paiements.filter((p) => p.id !== "p-alice");
    const api = fauxApi(vue);
    render(<OngletCycle api={api} vue={vue} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Clore le cycle" }));
    expect(screen.getByText(/3 membres deviendront débiteurs/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Oui, clore" }));
    expect(api.cloreCycle).toHaveBeenCalledWith("c-oct");
  });

  it("aucun cycle ouvert : ouverture avec un libellé proposé", async () => {
    const vue = vueTest(); vue.cycles = []; vue.paiements = [];
    const api = fauxApi(vue);
    render(<OngletCycle api={api} vue={vue} recharger={vi.fn()} />);
    const libelle = screen.getByLabelText("Libellé du cycle") as HTMLInputElement;
    expect(libelle.value.length).toBeGreaterThan(3);
    await userEvent.clear(libelle); await userEvent.type(libelle, "Novembre 2026");
    await userEvent.click(screen.getByRole("button", { name: "Ouvrir le cycle" }));
    expect(api.ouvrirCycle).toHaveBeenCalledWith("g1", "Novembre 2026", null);
  });

  it("dettes : encaissement en espèces de la dette entière", async () => {
    const vue = vueTest();
    vue.cycles = [{ ...vue.cycles[0], id: "c-sep", label: "Septembre 2026", status: "clos", closed_at: "2026-09-30T20:00:00Z" }, ...vue.cycles];
    vue.dettes = [{ id: "d-bob", membership_id: "m-bob", cycle_id: "c-sep", amount: 5000, settled_at: null }];
    const api = fauxApi(vue);
    render(<OngletCycle api={api} vue={vue} recharger={vi.fn()} />);
    const dettes = screen.getByRole("region", { name: "Dettes à encaisser" });
    expect(within(dettes).getByText(/Septembre 2026/)).toBeTruthy();
    await userEvent.click(within(dettes).getByRole("button", { name: "Encaisser la dette de Bob" }));
    const [, membre, cycle, somme, dette] = api.saisirEspeces.mock.calls[0];
    expect([membre, cycle, somme, dette]).toEqual(["m-bob", "c-sep", 5000, "d-bob"]);
  });
});
```

- [ ] **Step 3: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\app && npm test`
Expected: FAIL — `Failed to resolve import "./OngletCycle"`.

- [ ] **Step 4: Écrire les composants**

`app/src/ui/Confirmer.tsx` :
```tsx
/** Panneau de confirmation dans la page (pas de window.confirm : il bloque l'interface et se teste mal). */
export function Confirmer({ titre, message, libelle, onOui, onNon, occupe }: {
  titre: string; message: string; libelle: string; onOui: () => void; onNon: () => void; occupe?: boolean;
}) {
  return (
    <div className="carte confirmer" role="dialog" aria-label={titre}>
      <h3>{titre}</h3>
      <p>{message}</p>
      <div className="ligne">
        <button className="btn" onClick={onNon} disabled={occupe}>Annuler</button>
        <button className="btn principal" onClick={onOui} disabled={occupe}>{libelle}</button>
      </div>
    </div>
  );
}
```

`app/src/ui/groupe/OngletCycle.tsx` :
```tsx
import { useMemo, useRef, useState } from "react";
import { csvCycle } from "../../lib/csv";
import { bilanCycle, LIBELLE_ETAT, type LigneCycle } from "../../lib/cycle";
import { dateCourte, fcfa } from "../../lib/format";
import { libelleParDefaut } from "../../lib/libelles";
import { lienWhatsApp } from "../../lib/liens";
import { messageRelance, prochaineRelance } from "../../lib/relances";
import type { Api, Cycle, Dette, VueGroupe } from "../../lib/types";
import { Confirmer } from "../Confirmer";
import { Champ } from "../Champ";

type Saisie = { membreId: string; nom: string; cycleId: string; montant: string; detteId?: string } | null;

export function OngletCycle({ api, vue, recharger }: { api: Api; vue: VueGroupe; recharger: () => void }) {
  const { groupe, membres, cycles, paiements, dettes } = vue;
  const ouvert = cycles.find((c) => c.status === "ouvert") ?? null;
  const bilan = useMemo(() => (ouvert ? bilanCycle(ouvert, membres, paiements) : null), [ouvert, membres, paiements]);
  const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [occupe, setOccupe] = useState(false);
  const [contestation, setContestation] = useState<{ id: string; nom: string; motif: string } | null>(null);
  const [saisie, setSaisie] = useState<Saisie>(null);
  const [cloture, setCloture] = useState(false);
  const [file, setFile] = useState<string[] | null>(null);

  // Référence (et non état) : un double clic arrive avant que React ait redessiné le bouton désactivé
  const enCours = useRef(false);
  const agir = async (f: () => Promise<unknown>, ok = "") => {
    if (enCours.current) return;
    enCours.current = true; setOccupe(true); setErr(""); setInfo("");
    try { await f(); if (ok) setInfo(ok); recharger(); }
    catch (x) { setErr((x as Error).message); }
    finally { enCours.current = false; setOccupe(false); }
  };

  const nomDe = (id: string) => membres.find((m) => m.id === id)?.display_name ?? "?";
  const cycleDe = (id: string) => cycles.find((c) => c.id === id);

  const relancer = () => {
    if (!bilan || !ouvert) return;
    const enRetard = bilan.enRetard.map((l) => l.membre.id);
    const r = prochaineRelance(file, enRetard);
    if (!r.suivant) { setInfo("Personne n'est en retard."); setFile(null); return; }
    const m = membres.find((x) => x.id === r.suivant)!;
    window.open(lienWhatsApp(m.phone, messageRelance(m.display_name, groupe.name, ouvert.amount_expected, ouvert.due_date)), "_blank");
    setFile(r.file.length ? r.file : null);
  };

  const exporter = () => {
    if (!bilan || !ouvert) return;
    const url = URL.createObjectURL(new Blob([csvCycle(groupe.name, ouvert, bilan)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${groupe.name} - ${ouvert.label}.csv`.replace(/[\\/:*?"<>|]/g, "_");
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const enregistrerEspeces = (s: NonNullable<Saisie>) => {
    const montant = parseInt(s.montant || "0", 10);
    agir(async () => { await api.saisirEspeces(crypto.randomUUID(), s.membreId, s.cycleId, montant, s.detteId); setSaisie(null); },
      `Espèces de ${s.nom} enregistrées (${fcfa(montant)}).`);
  };

  const dettesOuvertes = dettes.filter((d) => !d.settled_at);
  const dernierClos = !ouvert ? [...cycles].reverse().find((c) => c.status === "clos") ?? null : null;

  return (
    <section>
      {err && <p className="alerte">{err}</p>}
      {info && <p className="ok">{info}</p>}

      {ouvert && bilan ? (
        <>
          <div className="carte">
            <div className="ligne"><h2>{ouvert.label}</h2>{ouvert.due_date && <span className="note">avant le {dateCourte(ouvert.due_date)}</span>}</div>
            <div className="chiffres">
              <div><b>{fcfa(bilan.collecte)}</b><span>collecté</span></div>
              <div><b>{bilan.taux} %</b><span>sur {fcfa(bilan.attendu)}</span></div>
              <div><b>{bilan.enRetard.length}</b><span>en retard</span></div>
            </div>
          </div>

          <ul className="liste">
            {bilan.lignes.map((l) => <LigneMembre key={l.membre.id} l={l} occupe={occupe}
              onValider={() => agir(() => api.validerPaiement(l.enAttente!.id), `Paiement de ${l.membre.display_name} validé.`)}
              onContester={(id) => setContestation({ id, nom: l.membre.display_name, motif: "" })}
              onEspeces={() => setSaisie({ membreId: l.membre.id, nom: l.membre.display_name, cycleId: ouvert.id,
                montant: String(Math.max(ouvert.amount_expected - l.valide, 0) || ouvert.amount_expected) })} />)}
          </ul>

          {contestation && (
            <div className="carte">
              <h3>Contester le paiement de {contestation.nom}</h3>
              <Champ label="Motif" value={contestation.motif} onChange={(e) => setContestation({ ...contestation, motif: e.target.value })} autoFocus />
              <div className="ligne">
                <button className="btn" onClick={() => setContestation(null)}>Annuler</button>
                <button className="btn principal" disabled={occupe || !contestation.motif.trim()} aria-label="Confirmer la contestation"
                  onClick={() => agir(async () => { await api.contesterPaiement(contestation.id, contestation.motif.trim()); setContestation(null); },
                    `Paiement de ${contestation.nom} contesté.`)}>Contester</button>
              </div>
            </div>
          )}

          {saisie && <FormEspeces saisie={saisie} occupe={occupe} onChange={setSaisie} onAnnuler={() => setSaisie(null)} onEnregistrer={enregistrerEspeces} />}

          <div className="actions">
            <button className="btn" onClick={relancer}>
              {file && file.length ? `Relancer le suivant (${file.length} restant${file.length > 1 ? "s" : ""})` : "Relancer les retardataires"}
            </button>
            <button className="btn" onClick={exporter}>Exporter (CSV)</button>
            <button className="btn" onClick={recharger}>Actualiser</button>
          </div>

          {bilan.aValider > 0 && <p className="note">{bilan.aValider} paiement{bilan.aValider > 1 ? "s" : ""} à valider avant de clore le cycle.</p>}
          {cloture
            ? <Confirmer titre="Clore le cycle" libelle="Oui, clore" occupe={occupe}
                message={bilan.enRetard.length
                  ? `${bilan.enRetard.length} membres deviendront débiteurs du reste de leur cotisation. Le cycle ne pourra plus recevoir de paiement ordinaire.`
                  : "Tout le monde a payé. Le cycle ne pourra plus recevoir de paiement ordinaire."}
                onNon={() => setCloture(false)}
                onOui={() => agir(async () => {
                  const r = await api.cloreCycle(ouvert.id); setCloture(false);
                  setInfo(r.dettes ? `Cycle clos : ${r.dettes} dette(s) pour ${fcfa(r.montant)}.` : "Cycle clos : tout le monde a payé.");
                })} />
            : <button className="btn" disabled={bilan.aValider > 0 || occupe} onClick={() => setCloture(true)}>Clore le cycle</button>}
        </>
      ) : (
        <NouveauCycle groupeId={groupe.id} frequence={groupe.frequency} occupe={occupe}
          onOuvrir={(libelle, echeance) => agir(() => api.ouvrirCycle(groupe.id, libelle, echeance), `Cycle « ${libelle} » ouvert.`)} />
      )}

      {dernierClos && (
        <p className="note">Dernier cycle : {dernierClos.label} (clos).{" "}
          <button className="lien" disabled={occupe} onClick={() => agir(() => api.rouvrirCycle(dernierClos.id), `Cycle « ${dernierClos.label} » rouvert.`)}>
            Rouvrir</button></p>
      )}

      {dettesOuvertes.length > 0 && (
        <section role="region" aria-label="Dettes à encaisser" className="carte">
          <h3>Dettes à encaisser</h3>
          <ul className="liste">
            {dettesOuvertes.map((d: Dette) => {
              const c: Cycle | undefined = cycleDe(d.cycle_id); const nom = nomDe(d.membership_id);
              return (
                <li key={d.id} className="ligne">
                  <span><b>{nom}</b> · {c?.label ?? "cycle"} · {fcfa(d.amount)}</span>
                  <button className="btn petit" disabled={occupe} aria-label={`Encaisser la dette de ${nom}`}
                    onClick={() => agir(() => api.saisirEspeces(crypto.randomUUID(), d.membership_id, d.cycle_id, d.amount, d.id),
                      `Dette de ${nom} réglée (${fcfa(d.amount)}).`)}>Encaisser</button>
                </li>);
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

function LigneMembre({ l, occupe, onValider, onContester, onEspeces }: {
  l: LigneCycle; occupe: boolean; onValider: () => void; onContester: (paiementId: string) => void; onEspeces: () => void;
}) {
  const nom = l.membre.display_name; const p = l.enAttente;
  return (
    <li className={`carte membre ${l.etat}`}>
      <div className="ligne">
        <span><b>{nom}</b>{l.membre.status === "invite" && <span className="note"> · invité</span>}</span>
        <span className={`pastille ${l.etat}`}>{LIBELLE_ETAT[l.etat]}</span>
      </div>
      {p && <p className="note">Déclaré : {fcfa(p.amount)} · {p.method === "mtn_momo" ? "MTN MoMo" : p.method === "orange_money" ? "Orange Money" : p.method}
        {p.reference ? ` · réf. ${p.reference}` : ""} · {dateCourte(p.paid_on)}</p>}
      {l.valide > 0 && l.etat !== "paye" && <p className="note">Déjà validé : {fcfa(l.valide)}</p>}
      <div className="ligne actions">
        {p && <>
          <button className="btn petit principal" disabled={occupe} aria-label={`Valider le paiement de ${nom}`} onClick={onValider}>Valider</button>
          <button className="btn petit" disabled={occupe} aria-label={`Contester le paiement de ${nom}`} onClick={() => onContester(p.id)}>Contester</button>
        </>}
        {!p && l.etat !== "paye" && <button className="btn petit" disabled={occupe} aria-label={`Saisir des espèces pour ${nom}`} onClick={onEspeces}>Espèces</button>}
        {l.dernierValide && !p && <button className="lien" disabled={occupe} aria-label={`Annuler le paiement de ${nom}`}
          onClick={() => onContester(l.dernierValide!.id)}>Annuler ce paiement</button>}
      </div>
    </li>
  );
}

function FormEspeces({ saisie, occupe, onChange, onAnnuler, onEnregistrer }: {
  saisie: NonNullable<Saisie>; occupe: boolean; onChange: (s: Saisie) => void; onAnnuler: () => void; onEnregistrer: (s: NonNullable<Saisie>) => void;
}) {
  const montant = parseInt(saisie.montant || "0", 10);
  return (
    <div className="carte">
      <h3>Espèces remises par {saisie.nom}</h3>
      <Champ label="Montant reçu (FCFA)" value={saisie.montant} inputMode="numeric" autoFocus
        onChange={(e) => onChange({ ...saisie, montant: e.target.value.replace(/\D/g, "") })} />
      <div className="ligne">
        <button className="btn" onClick={onAnnuler} disabled={occupe}>Annuler</button>
        <button className="btn principal" disabled={occupe || montant <= 0} aria-label="Enregistrer les espèces"
          onClick={() => onEnregistrer(saisie)}>Enregistrer</button>
      </div>
    </div>
  );
}

function NouveauCycle({ groupeId, frequence, occupe, onOuvrir }: {
  groupeId: string; frequence: VueGroupe["groupe"]["frequency"]; occupe: boolean; onOuvrir: (libelle: string, echeance: string | null) => void;
}) {
  const [libelle, setLibelle] = useState(() => libelleParDefaut(new Date(), frequence));
  const [echeance, setEcheance] = useState("");
  return (
    <form className="carte" data-groupe={groupeId} onSubmit={(e) => { e.preventDefault(); onOuvrir(libelle.trim(), echeance || null); }}>
      <h2>Aucun cycle en cours</h2>
      <Champ label="Libellé du cycle" value={libelle} onChange={(e) => setLibelle(e.target.value)} required />
      <Champ label="Date limite de paiement (facultatif)" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
      <button className="btn principal" disabled={occupe || !libelle.trim()}>Ouvrir le cycle</button>
    </form>
  );
}
```

`app/src/ui/groupe/Groupe.tsx` :
```tsx
import { useCallback, useEffect, useState } from "react";
import type { Api, VueGroupe } from "../../lib/types";
import { OngletCycle } from "./OngletCycle";
import { OngletMembres } from "./OngletMembres";

/** Espace d'un groupe. Le trésorier y gère cycles et membres ; l'espace membre arrive au lot 4. */
export function Groupe({ api, id, onglet }: { api: Api; id: string; onglet: "cycle" | "membres" }) {
  const [vue, setVue] = useState<VueGroupe | null>(null); const [err, setErr] = useState("");
  const recharger = useCallback(() => { api.chargerGroupe(id).then(setVue).catch((e) => setErr((e as Error).message)); }, [api, id]);
  useEffect(() => { recharger(); }, [recharger]);

  if (err) return <p className="alerte">{err}</p>;
  if (!vue) return <p className="note">Chargement…</p>;
  if (vue.role !== "tresorier") return (
    <section className="carte"><h2>{vue.groupe.name}</h2><p>Votre espace membre arrive bientôt : vous pourrez y déclarer vos paiements et suivre les tours.</p>
      <a className="btn" href="#/">Retour à mes groupes</a></section>);
  return (
    <section>
      <div className="ligne"><h2>{vue.groupe.name}</h2><a className="lien" href="#/">← Mes groupes</a></div>
      <nav className="onglets">
        <a href={`#/groupe/${id}`} className={onglet === "cycle" ? "actif" : ""}>Cycle</a>
        <a href={`#/groupe/${id}/membres`} className={onglet === "membres" ? "actif" : ""}>Membres</a>
      </nav>
      {onglet === "cycle" ? <OngletCycle api={api} vue={vue} recharger={recharger} /> : <OngletMembres api={api} vue={vue} recharger={recharger} />}
    </section>
  );
}
```

Créer un `app/src/ui/groupe/OngletMembres.tsx` provisoire (remplacé à la Task 3) pour que `Groupe.tsx` compile :
```tsx
import type { Api, VueGroupe } from "../../lib/types";
export function OngletMembres(_: { api: Api; vue: VueGroupe; recharger: () => void }) { return null; }
```

Ajouter à la fin de `app/src/styles.css` :
```css
.chiffres { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; }
.chiffres b { display: block; font-family: var(--serif); font-size: 18px; font-weight: 400; }
.chiffres span { font-size: 12px; color: var(--ink-soft); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.actions .btn { width: auto; flex: 1 1 auto; }
.btn.petit { padding: 7px 12px; font-size: 13px; width: auto; }
.lien { background: none; border: none; color: var(--brand); font: 600 13px var(--sans); cursor: pointer; padding: 4px 0; text-decoration: underline; }
.membre { gap: 6px; }
.pastille.paye { background: var(--ok-soft); color: var(--brand-dark); }
.pastille.declare { background: var(--gold-soft); color: #7A5A16; }
.pastille.retard, .pastille.conteste { background: var(--brick-soft); color: var(--brick); }
.pastille.partiel { background: var(--sunken); }
.onglets { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin: 8px 0 12px; }
.onglets a { padding: 8px 14px; color: var(--ink-soft); text-decoration: none; border-bottom: 3px solid transparent; }
.onglets a.actif { color: var(--brand); border-color: var(--gold); font-weight: 600; }
.confirmer { border-color: var(--gold); }
a.groupe-lien { color: inherit; text-decoration: none; display: block; }
```

- [ ] **Step 5: Lancer les tests**

Run: `cd D:\njangi237\app && npm test`
Expected: PASS — les 9 tests d'`OngletCycle.test.tsx` et les précédents.

- [ ] **Step 6: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 3 : onglet Cycle du trésorier (validation, espèces, relances, clôture, dettes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Onglet Membres

**Files:**
- Modify (remplace le provisoire) : `app/src/ui/groupe/OngletMembres.tsx`
- Test: `app/src/ui/groupe/OngletMembres.test.tsx`

**Interfaces:**
- Consumes: `Lien` (lot 2), `Confirmer` (Task 2), `afficherTelephone`, `fcfa`, `fauxApi`, `vueTest`.
- Produces: `OngletMembres({ api, vue, recharger })`.

- [ ] **Step 1: Écrire le test (échoue)**

`app/src/ui/groupe/OngletMembres.test.tsx` :
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OngletMembres } from "./OngletMembres";
import { fauxApi } from "../../test/fauxApi";
import { vueTest } from "../../test/donnees";

afterEach(cleanup);

describe("onglet Membres", () => {
  it("liste les membres avec numéro, rôle et statut", () => {
    render(<OngletMembres api={fauxApi()} vue={vueTest()} recharger={vi.fn()} />);
    expect(screen.getByText("6 90 00 00 04")).toBeTruthy();
    expect(screen.getByText("Trésorier")).toBeTruthy();
    expect(screen.getByText(/Invitation en attente/)).toBeTruthy();
  });

  it("ajouter un membre puis l'inviter par WhatsApp", async () => {
    const api = fauxApi(); const recharger = vi.fn();
    render(<OngletMembres api={api} vue={vueTest()} recharger={recharger} />);
    await userEvent.type(screen.getByLabelText("Nom"), "Jean");
    await userEvent.type(screen.getByLabelText("Numéro"), "+237 677 00 00 01");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter et inviter" }));
    expect(api.ajouterMembre).toHaveBeenCalledWith("g1", "Jean", "+237 677 00 00 01");
    expect(api.inviter).toHaveBeenCalledWith("m-nouveau", "invitation");
    expect(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toContain("wa.me");
    expect(recharger).toHaveBeenCalled();
  });

  it("ajout : l'erreur de la base est affichée", async () => {
    const api = fauxApi();
    api.ajouterMembre.mockRejectedValueOnce(new Error("Ce numéro est déjà dans le groupe"));
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Nom"), "Bob bis");
    await userEvent.type(screen.getByLabelText("Numéro"), "690000004");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter et inviter" }));
    expect(screen.getByText("Ce numéro est déjà dans le groupe")).toBeTruthy();
    expect(api.inviter).not.toHaveBeenCalled();
  });

  it("renvoyer l'invitation d'un invité, nouveau PIN pour un membre actif", async () => {
    const api = fauxApi();
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Renvoyer l'invitation à Ines" }));
    expect(api.inviter).toHaveBeenLastCalledWith("m-ines", "invitation");
    await userEvent.click(screen.getByRole("button", { name: "Lien nouveau PIN pour Bob" }));
    expect(api.inviter).toHaveBeenLastCalledWith("m-bob", "reinitialisation");
  });

  it("nommer trésorier", async () => {
    const api = fauxApi();
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Nommer Alice trésorier" }));
    expect(api.changerRole).toHaveBeenCalledWith("m-alice", "tresorier");
  });

  it("retrait avec aperçu de ce qui reste dû", async () => {
    const api = fauxApi();
    api.apercuRetrait.mockResolvedValueOnce({ deja_servi: true, cycles_restants: 3, montant_restant: 15000, dettes: 5000 });
    render(<OngletMembres api={api} vue={vueTest()} recharger={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Retirer Bob" }));
    expect(api.apercuRetrait).toHaveBeenCalledWith("m-bob");
    const dialogue = await screen.findByRole("dialog", { name: "Retirer Bob" });
    expect(dialogue.textContent).toContain("déjà reçu sa part");
    expect(dialogue.textContent).toContain("15 000 FCFA");
    expect(dialogue.textContent).toContain("5 000 FCFA");
    await userEvent.click(screen.getByRole("button", { name: "Oui, retirer" }));
    expect(api.retirerMembre).toHaveBeenCalledWith("m-bob");
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\app && npm test`
Expected: FAIL — le composant provisoire ne rend rien (`Unable to find an element with the text: 6 90 00 00 04`).

- [ ] **Step 3: Écrire l'onglet**

`app/src/ui/groupe/OngletMembres.tsx` :
```tsx
import { useRef, useState } from "react";
import { fcfa } from "../../lib/format";
import { afficherTelephone } from "../../lib/telephone";
import type { Api, ApercuRetrait, LienEnvoye, Membre, VueGroupe } from "../../lib/types";
import { Champ } from "../Champ";
import { Confirmer } from "../Confirmer";
import { Lien } from "../Lien";

export function OngletMembres({ api, vue, recharger }: { api: Api; vue: VueGroupe; recharger: () => void }) {
  const [nom, setNom] = useState(""); const [tel, setTel] = useState("");
  const [envoi, setEnvoi] = useState<{ lien: LienEnvoye; titre: string } | null>(null);
  const [retrait, setRetrait] = useState<{ membre: Membre; apercu: ApercuRetrait } | null>(null);
  const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [occupe, setOccupe] = useState(false);

  // Référence (et non état) : un double clic arrive avant que React ait redessiné le bouton désactivé
  const enCours = useRef(false);
  const agir = async (f: () => Promise<unknown>, ok = "") => {
    if (enCours.current) return;
    enCours.current = true; setOccupe(true); setErr(""); setInfo("");
    try { await f(); if (ok) setInfo(ok); recharger(); }
    catch (x) { setErr((x as Error).message); }
    finally { enCours.current = false; setOccupe(false); }
  };

  const ajouter = (e: React.FormEvent) => {
    e.preventDefault();
    agir(async () => {
      const id = await api.ajouterMembre(vue.groupe.id, nom.trim(), tel);
      setEnvoi({ lien: await api.inviter(id, "invitation"), titre: `${nom.trim()} ajouté(e) : envoyez-lui son invitation` });
      setNom(""); setTel("");
    });
  };
  const lien = (m: Membre, type: "invitation" | "reinitialisation") => agir(async () => {
    setEnvoi({ lien: await api.inviter(m.id, type), titre: type === "invitation" ? `Invitation de ${m.display_name}` : `Nouveau PIN pour ${m.display_name}` });
  });
  const preparerRetrait = (m: Membre) => agir(async () => setRetrait({ membre: m, apercu: await api.apercuRetrait(m.id) }));

  const presents = vue.membres.filter((m) => m.status !== "retire");
  const partis = vue.membres.filter((m) => m.status === "retire");

  return (
    <section>
      {err && <p className="alerte">{err}</p>}
      {info && <p className="ok">{info}</p>}
      {envoi && <Lien envoi={envoi.lien} titre={envoi.titre} />}
      {retrait && (
        <Confirmer titre={`Retirer ${retrait.membre.display_name}`} libelle="Oui, retirer" occupe={occupe}
          message={messageRetrait(retrait.membre, retrait.apercu)} onNon={() => setRetrait(null)}
          onOui={() => agir(async () => { await api.retirerMembre(retrait.membre.id); setRetrait(null); }, `${retrait.membre.display_name} retiré(e) du groupe.`)} />
      )}

      <form className="carte" onSubmit={ajouter}>
        <h3>Ajouter un membre</h3>
        <Champ label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <Champ label="Numéro" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="6XX XX XX XX" required />
        <button className="btn principal" disabled={occupe || !nom.trim() || !tel.trim()}>Ajouter et inviter</button>
      </form>

      <ul className="liste">
        {presents.map((m) => (
          <li key={m.id} className="carte membre">
            <div className="ligne">
              <span><b>{m.display_name}</b> <span className="note">{afficherTelephone(m.phone)}</span></span>
              {m.role === "tresorier" && <span className="pastille tresorier">Trésorier</span>}
            </div>
            {m.status === "invite" && <p className="note">Invitation en attente</p>}
            <div className="ligne actions">
              {m.status === "invite"
                ? <button className="btn petit" disabled={occupe} aria-label={`Renvoyer l'invitation à ${m.display_name}`} onClick={() => lien(m, "invitation")}>Renvoyer l'invitation</button>
                : <button className="btn petit" disabled={occupe} aria-label={`Lien nouveau PIN pour ${m.display_name}`} onClick={() => lien(m, "reinitialisation")}>Nouveau PIN</button>}
              {m.role === "membre"
                ? <button className="lien" disabled={occupe} aria-label={`Nommer ${m.display_name} trésorier`}
                    onClick={() => agir(() => api.changerRole(m.id, "tresorier"), `${m.display_name} est trésorier.`)}>Nommer trésorier</button>
                : <button className="lien" disabled={occupe} aria-label={`Retirer le rôle de trésorier à ${m.display_name}`}
                    onClick={() => agir(() => api.changerRole(m.id, "membre"), `${m.display_name} n'est plus trésorier.`)}>Retirer le rôle</button>}
              <button className="lien danger" disabled={occupe} aria-label={`Retirer ${m.display_name}`} onClick={() => preparerRetrait(m)}>Retirer</button>
            </div>
          </li>))}
      </ul>

      {partis.length > 0 && (
        <details className="carte"><summary>Membres partis ({partis.length})</summary>
          <ul className="liste">{partis.map((m) => (
            <li key={m.id} className="ligne"><span>{m.display_name}</span>
              {m.left_balance ? <span className="note">doit encore {fcfa(m.left_balance)}</span> : <span className="note">à jour</span>}</li>))}
          </ul></details>
      )}
    </section>
  );
}

function messageRetrait(m: Membre, a: ApercuRetrait): string {
  const parts = [`${m.display_name} ne fera plus partie du groupe.`];
  if (a.deja_servi) parts.push(`Il/elle a déjà reçu sa part : il reste ${a.cycles_restants} cycle(s) à payer, soit ${fcfa(a.montant_restant)}.`);
  else if (a.montant_restant > 0) parts.push(`Cotisation du cycle en cours encore due : ${fcfa(a.montant_restant)}.`);
  if (a.dettes > 0) parts.push(`Dettes non réglées : ${fcfa(a.dettes)}.`);
  parts.push("Ces montants resteront visibles dans la liste des membres partis.");
  return parts.join(" ");
}
```

Ajouter à `app/src/styles.css` :
```css
.lien.danger { color: var(--brick); }
details summary { cursor: pointer; font-weight: 600; }
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\app && npm test`
Expected: PASS (6 tests de l'onglet Membres + tous les précédents).

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 3 : onglet Membres (ajout, invitations, nouveau PIN, rôles, retrait)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Accès Supabase et navigation

**Files:**
- Modify: `app/src/lib/supabaseApi.ts`, `app/src/ui/MesGroupes.tsx`, `app/src/ui/Coque.tsx`

**Interfaces:**
- Consumes: RPC du lot 1 (`ouvrir_cycle`, `clore_cycle`, `rouvrir_cycle`, `valider_paiement`, `contester_paiement`, `saisir_especes`, `ajouter_membre`, `changer_role`, `apercu_retrait`, `retirer_membre`), tables `groups`, `memberships`, `cycles`, `payments`, `debts`.
- Produces: implémentation Supabase complète de l'`Api` ; accès « Mes groupes » → `#/groupe/<id>`.

- [ ] **Step 1: Vérifier que la compilation échoue**

Run: `cd D:\njangi237\app && npx tsc -b`
Expected: FAIL — `Type '…' is missing the following properties from type 'Api': chargerGroupe, ouvrirCycle, …` dans `supabaseApi.ts`.

- [ ] **Step 2: Implémenter les méthodes**

Dans `app/src/lib/supabaseApi.ts`, compléter l'import des types :
```ts
import type { Api, ApercuRetrait, LienEnvoye, MonGroupe, Personne, VueGroupe } from "./types";
```
puis ajouter dans l'objet `api`, après `inviter,` :
```ts
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
```
- [ ] **Step 3: Brancher la navigation**

Dans `app/src/ui/MesGroupes.tsx`, remplacer le `<li …>…</li>` de la liste par :
```tsx
        <li key={g.membership_id} className="carte groupe">
          <a className="groupe-lien" href={`#/groupe/${g.groupe.id}`}>
            <div className="ligne"><h3>{g.groupe.name}</h3>
              <span className={`pastille ${g.role}`}>{g.role === "tresorier" ? "Trésorier" : "Membre"}</span></div>
            <p className="note">{TYPE[g.groupe.type] ?? "Groupe"} · {g.groupe.frequency} · {fcfa(g.groupe.amount)} par cycle</p>
          </a>
        </li>))}
```

Dans `app/src/ui/Coque.tsx` : importer `import { Groupe } from "./groupe/Groupe";`, et remplacer
```tsx
        {onglet === "accueil" && <MesGroupes api={api} />}
```
par
```tsx
        {onglet === "accueil" && (route.nom === "groupe"
          ? <Groupe key={route.id} api={api} id={route.id} onglet={route.onglet} />
          : <MesGroupes api={api} />)}
```

- [ ] **Step 4: Compiler et tester**

Run: `cd D:\njangi237\app && npm test && npm run build`
Expected: tests PASS ; `tsc -b` sans erreur ; `vite build` OK.

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 3 : accès Supabase du trésorier et navigation vers le groupe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Mise en ligne et essai réel

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: tout le lot. Aucun changement de base ni de fonction serveur.

- [ ] **Step 1: Publier sur la branche v2**

Run: `cd D:\njangi237\app && npm run build && npx wrangler pages deploy dist --project-name njangi237 --branch v2 --commit-dirty=true`
Expected: « Deployment complete » ; `https://v2.njangi237.pages.dev/` répond.

- [ ] **Step 2: Essai réel par Olivier (point d'arrêt)**

Guider Olivier sur le « Groupe test » (il en est trésorier), puis vérifier la base par SQL après chaque étape :
1. Mes groupes → « Groupe test » → onglet Cycle → « Ouvrir le cycle » (libellé proposé). Vérifier : un cycle `ouvert`, un `payouts` `prevu` (tontine).
2. Onglet Membres → ajouter un membre de test (numéro d'un proche ou un numéro à lui) → lien WhatsApp affiché. Vérifier : adhésion `invite`, une invitation.
3. Onglet Cycle → « Espèces » pour ce membre invité → 1 000 FCFA. Vérifier : paiement `valide`, `especes`.
4. « Exporter (CSV) » → le fichier s'ouvre dans Excel avec les accents et les colonnes séparées.
5. « Clore le cycle » → confirmation → bilan des dettes (lui-même est en retard : 1 dette de 1 000 FCFA). Vérifier : cycle `clos`, dette créée. Puis « Encaisser » sa dette → dette réglée.
6. Onglet Membres → « Retirer » le membre de test → l'aperçu s'affiche → confirmer.

- [ ] **Step 3: Documenter et commit**

Dans `README.md`, section v2, ajouter après la ligne de l'application :
```markdown
- Espace trésorier (lot 3) : onglets Cycle (ouvrir/clore/rouvrir, valider/contester, espèces, relances WhatsApp, export CSV, dettes) et Membres (ajout + invitation, nouveau PIN, rôles, retrait avec aperçu). Tests d'écran sans compte : `npm test` (React Testing Library, fausse Api).
```
```bash
cd D:\njangi237 && git add README.md && git commit -m "Lot 3 : espace trésorier en ligne

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
