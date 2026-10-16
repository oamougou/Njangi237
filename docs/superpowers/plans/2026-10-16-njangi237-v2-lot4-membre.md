# Njangi237 v2 — Lot 4 : espace membre, hors ligne, temps réel — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au membre son espace (cycle en cours, déclaration de paiement MoMo/OM/espèces, dettes, bénéficiaires, ordre des tours avec date estimée, historique), faire fonctionner l'application avec un réseau faible (dernières données gardées sur le téléphone, déclarations mises en file et envoyées au retour du réseau) et rafraîchir les écrans en temps réel ; enrichir « Mes groupes » (à payer / payé / à valider).

**Architecture:** Aucune migration : les lectures du membre passent par la RLS et les fonctions `ordre_tours`/`recouvrement` (lot 1), la déclaration par `declarer_paiement` (idempotente). Logique pure testée (état du membre, estimation du tour, file d'envoi, mémoire locale, erreurs réseau) ; un hook `useVue` réunit chargement, mémoire locale, état hors ligne et abonnement temps réel, réutilisé par l'espace membre et l'espace trésorier. Écrans testés avec la fausse `Api` et une mémoire locale en RAM.

**Tech Stack:** React 18.3.1, TypeScript 7.0.2, Vitest 4.1.11, React Testing Library 16.3.3, supabase-js 2.118.0 (Realtime `postgres_changes`), `localStorage`.

**Spec:** `docs/superpowers/specs/2026-10-16-njangi237-v2-design.md` — section 5 (écrans 2, 3, 5 ; « Temps réel » ; « Hors ligne et réseau faible »), section 4 (date estimée du tour), lot 4 de la section 9.

### Écarts assumés par rapport à la spec

1. **Mémoire locale en `localStorage`** au lieu d'IndexedDB/Dexie : quelques Ko par groupe, aucune dépendance ajoutée, lecture synchrone (affichage immédiat). Si un jour la taille dépassait ~5 Mo, on passerait à IndexedDB derrière la même interface `Stockage`.
2. **File hors ligne limitée aux déclarations des membres** : la saisie d'espèces du trésorier reste « Nécessite le réseau » dans ce lot (l'espace trésorier devient consultable hors ligne mais ses boutons sont désactivés). Raison : un seul chemin d'envoi différé à fiabiliser d'abord ; les espèces pourront rejoindre la même file plus tard.
3. **Ordre des tours côté membre en lecture seule** ; tirage, échanges et remises restent au lot 5.

## Global Constraints

- Une déclaration porte un identifiant tiré au moment de la saisie (`crypto.randomUUID()`) : renvoyée autant de fois que nécessaire, elle n'est enregistrée qu'une fois (`declarer_paiement` renvoie `duplicate`).
- Référence obligatoire pour MTN MoMo et Orange Money (même règle que la base) ; montant entier > 0 ; date ≤ aujourd'hui.
- Une erreur réseau (pas de réponse) met en file ; une erreur de la base (refus) est affichée et la déclaration est marquée « refusée » dans la file, jamais renvoyée en boucle.
- Hors ligne : bandeau « Hors ligne · données du JJ/MM à HH:MM » ; toute action autre que « Déclarer mon paiement » est désactivée avec la mention « Nécessite le réseau ».
- Temps réel : une rafale de changements ne provoque qu'un rechargement (regroupement 400 ms) ; l'abonnement est fermé en quittant l'écran.
- Clés de mémoire locale préfixées `njangi.` ; aucune donnée d'un autre utilisateur n'est relue : la clé inclut l'identifiant de la personne connectée.
- Branche `v2-lot4` ; commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commandes : `cd D:\njangi237\app && npm test` ; `npm run build`.

## Review Focus

1. **Déclaration envoyée sans réseau puis réseau retrouvé** : elle part automatiquement, une seule fois, et l'écran passe à « En attente de validation » → tests Task 1 (`viderFile`) et Task 4 (« hors ligne : mise en file »).
2. **Déclaration refusée par la base pendant l'envoi différé** (cycle clos entre-temps) : elle n'est pas renvoyée en boucle, le membre voit le motif → test Task 1 « refus de la base ».
3. **Téléphone partagé** (deux personnes se connectent tour à tour) : la mémoire locale de l'une n'est jamais affichée à l'autre → test Task 3 « clé par personne ».
4. **Paiement contesté** : le membre voit le motif et peut déclarer à nouveau → test Task 4.
5. **Membre arrivé après l'ouverture du cycle** : rien à payer pour ce cycle (« Pas concerné »), pas de bouton Déclarer → test Task 1 (`monEtat`) et Task 4.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `app/src/lib/erreurs.ts` | `ErreurReseau`, `versErreur`, `estReseau` |
| `app/src/lib/horsLigne.ts` | `Stockage` (navigateur / mémoire), mémoire des vues, file des déclarations, `viderFile` |
| `app/src/lib/etatMembre.ts` | `monEtat` : état du membre dans un cycle |
| `app/src/lib/tours.ts` | `estimerTour` |
| `app/src/lib/useVue.ts` | Hook : chargement + mémoire + hors ligne + temps réel |
| `app/src/lib/envoi.ts` | `demarrerEnvoi` : vide la file au démarrage et au retour du réseau |
| `app/src/lib/types.ts`, `supabaseApi.ts` (modif.) | `VueMembre`, `Declaration`, `ResumeGroupe`, nouvelles méthodes `Api` |
| `app/src/ui/membre/EspaceMembre.tsx`, `FormDeclaration.tsx` | Espace membre |
| `app/src/ui/groupe/Groupe.tsx`, `ui/MesGroupes.tsx`, `App.tsx` (modif.) | Branchements |
| `app/src/test/donnees.ts`, `fauxApi.ts` (modif.) | Jeu de données membre, méthodes ajoutées |

---

### Task 1: Logique hors ligne, état du membre, estimation du tour

**Files:**
- Modify: `app/src/lib/types.ts`
- Create: `app/src/lib/erreurs.ts`, `app/src/lib/horsLigne.ts`, `app/src/lib/etatMembre.ts`, `app/src/lib/tours.ts`
- Test: `app/src/lib/erreurs.test.ts`, `app/src/lib/horsLigne.test.ts`, `app/src/lib/etatMembre.test.ts`, `app/src/lib/tours.test.ts`

**Interfaces:**
- Produces (types) : `OrdreTour`, `Recouvrement`, `Remise`, `VueMembre`, `Declaration`, `ResumeGroupe` ; `MonGroupe.resume?: ResumeGroupe` ; méthodes `Api` : `chargerVueMembre(groupId): Promise<VueMembre>`, `declarerPaiement(d: Declaration): Promise<void>`, `abonner(groupIds: string[], surChangement: () => void): () => void`.
- Produces (fonctions) : `class ErreurReseau`, `versErreur(e): Error`, `estReseau(e: unknown): boolean` ; `interface Stockage`, `stockageMemoire()`, `stockageNavigateur()`, `memoriser(s, cle, donnees, maintenant?)`, `relire<T>(s, cle): Memo<T> | null`, `lireFile(s): EnFile[]`, `mettreEnFile(s, d)`, `retirerDeFile(s, id)`, `viderFile(s, envoyer): Promise<{ envoyes; rejetes; coupure }>` ; `monEtat(cycle, moi, paiements, file): EtatMembre | null` ; `estimerTour(ordre, k, frequence, cycleOuvert): EstimationTour | null`.

- [ ] **Step 1: Ajouter les types**

Dans `app/src/lib/types.ts`, après `export interface ApercuRetrait …`, ajouter :
```ts
/** Ligne renvoyée par ordre_tours (sans numéro de téléphone). */
export interface OrdreTour {
  membership_id: string; display_name: string; role: RoleGroupe; status: Membre["status"];
  position: number | null; is_me: boolean; servi: boolean; prevu: boolean;
}
export interface Recouvrement { cycle_id: string; membres: number; attendu: number; payes: number; collecte: number }
export interface Remise {
  id: string; cycle_id: string; round: number; membership_id: string; amount_expected: number;
  amount: number | null; status: "prevu" | "remis"; paid_on: string | null;
}
export interface VueMembre {
  groupe: Groupe; moi: Membre; cycles: Cycle[]; paiements: Paiement[]; dettes: Dette[];
  remises: Remise[]; ordre: OrdreTour[]; recouvrement: Recouvrement[];
}
/** Déclaration d'un membre ; l'identifiant est tiré à la saisie pour que les renvois ne créent pas de doublon. */
export interface Declaration {
  id: string; groupId: string; cycleId: string; montant: number; moyen: MoyenPaiement;
  reference: string | null; date: string; detteId: string | null;
}
/** Résumé affiché sur la carte d'un groupe dans « Mes groupes ». */
export interface ResumeGroupe {
  cycle: string | null; echeance: string | null; montant: number | null;
  monEtat: "paye" | "en_attente" | "conteste" | "a_payer" | null; aValider: number;
}
```
Dans `MonGroupe`, ajouter le champ `resume?: ResumeGroupe;`. Dans l'interface `Api`, après `retirerMembre(…)`, ajouter :
```ts
  // Membre (lot 4)
  chargerVueMembre(groupId: string): Promise<VueMembre>;
  declarerPaiement(d: Declaration): Promise<void>;
  /** Temps réel : appelle `surChangement` à chaque modification des données de ces groupes ; renvoie la fonction d'arrêt. */
  abonner(groupIds: string[], surChangement: () => void): () => void;
```

- [ ] **Step 2: Écrire les tests (échouent)**

`app/src/lib/erreurs.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { ErreurReseau, estReseau, versErreur } from "./erreurs";

describe("erreurs", () => {
  it("une coupure (pas de code, « Failed to fetch ») devient ErreurReseau", () => {
    expect(versErreur({ message: "TypeError: Failed to fetch" })).toBeInstanceOf(ErreurReseau);
    expect(versErreur({ message: "Load failed", code: "" })).toBeInstanceOf(ErreurReseau);
    expect(estReseau(new TypeError("Failed to fetch"))).toBe(true);
  });
  it("un refus de la base garde son message", () => {
    const e = versErreur({ message: "Ce cycle est clos", code: "P0001" });
    expect(e).not.toBeInstanceOf(ErreurReseau);
    expect(e.message).toBe("Ce cycle est clos");
    expect(estReseau(e)).toBe(false);
    expect(versErreur(null).message).toBe("Erreur inattendue, réessayez");
  });
});
```

`app/src/lib/horsLigne.test.ts` :
```ts
import { describe, expect, it, vi } from "vitest";
import { ErreurReseau } from "./erreurs";
import { lireFile, memoriser, mettreEnFile, relire, retirerDeFile, stockageMemoire, viderFile } from "./horsLigne";
import type { Declaration } from "./types";

const d = (id: string): Declaration => ({ id, groupId: "g1", cycleId: "c1", montant: 5000, moyen: "mtn_momo",
  reference: "MP1", date: "2026-10-16", detteId: null });

describe("mémoire des vues", () => {
  it("relit ce qui a été mémorisé, avec la date", () => {
    const s = stockageMemoire();
    memoriser(s, "u1.groupe.g1", { a: 1 }, new Date("2026-10-16T12:30:00Z"));
    expect(relire(s, "u1.groupe.g1")).toEqual({ donnees: { a: 1 }, le: "2026-10-16T12:30:00.000Z" });
    expect(relire(s, "u2.groupe.g1")).toBeNull();
  });
  it("une mémoire illisible est ignorée", () => {
    const s = stockageMemoire();
    s.ecrire("njangi.vue.x", "{pas du json");
    expect(relire(s, "x")).toBeNull();
  });
});

describe("file des déclarations", () => {
  it("mise en file sans doublon, retrait", () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a")); mettreEnFile(s, d("a")); mettreEnFile(s, d("b"));
    expect(lireFile(s).map((e) => e.declaration.id)).toEqual(["a", "b"]);
    retirerDeFile(s, "a");
    expect(lireFile(s).map((e) => e.declaration.id)).toEqual(["b"]);
  });

  it("vider : envoie dans l'ordre et retire ce qui est parti", async () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a")); mettreEnFile(s, d("b"));
    const envoyer = vi.fn(async () => {});
    expect(await viderFile(s, envoyer)).toEqual({ envoyes: 2, rejetes: 0, coupure: false });
    expect(envoyer.mock.calls.map((c) => c[0].id)).toEqual(["a", "b"]);
    expect(lireFile(s)).toEqual([]);
  });

  it("coupure réseau : on s'arrête et on garde la suite pour plus tard", async () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a")); mettreEnFile(s, d("b"));
    const envoyer = vi.fn(async () => { throw new ErreurReseau(); });
    expect(await viderFile(s, envoyer)).toEqual({ envoyes: 0, rejetes: 0, coupure: true });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(lireFile(s).map((e) => e.etat)).toEqual(["attente", "attente"]);
  });

  it("refus de la base : marqué refusé avec le motif, jamais renvoyé", async () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a")); mettreEnFile(s, d("b"));
    const envoyer = vi.fn(async (x: Declaration) => { if (x.id === "a") throw new Error("Ce cycle est clos"); });
    expect(await viderFile(s, envoyer)).toEqual({ envoyes: 1, rejetes: 1, coupure: false });
    expect(lireFile(s)).toEqual([{ declaration: d("a"), etat: "rejete", erreur: "Ce cycle est clos" }]);
    await viderFile(s, envoyer);
    expect(envoyer).toHaveBeenCalledTimes(2);
  });

  it("deux vidages simultanés n'envoient qu'une fois", async () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a"));
    let fini!: () => void;
    const envoyer = vi.fn(() => new Promise<void>((r) => { fini = r; }));
    const p1 = viderFile(s, envoyer); const p2 = viderFile(s, envoyer);
    fini(); await Promise.all([p1, p2]);
    expect(envoyer).toHaveBeenCalledTimes(1);
  });
});
```

`app/src/lib/etatMembre.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { monEtat } from "./etatMembre";
import type { Cycle, Membre, Paiement } from "./types";
import type { EnFile } from "./horsLigne";

const CYCLE: Cycle = { id: "c1", round: 1, number: 1, label: "Octobre", due_date: null, amount_expected: 5000,
  status: "ouvert", opened_at: "2026-10-01T00:00:00Z", closed_at: null };
const MOI: Membre = { id: "m1", display_name: "Alice", phone: "237690000003", role: "membre", status: "actif", position: 2,
  person_id: "u1", left_balance: null, created_at: "2026-09-01T00:00:00Z" };
const p = (status: Paiement["status"], amount = 5000, extra: Partial<Paiement> = {}): Paiement => ({ id: `p-${status}`, cycle_id: "c1",
  membership_id: "m1", debt_id: null, amount, method: "mtn_momo", reference: "MP1", paid_on: "2026-10-05", status,
  contest_reason: status === "conteste" ? "Référence introuvable" : null, created_at: "2026-10-05T10:00:00Z", ...extra });

describe("monEtat", () => {
  it("à payer, payé, en attente de validation", () => {
    expect(monEtat(CYCLE, MOI, [], [])?.etat).toBe("a_payer");
    expect(monEtat(CYCLE, MOI, [p("valide")], [])?.etat).toBe("paye");
    expect(monEtat(CYCLE, MOI, [p("declare")], [])?.etat).toBe("en_attente");
  });
  it("contesté : motif affiché, à redéclarer", () => {
    expect(monEtat(CYCLE, MOI, [p("conteste")], [])).toEqual({ etat: "conteste", motif: "Référence introuvable", valide: 0 });
  });
  it("déclaration encore dans la file du téléphone", () => {
    const file: EnFile[] = [{ etat: "attente", declaration: { id: "x", groupId: "g1", cycleId: "c1", montant: 5000, moyen: "mtn_momo",
      reference: "MP1", date: "2026-10-16", detteId: null } }];
    expect(monEtat(CYCLE, MOI, [], file)?.etat).toBe("a_envoyer");
  });
  it("arrivé après l'ouverture : pas concerné ; règlement de dette ignoré pour le cycle", () => {
    expect(monEtat(CYCLE, { ...MOI, created_at: "2026-10-10T00:00:00Z" }, [], [])?.etat).toBe("hors");
    expect(monEtat(CYCLE, MOI, [p("valide", 5000, { debt_id: "d1" })], [])?.etat).toBe("a_payer");
  });
  it("aucun cycle ouvert", () => {
    expect(monEtat(null, MOI, [], [])).toBeNull();
  });
});
```

`app/src/lib/tours.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { estimerTour } from "./tours";
import type { Cycle, OrdreTour } from "./types";

const o = (pos: number, extra: Partial<OrdreTour> = {}): OrdreTour => ({ membership_id: `m${pos}`, display_name: `M${pos}`, role: "membre",
  status: "actif", position: pos, is_me: false, servi: false, prevu: false, ...extra });
const OUVERT: Cycle = { id: "c1", round: 1, number: 2, label: "Novembre", due_date: null, amount_expected: 5000,
  status: "ouvert", opened_at: "2026-11-01T00:00:00Z", closed_at: null };

describe("estimerTour", () => {
  it("mensuel, un bénéficiaire : deux personnes avant moi après le cycle en cours → 3 mois", () => {
    const ordre = [o(1, { servi: true }), o(2, { prevu: true }), o(3), o(4), o(5, { is_me: true })];
    const e = estimerTour(ordre, 1, "mensuelle", OUVERT)!;
    expect(e.cyclesAvant).toBe(3);
    expect(e.date?.toISOString().slice(0, 10)).toBe("2027-02-01");
  });
  it("bénéficiaire du cycle en cours", () => {
    expect(estimerTour([o(1, { is_me: true, prevu: true })], 1, "mensuelle", OUVERT)?.cyclesAvant).toBe(0);
  });
  it("deux bénéficiaires par cycle, hebdomadaire, sans cycle ouvert", () => {
    const ordre = [o(1), o(2), o(3), o(4, { is_me: true })];
    const e = estimerTour(ordre, 2, "hebdomadaire", null, new Date("2026-10-16T00:00:00Z"))!;
    expect(e.cyclesAvant).toBe(1);
    expect(e.date?.toISOString().slice(0, 10)).toBe("2026-10-23");
  });
  it("déjà servi dans ce tour, ou fréquence ponctuelle", () => {
    expect(estimerTour([o(1, { is_me: true, servi: true })], 1, "mensuelle", OUVERT)).toBeNull();
    expect(estimerTour([o(1), o(2, { is_me: true })], 1, "ponctuelle", OUVERT)?.date).toBeNull();
  });
});
```

- [ ] **Step 3: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\app && npm test`
Expected: FAIL — `Cannot find module './erreurs'` (et `./horsLigne`, `./etatMembre`, `./tours`).

- [ ] **Step 4: Écrire les modules**

`app/src/lib/erreurs.ts` :
```ts
/** Pas de réponse du serveur : l'action peut être retentée (ou mise en file) au retour du réseau. */
export class ErreurReseau extends Error {
  constructor() { super("Pas de réseau : réessayez quand la connexion revient"); }
}

/** Erreur supabase-js → Error en clair ; une coupure (pas de code SQL, échec du fetch) devient ErreurReseau. */
export function versErreur(e: { message?: string; code?: string } | null | undefined): Error {
  const message = e?.message ?? "";
  if (!e?.code && /fetch|network|load failed|timed? ?out/i.test(message)) return new ErreurReseau();
  return new Error(message || "Erreur inattendue, réessayez");
}

export const estReseau = (e: unknown) => e instanceof ErreurReseau || (e instanceof TypeError && /fetch/i.test(e.message));
```

`app/src/lib/horsLigne.ts` :
```ts
import { estReseau } from "./erreurs";
import type { Declaration } from "./types";

/** Petite mémoire clé/valeur : localStorage sur le téléphone, une Map dans les tests. */
export interface Stockage { lire(cle: string): string | null; ecrire(cle: string, v: string): void; supprimer(cle: string): void }

export function stockageMemoire(): Stockage {
  const m = new Map<string, string>();
  return { lire: (k) => m.get(k) ?? null, ecrire: (k, v) => { m.set(k, v); }, supprimer: (k) => { m.delete(k); } };
}
export function stockageNavigateur(): Stockage {
  return {
    lire: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    ecrire: (k, v) => { try { localStorage.setItem(k, v); } catch { /* mémoire pleine ou désactivée : on continue sans */ } },
    supprimer: (k) => { try { localStorage.removeItem(k); } catch { /* idem */ } },
  };
}

export interface Memo<T> { donnees: T; le: string }

/** `cle` doit inclure l'identifiant de la personne connectée (téléphone partagé). */
export function memoriser<T>(s: Stockage, cle: string, donnees: T, maintenant = new Date()) {
  s.ecrire(`njangi.vue.${cle}`, JSON.stringify({ donnees, le: maintenant.toISOString() }));
}
export function relire<T>(s: Stockage, cle: string): Memo<T> | null {
  const brut = s.lire(`njangi.vue.${cle}`);
  if (!brut) return null;
  try { return JSON.parse(brut) as Memo<T>; } catch { return null; }
}

export interface EnFile { declaration: Declaration; etat: "attente" | "rejete"; erreur?: string }
const CLE_FILE = "njangi.file";

export function lireFile(s: Stockage): EnFile[] {
  try { return JSON.parse(s.lire(CLE_FILE) ?? "[]") as EnFile[]; } catch { return []; }
}
const ecrireFile = (s: Stockage, f: EnFile[]) => s.ecrire(CLE_FILE, JSON.stringify(f));

export function mettreEnFile(s: Stockage, d: Declaration) {
  const f = lireFile(s);
  if (!f.some((e) => e.declaration.id === d.id)) ecrireFile(s, [...f, { declaration: d, etat: "attente" }]);
}
export function retirerDeFile(s: Stockage, id: string) {
  ecrireFile(s, lireFile(s).filter((e) => e.declaration.id !== id));
}

let envoiEnCours: Promise<{ envoyes: number; rejetes: number; coupure: boolean }> | null = null;

/**
 * Envoie les déclarations en attente, dans l'ordre. Une coupure arrête l'envoi (on réessaiera) ; un refus de la base
 * marque la déclaration « rejete » avec son motif (elle ne sera plus renvoyée). Un seul vidage à la fois.
 */
export function viderFile(s: Stockage, envoyer: (d: Declaration) => Promise<unknown>) {
  if (envoiEnCours) return envoiEnCours;
  envoiEnCours = (async () => {
    let envoyes = 0, rejetes = 0, coupure = false;
    for (const e of lireFile(s).filter((x) => x.etat === "attente")) {
      try {
        await envoyer(e.declaration);
        retirerDeFile(s, e.declaration.id);
        envoyes++;
      } catch (err) {
        if (estReseau(err)) { coupure = true; break; }
        ecrireFile(s, lireFile(s).map((x) => x.declaration.id === e.declaration.id
          ? { ...x, etat: "rejete" as const, erreur: (err as Error).message } : x));
        rejetes++;
      }
    }
    return { envoyes, rejetes, coupure };
  })().finally(() => { envoiEnCours = null; });
  return envoiEnCours;
}
```

`app/src/lib/etatMembre.ts` :
```ts
import type { EnFile } from "./horsLigne";
import type { Cycle, Membre, Paiement } from "./types";

export type MonEtat = "paye" | "en_attente" | "a_envoyer" | "conteste" | "a_payer" | "hors";
export interface EtatMembre { etat: MonEtat; motif?: string; valide: number }

/** Situation du membre pour le cycle ouvert (paiements ordinaires seulement ; les règlements de dette sont à part). */
export function monEtat(cycle: Cycle | null, moi: Membre, paiements: Paiement[], file: EnFile[]): EtatMembre | null {
  if (!cycle) return null;
  const siens = paiements.filter((p) => p.cycle_id === cycle.id && !p.debt_id && p.membership_id === moi.id);
  const valide = siens.filter((p) => p.status === "valide").reduce((s, p) => s + p.amount, 0);
  if (valide >= cycle.amount_expected) return { etat: "paye", valide };
  if (siens.some((p) => p.status === "declare")) return { etat: "en_attente", valide };
  if (file.some((e) => e.etat === "attente" && e.declaration.cycleId === cycle.id && !e.declaration.detteId)) return { etat: "a_envoyer", valide };
  if (new Date(moi.created_at).getTime() > new Date(cycle.opened_at).getTime()) return { etat: "hors", valide };
  const conteste = [...siens].reverse().find((p) => p.status === "conteste");
  if (conteste && valide === 0) return { etat: "conteste", motif: conteste.contest_reason ?? undefined, valide };
  return { etat: "a_payer", valide };
}
```

`app/src/lib/tours.ts` :
```ts
import type { Cycle, Frequence, OrdreTour } from "./types";

export interface EstimationTour { position: number; cyclesAvant: number; date: Date | null }

/**
 * Quand vient mon tour ? Les bénéficiaires du cycle ouvert sont « prévus » ; les membres non servis passent ensuite
 * dans l'ordre, `k` par cycle. `cyclesAvant` = 0 si je suis bénéficiaire du cycle en cours.
 */
export function estimerTour(ordre: OrdreTour[], k: number, frequence: Frequence, ouvert: Cycle | null, aujourdhui = new Date()): EstimationTour | null {
  const moi = ordre.find((o) => o.is_me);
  if (!moi || moi.servi) return null;
  const position = moi.position ?? ordre.length;
  if (moi.prevu) return { position, cyclesAvant: 0, date: ouvert ? new Date(ouvert.opened_at) : null };
  const avant = ordre.filter((o) => !o.servi && !o.prevu && (o.position ?? 1e9) < position).length;
  const cyclesAvant = Math.floor(avant / Math.max(k, 1)) + (ouvert ? 1 : 0);
  if (frequence === "ponctuelle") return { position, cyclesAvant, date: null };
  const date = new Date(ouvert ? ouvert.opened_at : aujourdhui);
  if (frequence === "mensuelle") date.setUTCMonth(date.getUTCMonth() + cyclesAvant);
  else date.setUTCDate(date.getUTCDate() + 7 * cyclesAvant);
  return { position, cyclesAvant, date };
}
```

- [ ] **Step 5: Lancer les tests**

Run: `cd D:\njangi237\app && npm test`
Expected: PASS (tous). `npx tsc -b` échoue tant que `supabaseApi.ts` et `fauxApi.ts` n'implémentent pas les nouvelles méthodes : c'est la Task 2.

- [ ] **Step 6: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 4 : logique hors ligne, état du membre, estimation du tour

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Accès Supabase du membre, temps réel, erreurs réseau, résumé des groupes

**Files:**
- Modify: `app/src/lib/supabaseApi.ts`, `app/src/test/fauxApi.ts`, `app/src/test/donnees.ts`

**Interfaces:**
- Consumes: Task 1 (types, `versErreur`).
- Produces: implémentation Supabase de `chargerVueMembre`, `declarerPaiement`, `abonner`, et `mesGroupes()` avec `resume` ; toutes les erreurs de `must()` passent par `versErreur` ; `vueMembreTest(): VueMembre` (tests).

- [ ] **Step 1: Vérifier que la compilation échoue**

Run: `cd D:\njangi237\app && npx tsc -b`
Expected: FAIL — `missing the following properties from type 'Api': chargerVueMembre, declarerPaiement, abonner`.

- [ ] **Step 2: Implémenter**

Dans `app/src/lib/supabaseApi.ts` :

1. Importer `import { versErreur } from "./erreurs";` et compléter l'import des types avec `Declaration, ResumeGroupe, VueMembre`.
2. Remplacer le corps de `must` par :
```ts
  const must = <T>(r: { data: T | null; error: { message: string; code?: string } | null }): T => {
    if (r.error) throw versErreur(r.error);
    return r.data as T;
  };
```
3. Remplacer la méthode `mesGroupes` par :
```ts
    async mesGroupes(): Promise<MonGroupe[]> {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      const rows = must(await sb.from("memberships").select("id, role, groups(id, name, type, amount, frequency)")
        .eq("person_id", data.session.user.id).eq("status", "actif")) as unknown as
        { id: string; role: MonGroupe["role"]; groups: MonGroupe["groupe"] }[];
      const groupes = rows.map((r) => ({ membership_id: r.id, role: r.role, groupe: r.groups }))
        .sort((a, b) => a.groupe.name.localeCompare(b.groupe.name, "fr"));
      if (!groupes.length) return groupes;
      // Résumé : cycle ouvert de chaque groupe et paiements de ces cycles (la RLS ne montre au membre que les siens)
      const cycles = must(await sb.from("cycles").select("id, group_id, label, due_date, amount_expected")
        .in("group_id", groupes.map((g) => g.groupe.id)).eq("status", "ouvert")) as
        { id: string; group_id: string; label: string; due_date: string | null; amount_expected: number }[];
      const paiements = cycles.length ? must(await sb.from("payments").select("cycle_id, membership_id, status, amount, debt_id")
        .in("cycle_id", cycles.map((c) => c.id)).is("debt_id", null)) as
        { cycle_id: string; membership_id: string; status: string; amount: number }[] : [];
      return groupes.map((g) => {
        const c = cycles.find((x) => x.group_id === g.groupe.id);
        const duCycle = paiements.filter((p) => p.cycle_id === c?.id);
        const miens = duCycle.filter((p) => p.membership_id === g.membership_id);
        const valide = miens.filter((p) => p.status === "valide").reduce((s, p) => s + p.amount, 0);
        const resume: ResumeGroupe = {
          cycle: c?.label ?? null, echeance: c?.due_date ?? null, montant: c?.amount_expected ?? null,
          monEtat: !c ? null : valide >= c.amount_expected ? "paye" : miens.some((p) => p.status === "declare") ? "en_attente"
            : miens.some((p) => p.status === "conteste") ? "conteste" : "a_payer",
          aValider: g.role === "tresorier" ? duCycle.filter((p) => p.status === "declare").length : 0,
        };
        return { ...g, resume };
      });
    },
```
4. Ajouter dans l'objet `api`, après `retirerMembre` :
```ts
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
```

Dans `app/src/test/fauxApi.ts`, ajouter `import { vueMembreTest } from "./donnees";` (à côté de `vueTest`) et, dans l'objet `api`, après `retirerMembre` :
```ts
    chargerVueMembre: vi.fn(async () => vueMembreTest()),
    declarerPaiement: vi.fn(async () => {}),
    abonner: vi.fn((_ids: string[], _cb: () => void) => () => {}),
```

À la fin de `app/src/test/donnees.ts`, ajouter (et compléter l'import : `import type { VueGroupe, VueMembre } from "../lib/types";`) :
```ts
/** Alice, membre de la tontine : cycle d'octobre ouvert (Tina bénéficiaire), rien payé ; dette de septembre de 5 000. */
export function vueMembreTest(): VueMembre {
  const v = vueTest();
  const alice = v.membres.find((m) => m.id === "m-alice")!;
  return {
    groupe: v.groupe, moi: alice,
    cycles: [{ id: "c-sep", round: 1, number: 1, label: "Septembre 2026", due_date: null, amount_expected: 5000, status: "clos",
      opened_at: "2026-09-01T08:00:00Z", closed_at: "2026-09-30T20:00:00Z" }, { ...v.cycles[0], number: 2 }],
    paiements: [],
    dettes: [{ id: "d-alice", membership_id: "m-alice", cycle_id: "c-sep", amount: 5000, settled_at: null }],
    remises: [{ id: "r1", cycle_id: "c-sep", round: 1, membership_id: "m-bob", amount_expected: 20000, amount: 20000, status: "remis", paid_on: "2026-09-30" },
              { id: "r2", cycle_id: "c-oct", round: 1, membership_id: "m-tina", amount_expected: 20000, amount: null, status: "prevu", paid_on: null }],
    ordre: [
      { membership_id: "m-bob", display_name: "Bob", role: "membre", status: "actif", position: 1, is_me: false, servi: true, prevu: false },
      { membership_id: "m-tina", display_name: "Tina", role: "tresorier", status: "actif", position: 2, is_me: false, servi: false, prevu: true },
      { membership_id: "m-ines", display_name: "Ines", role: "membre", status: "invite", position: 3, is_me: false, servi: false, prevu: false },
      { membership_id: "m-alice", display_name: "Alice", role: "membre", status: "actif", position: 4, is_me: true, servi: false, prevu: false },
    ],
    recouvrement: [{ cycle_id: "c-oct", membres: 4, attendu: 20000, payes: 1, collecte: 5000 }],
  };
}
```

- [ ] **Step 3: Compiler et tester**

Run: `cd D:\njangi237\app && npm test && npm run build`
Expected: tests PASS ; `tsc -b` et `vite build` sans erreur.

- [ ] **Step 4: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 4 : accès Supabase du membre, temps réel et erreurs réseau

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hook `useVue` (mémoire locale, hors ligne, temps réel) et envoi de la file

**Files:**
- Create: `app/src/lib/useVue.ts`, `app/src/lib/envoi.ts`
- Test: `app/src/lib/useVue.test.tsx`, `app/src/lib/envoi.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Stockage`, `memoriser`, `relire`, `estReseau`, `viderFile`), `Api.abonner`.
- Produces: `useVue<T>(o: { cle: string | null; charger: () => Promise<T>; abonner: (cb: () => void) => () => void; stockage: Stockage }): { vue: T | null; le: string | null; horsLigne: boolean; err: string; recharger: () => void }` ; `demarrerEnvoi(api: Api, stockage: Stockage, cible?: Window): () => void` ; événement `njangi:file` émis sur `window` après chaque vidage.

- [ ] **Step 1: Écrire les tests (échouent)**

`app/src/lib/useVue.test.tsx` :
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useVue } from "./useVue";
import { memoriser, stockageMemoire, type Stockage } from "./horsLigne";
import { ErreurReseau } from "./erreurs";

afterEach(cleanup);

function Sonde(p: { cle: string | null; charger: () => Promise<{ n: number }>; abonner: (cb: () => void) => () => void; stockage: Stockage }) {
  const v = useVue(p);
  return <p>{v.vue ? `n=${v.vue.n}` : "vide"}{v.horsLigne ? ` hors-ligne ${v.le}` : ""}{v.err ? ` err=${v.err}` : ""}</p>;
}
const sansAbonnement = () => () => {};

describe("useVue", () => {
  it("affiche tout de suite la mémoire, puis les données fraîches qu'il mémorise", async () => {
    const s = stockageMemoire();
    memoriser(s, "u1.g1", { n: 1 }, new Date("2026-10-16T10:00:00Z"));
    let rendre!: (v: { n: number }) => void;
    render(<Sonde cle="u1.g1" stockage={s} abonner={sansAbonnement} charger={() => new Promise((r) => { rendre = r; })} />);
    expect(screen.getByText("n=1")).toBeTruthy();
    await act(async () => rendre({ n: 2 }));
    expect(screen.getByText("n=2")).toBeTruthy();
    expect(JSON.parse(s.lire("njangi.vue.u1.g1")!).donnees).toEqual({ n: 2 });
  });

  it("sans réseau : garde la mémoire et signale « hors ligne » avec sa date", async () => {
    const s = stockageMemoire();
    memoriser(s, "u1.g1", { n: 1 }, new Date("2026-10-16T10:00:00Z"));
    render(<Sonde cle="u1.g1" stockage={s} abonner={sansAbonnement} charger={async () => { throw new ErreurReseau(); }} />);
    expect(await screen.findByText(/n=1 hors-ligne 2026-10-16T10:00:00.000Z/)).toBeTruthy();
  });

  it("clé par personne : la mémoire d'une autre personne n'est jamais montrée", async () => {
    const s = stockageMemoire();
    memoriser(s, "u1.g1", { n: 1 });
    render(<Sonde cle="u2.g1" stockage={s} abonner={sansAbonnement} charger={async () => { throw new ErreurReseau(); }} />);
    expect(await screen.findByText(/vide hors-ligne/)).toBeTruthy();
  });

  it("refus de la base : message d'erreur, pas « hors ligne »", async () => {
    render(<Sonde cle="u1.g1" stockage={stockageMemoire()} abonner={sansAbonnement} charger={async () => { throw new Error("Groupe introuvable"); }} />);
    expect(await screen.findByText(/err=Groupe introuvable/)).toBeTruthy();
  });

  it("temps réel : une rafale de changements = un seul rechargement ; désabonnement en quittant", async () => {
    vi.useFakeTimers();
    let signal!: () => void; const arret = vi.fn();
    const charger = vi.fn(async () => ({ n: 1 }));
    const { unmount } = render(<Sonde cle="u1.g1" stockage={stockageMemoire()} charger={charger}
      abonner={(cb) => { signal = cb; return arret; }} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(charger).toHaveBeenCalledTimes(1);
    act(() => { signal(); signal(); signal(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(charger).toHaveBeenCalledTimes(2);
    unmount();
    expect(arret).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

`app/src/lib/envoi.test.ts` :
```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { demarrerEnvoi } from "./envoi";
import { lireFile, mettreEnFile, stockageMemoire } from "./horsLigne";
import { fauxApi } from "../test/fauxApi";

describe("demarrerEnvoi", () => {
  it("vide la file au démarrage puis au retour du réseau, et prévient les écrans", async () => {
    const s = stockageMemoire(); const api = fauxApi();
    mettreEnFile(s, { id: "a", groupId: "g1", cycleId: "c1", montant: 5000, moyen: "especes", reference: null, date: "2026-10-16", detteId: null });
    const prevenu = vi.fn(); window.addEventListener("njangi:file", prevenu);
    const arreter = demarrerEnvoi(api, s);
    await vi.waitFor(() => expect(api.declarerPaiement).toHaveBeenCalledTimes(1));
    expect(lireFile(s)).toEqual([]);
    await vi.waitFor(() => expect(prevenu).toHaveBeenCalled());
    mettreEnFile(s, { id: "b", groupId: "g1", cycleId: "c1", montant: 5000, moyen: "especes", reference: null, date: "2026-10-16", detteId: null });
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(api.declarerPaiement).toHaveBeenCalledTimes(2));
    arreter();
    window.removeEventListener("njangi:file", prevenu);
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\app && npm test`
Expected: FAIL — `Failed to resolve import "./useVue"` et `"./envoi"`.

- [ ] **Step 3: Écrire les modules**

`app/src/lib/useVue.ts` :
```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { estReseau } from "./erreurs";
import { memoriser, relire, type Stockage } from "./horsLigne";

/**
 * Données d'un écran : la dernière version mémorisée s'affiche tout de suite, puis la version fraîche la remplace.
 * Sans réseau, on garde la mémoire (et sa date) ; les changements temps réel déclenchent un rechargement regroupé.
 * `cle` inclut l'identifiant de la personne : jamais la mémoire d'une autre (téléphone partagé). `null` = pas de mémoire.
 */
export function useVue<T>({ cle, charger, abonner, stockage }: {
  cle: string | null; charger: () => Promise<T>; abonner: (cb: () => void) => () => void; stockage: Stockage;
}) {
  const [vue, setVue] = useState<T | null>(() => (cle ? relire<T>(stockage, cle)?.donnees ?? null : null));
  const [le, setLe] = useState<string | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [err, setErr] = useState("");
  const chargerRef = useRef(charger); chargerRef.current = charger;

  const recharger = useCallback(() => {
    chargerRef.current().then((v) => {
      setVue(v); setLe(null); setHorsLigne(false); setErr("");
      if (cle) memoriser(stockage, cle, v);
    }).catch((e) => {
      if (estReseau(e)) {
        setHorsLigne(true);
        setLe(cle ? relire<T>(stockage, cle)?.le ?? null : null);
      } else setErr((e as Error).message);
    });
  }, [cle, stockage]);

  useEffect(() => { recharger(); }, [recharger]);

  useEffect(() => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const regroupe = () => { clearTimeout(minuterie); minuterie = setTimeout(recharger, 400); };
    const arreter = abonner(regroupe);
    const surLigne = () => recharger();
    const horsReseau = () => setHorsLigne(true);
    window.addEventListener("online", surLigne);
    window.addEventListener("offline", horsReseau);
    window.addEventListener("njangi:file", surLigne);
    return () => {
      clearTimeout(minuterie); arreter();
      window.removeEventListener("online", surLigne);
      window.removeEventListener("offline", horsReseau);
      window.removeEventListener("njangi:file", surLigne);
    };
    // abonner change à chaque rendu chez l'appelant : on ne s'abonne qu'une fois par vue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recharger]);

  return { vue, le, horsLigne, err, recharger };
}
```

`app/src/lib/envoi.ts` :
```ts
import { viderFile, type Stockage } from "./horsLigne";
import type { Api } from "./types";

/** Envoie les déclarations en file au démarrage et à chaque retour du réseau ; prévient les écrans (« njangi:file »). */
export function demarrerEnvoi(api: Api, stockage: Stockage, cible: Window = window): () => void {
  const vider = () => {
    viderFile(stockage, (d) => api.declarerPaiement(d))
      .then((r) => { if (r.envoyes || r.rejetes) cible.dispatchEvent(new Event("njangi:file")); })
      .catch(() => { /* rien à faire : on réessaiera au prochain retour du réseau */ });
  };
  vider();
  cible.addEventListener("online", vider);
  return () => cible.removeEventListener("online", vider);
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\app && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 4 : hook useVue (mémoire locale, hors ligne, temps réel) et envoi de la file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Espace membre et déclaration de paiement

**Files:**
- Create: `app/src/ui/membre/FormDeclaration.tsx`, `app/src/ui/membre/EspaceMembre.tsx`
- Test: `app/src/ui/membre/EspaceMembre.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3 (`monEtat`, `estimerTour`, `lireFile`, `mettreEnFile`, `estReseau`, `useVue`), `fcfa`, `dateCourte`, `de`.
- Produces: `EspaceMembre({ api, groupId, personId, stockage })` ; `FormDeclaration({ titre, montant, montantFixe?, onAnnuler, onDeclarer, occupe })`.

- [ ] **Step 1: Écrire le test (échoue)**

`app/src/ui/membre/EspaceMembre.test.tsx` :
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EspaceMembre } from "./EspaceMembre";
import { fauxApi } from "../../test/fauxApi";
import { vueMembreTest } from "../../test/donnees";
import { lireFile, stockageMemoire } from "../../lib/horsLigne";
import { ErreurReseau } from "../../lib/erreurs";
import type { VueMembre } from "../../lib/types";

afterEach(cleanup);
const afficher = (vue: VueMembre = vueMembreTest(), api = fauxApi(), stockage = stockageMemoire()) => {
  api.chargerVueMembre.mockResolvedValue(vue);
  render(<EspaceMembre api={api} groupId="g1" personId="u-alice" stockage={stockage} />);
  return { api, stockage };
};
const cycle = () => screen.getByRole("region", { name: "Cycle en cours" });

describe("espace membre", () => {
  it("cycle en cours à payer, bénéficiaire, taux du groupe", async () => {
    afficher();
    expect(await within(await screen.findByRole("region", { name: "Cycle en cours" })).findByText("Octobre 2026")).toBeTruthy();
    expect(cycle().textContent).toContain("À payer : 5 000 FCFA");
    expect(cycle().textContent).toContain("Bénéficiaire : Tina");
    expect(cycle().textContent).toContain("25 %");
  });

  it("déclarer MoMo : la référence est obligatoire, puis envoi avec un identifiant", async () => {
    const { api } = afficher();
    await userEvent.click(await screen.findByRole("button", { name: "Déclarer mon paiement" }));
    const envoyer = screen.getByRole("button", { name: "Envoyer la déclaration" });
    expect((screen.getByLabelText("Montant (FCFA)") as HTMLInputElement).value).toBe("5000");
    expect((envoyer as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Référence de la transaction"), "MP240912.1234");
    await userEvent.click(envoyer);
    const d = api.declarerPaiement.mock.calls[0][0];
    expect(d).toMatchObject({ groupId: "g1", cycleId: "c-oct", montant: 5000, moyen: "mtn_momo", reference: "MP240912.1234", detteId: null });
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("hors ligne : la déclaration est mise en file et l'écran l'indique", async () => {
    const api = fauxApi(); api.declarerPaiement.mockRejectedValueOnce(new ErreurReseau());
    const { stockage } = afficher(vueMembreTest(), api);
    await userEvent.click(await screen.findByRole("button", { name: "Déclarer mon paiement" }));
    await userEvent.selectOptions(screen.getByLabelText("Moyen de paiement"), "especes");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la déclaration" }));
    expect(lireFile(stockage).map((e) => e.declaration.moyen)).toEqual(["especes"]);
    expect(await screen.findByText(/envoyée automatiquement au retour du réseau/)).toBeTruthy();
    expect(cycle().textContent).toContain("En attente d'envoi");
    expect(screen.queryByRole("button", { name: "Déclarer mon paiement" })).toBeNull();
  });

  it("refus de la base : message affiché, rien en file", async () => {
    const api = fauxApi(); api.declarerPaiement.mockRejectedValueOnce(new Error("Ce cycle est clos"));
    const { stockage } = afficher(vueMembreTest(), api);
    await userEvent.click(await screen.findByRole("button", { name: "Déclarer mon paiement" }));
    await userEvent.selectOptions(screen.getByLabelText("Moyen de paiement"), "especes");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la déclaration" }));
    expect(await screen.findByText("Ce cycle est clos")).toBeTruthy();
    expect(lireFile(stockage)).toEqual([]);
  });

  it("en attente de validation, puis contesté avec motif et nouvelle déclaration possible", async () => {
    const vue = vueMembreTest();
    vue.paiements = [{ id: "p1", cycle_id: "c-oct", membership_id: "m-alice", debt_id: null, amount: 5000, method: "mtn_momo",
      reference: "MP1", paid_on: "2026-10-05", status: "declare", contest_reason: null, created_at: "2026-10-05T10:00:00Z" }];
    afficher(vue);
    expect(await within(await screen.findByRole("region", { name: "Cycle en cours" })).findByText(/En attente de validation/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Déclarer mon paiement" })).toBeNull();
    cleanup();
    vue.paiements[0] = { ...vue.paiements[0], status: "conteste", contest_reason: "Référence introuvable chez MTN" };
    afficher(vue);
    expect(await screen.findByText(/Référence introuvable chez MTN/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Déclarer mon paiement" })).toBeTruthy();
  });

  it("arrivé après l'ouverture : pas concerné, pas de bouton", async () => {
    const vue = vueMembreTest(); vue.moi = { ...vue.moi, created_at: "2026-10-20T00:00:00Z" };
    afficher(vue);
    expect(await screen.findByText(/rien à payer pour ce cycle/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Déclarer mon paiement" })).toBeNull();
  });

  it("dette : régler le montant entier", async () => {
    const { api } = afficher();
    const dettes = await screen.findByRole("region", { name: "Mes dettes" });
    expect(dettes.textContent).toContain("Septembre 2026");
    await userEvent.click(within(dettes).getByRole("button", { name: "Régler la dette de Septembre 2026" }));
    expect((screen.getByLabelText("Montant (FCFA)") as HTMLInputElement).readOnly).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText("Moyen de paiement"), "orange_money");
    await userEvent.type(screen.getByLabelText("Référence de la transaction"), "OM55");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la déclaration" }));
    expect(api.declarerPaiement.mock.calls[0][0]).toMatchObject({ cycleId: "c-sep", montant: 5000, detteId: "d-alice", moyen: "orange_money" });
  });

  it("ordre des tours : ma ligne en évidence, servi et bénéficiaire du cycle signalés, date estimée", async () => {
    afficher();
    const tours = await screen.findByRole("region", { name: "Ordre des tours" });
    const moi = within(tours).getByText("Alice").closest("li")!;
    expect(moi.className).toContain("moi");
    expect(within(tours).getByText("Bob").closest("li")!.textContent).toContain("a reçu");
    expect(within(tours).getByText("Tina").closest("li")!.textContent).toContain("ce cycle");
    expect(tours.textContent).toMatch(/Votre tour : dans 2 cycles/);
  });

  it("historique de mes paiements", async () => {
    const vue = vueMembreTest();
    vue.paiements = [{ id: "p0", cycle_id: "c-sep", membership_id: "m-alice", debt_id: null, amount: 2000, method: "especes",
      reference: null, paid_on: "2026-09-10", status: "valide", contest_reason: null, created_at: "2026-09-10T10:00:00Z" }];
    afficher(vue);
    const histo = await screen.findByRole("region", { name: "Mes paiements" });
    expect(histo.textContent).toContain("Septembre 2026");
    expect(histo.textContent).toContain("2 000 FCFA");
    expect(histo.textContent).toContain("Validé");
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\app && npm test`
Expected: FAIL — `Failed to resolve import "./EspaceMembre"`.

- [ ] **Step 3: Écrire les composants**

`app/src/ui/membre/FormDeclaration.tsx` :
```tsx
import { useState } from "react";
import type { MoyenPaiement } from "../../lib/types";
import { Champ } from "../Champ";

export interface SaisieDeclaration { montant: number; moyen: MoyenPaiement; reference: string | null; date: string }
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Formulaire de déclaration : moyen, montant, référence (obligatoire pour MoMo/OM), date. */
export function FormDeclaration({ titre, montant, montantFixe, occupe, onAnnuler, onDeclarer }: {
  titre: string; montant: number; montantFixe?: boolean; occupe: boolean; onAnnuler: () => void; onDeclarer: (s: SaisieDeclaration) => void;
}) {
  const [moyen, setMoyen] = useState<MoyenPaiement>("mtn_momo");
  const [somme, setSomme] = useState(String(montant));
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(aujourdhui());
  const mobile = moyen === "mtn_momo" || moyen === "orange_money";
  const valeur = parseInt(somme || "0", 10);
  const valide = valeur > 0 && (!mobile || reference.trim().length > 0) && !!date && date <= aujourdhui();
  return (
    <form className="carte" onSubmit={(e) => { e.preventDefault(); if (valide) onDeclarer({ montant: valeur, moyen, reference: reference.trim() || null, date }); }}>
      <h3>{titre}</h3>
      <label className="champ"><span>Moyen de paiement</span>
        <select value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenPaiement)}>
          <option value="mtn_momo">MTN MoMo</option><option value="orange_money">Orange Money</option>
          <option value="especes">Espèces (remises au trésorier)</option><option value="autre">Autre</option>
        </select></label>
      <Champ label="Montant (FCFA)" value={somme} inputMode="numeric" readOnly={montantFixe}
        onChange={(e) => setSomme(e.target.value.replace(/\D/g, ""))} />
      <Champ label="Référence de la transaction" value={reference} onChange={(e) => setReference(e.target.value)}
        placeholder={mobile ? "Ex. MP240912.1234.A56789" : "Facultatif"} aide={mobile ? "Obligatoire pour MoMo et Orange Money." : undefined} />
      <Champ label="Date du paiement" type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} />
      <div className="ligne">
        <button type="button" className="btn" onClick={onAnnuler} disabled={occupe}>Annuler</button>
        <button className="btn principal" disabled={occupe || !valide} aria-label="Envoyer la déclaration">Envoyer</button>
      </div>
    </form>
  );
}
```

`app/src/ui/membre/EspaceMembre.tsx` :
```tsx
import { useMemo, useRef, useState } from "react";
import { estReseau } from "../../lib/erreurs";
import { monEtat } from "../../lib/etatMembre";
import { dateCourte, de, fcfa } from "../../lib/format";
import { lireFile, mettreEnFile, type Stockage } from "../../lib/horsLigne";
import { estimerTour } from "../../lib/tours";
import type { Api, Declaration, Dette, Paiement } from "../../lib/types";
import { useVue } from "../../lib/useVue";
import { FormDeclaration, type SaisieDeclaration } from "./FormDeclaration";

const ETAT_PAIEMENT: Record<Paiement["status"], string> = { declare: "En attente", valide: "Validé", conteste: "Contesté" };
const MOIS = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

type Formulaire = { cycleId: string; titre: string; montant: number; detteId: string | null } | null;

export function EspaceMembre({ api, groupId, personId, stockage }: { api: Api; groupId: string; personId: string; stockage: Stockage }) {
  const { vue, le, horsLigne, err, recharger } = useVue({
    cle: `${personId}.membre.${groupId}`, stockage,
    charger: () => api.chargerVueMembre(groupId), abonner: (cb) => api.abonner([groupId], cb),
  });
  const [form, setForm] = useState<Formulaire>(null);
  const [info, setInfo] = useState(""); const [erreur, setErreur] = useState(""); const [occupe, setOccupe] = useState(false);
  const [, rafraichir] = useState(0);
  const enCours = useRef(false);

  const file = lireFile(stockage).filter((e) => e.declaration.groupId === groupId);
  const ouvert = vue?.cycles.find((c) => c.status === "ouvert") ?? null;
  const etat = useMemo(() => (vue ? monEtat(ouvert, vue.moi, vue.paiements, file) : null), [vue, ouvert, file]);

  if (!vue) return err ? <p className="alerte">{err}</p> : <p className="note">Chargement…</p>;

  const declarer = async (s: SaisieDeclaration) => {
    if (!form || enCours.current) return;
    enCours.current = true; setOccupe(true); setErreur(""); setInfo("");
    const d: Declaration = { id: crypto.randomUUID(), groupId, cycleId: form.cycleId, montant: s.montant, moyen: s.moyen,
      reference: s.reference, date: s.date, detteId: form.detteId };
    try {
      await api.declarerPaiement(d);
      setForm(null); setInfo("Paiement déclaré : votre trésorier va le valider."); recharger();
    } catch (e) {
      if (estReseau(e)) {
        mettreEnFile(stockage, d); setForm(null); rafraichir((n) => n + 1);
        setInfo("Pas de réseau : votre déclaration est gardée sur le téléphone et sera envoyée automatiquement au retour du réseau.");
      } else setErreur((e as Error).message);
    } finally { enCours.current = false; setOccupe(false); }
  };

  const remiseDuCycle = ouvert ? vue.remises.filter((r) => r.cycle_id === ouvert.id) : [];
  const nomTour = (id: string) => vue.ordre.find((o) => o.membership_id === id)?.display_name ?? "?";
  const taux = ouvert ? vue.recouvrement.find((r) => r.cycle_id === ouvert.id) : undefined;
  const estimation = vue.groupe.type === "tontine"
    ? estimerTour(vue.ordre, vue.groupe.beneficiaries_per_cycle, vue.groupe.frequency, ouvert) : null;
  const dettes = vue.dettes.filter((d) => !d.settled_at);
  const libelle = (cycleId: string) => vue.cycles.find((c) => c.id === cycleId)?.label ?? "cycle";
  const reglementEnAttente = (d: Dette) => vue.paiements.some((p) => p.debt_id === d.id && p.status === "declare")
    || file.some((e) => e.etat === "attente" && e.declaration.detteId === d.id);
  const refusees = file.filter((e) => e.etat === "rejete");

  return (
    <section>
      <div className="ligne"><h2>{vue.groupe.name}</h2><a className="lien" href="#/">← Mes groupes</a></div>
      {horsLigne && <p className="alerte">Hors ligne{le ? ` · données du ${dateCourte(le).slice(0, 5)} à ${new Date(le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>}
      {erreur && <p className="alerte flottante" role="alert">{erreur}</p>}
      {info && <p className="ok">{info}</p>}
      {refusees.map((e) => <p key={e.declaration.id} className="alerte">Déclaration de {fcfa(e.declaration.montant)} refusée : {e.erreur}</p>)}

      <section className="carte" role="region" aria-label="Cycle en cours">
        {ouvert && etat ? <>
          <div className="ligne"><h3>{ouvert.label}</h3>{ouvert.due_date && <span className="note">avant le {dateCourte(ouvert.due_date)}</span>}</div>
          {etat.etat === "paye" && <p className="ok">Payé ✓</p>}
          {etat.etat === "en_attente" && <p>En attente de validation par le trésorier.</p>}
          {etat.etat === "a_envoyer" && <p>En attente d'envoi (pas de réseau) : partira automatiquement.</p>}
          {etat.etat === "conteste" && <p className="alerte">Paiement contesté{etat.motif ? ` : ${etat.motif}` : ""}. Vous pouvez le déclarer à nouveau.</p>}
          {etat.etat === "a_payer" && <p>À payer : {fcfa(ouvert.amount_expected - etat.valide)}</p>}
          {etat.etat === "hors" && <p className="note">Vous avez rejoint le groupe après l'ouverture de ce cycle : rien à payer pour ce cycle.</p>}
          {remiseDuCycle.length > 0 && <p className="note">Bénéficiaire : {remiseDuCycle.map((r) => nomTour(r.membership_id)).join(", ")}</p>}
          {taux && <p className="note">Le groupe a collecté {fcfa(taux.collecte)} sur {fcfa(taux.attendu)} ({taux.attendu ? Math.round(taux.collecte * 100 / taux.attendu) : 0} %).</p>}
          {(etat.etat === "a_payer" || etat.etat === "conteste") && !form &&
            <button className="btn principal" onClick={() => setForm({ cycleId: ouvert.id, titre: `Déclarer mon paiement · ${ouvert.label}`,
              montant: ouvert.amount_expected - etat.valide, detteId: null })}>Déclarer mon paiement</button>}
        </> : <p className="note">Aucun cycle en cours.</p>}
      </section>

      {form && <FormDeclaration titre={form.titre} montant={form.montant} montantFixe={!!form.detteId} occupe={occupe}
        onAnnuler={() => setForm(null)} onDeclarer={declarer} />}

      {dettes.length > 0 && (
        <section className="carte" role="region" aria-label="Mes dettes">
          <h3>Mes dettes</h3>
          <ul className="liste">{dettes.map((d) => (
            <li key={d.id} className="ligne">
              <span>{libelle(d.cycle_id)} · {fcfa(d.amount)}</span>
              {reglementEnAttente(d) ? <span className="note">Règlement en attente</span>
                : <button className="btn petit" aria-label={`Régler la dette ${de(libelle(d.cycle_id))}`}
                    onClick={() => setForm({ cycleId: d.cycle_id, titre: `Régler la dette ${de(libelle(d.cycle_id))}`, montant: d.amount, detteId: d.id })}>
                    Régler</button>}
            </li>))}</ul>
        </section>
      )}

      {vue.groupe.type === "tontine" && vue.ordre.length > 0 && (
        <section className="carte" role="region" aria-label="Ordre des tours">
          <h3>Ordre des tours</h3>
          {estimation && <p className="note">{estimation.cyclesAvant === 0 ? "Votre tour : ce cycle !"
            : `Votre tour : dans ${estimation.cyclesAvant} cycle${estimation.cyclesAvant > 1 ? "s" : ""}${estimation.date ? ` (≈ ${MOIS(estimation.date)})` : ""}`}</p>}
          <ol className="liste tours">{vue.ordre.map((o) => (
            <li key={o.membership_id} className={`ligne${o.is_me ? " moi" : ""}`}>
              <span><b>{o.display_name}</b></span>
              <span className="note">{o.servi ? "a reçu sa part" : o.prevu ? "bénéficiaire ce cycle" : ""}</span>
            </li>))}</ol>
        </section>
      )}

      <section className="carte" role="region" aria-label="Mes paiements">
        <h3>Mes paiements</h3>
        {vue.paiements.length === 0 ? <p className="note">Aucun paiement pour l'instant.</p> : (
          <ul className="liste">{[...vue.paiements].reverse().map((p) => (
            <li key={p.id} className="ligne">
              <span>{libelle(p.cycle_id)}{p.debt_id ? " (dette)" : ""} · {fcfa(p.amount)}</span>
              <span className="note">{ETAT_PAIEMENT[p.status]} · {dateCourte(p.paid_on)}</span>
            </li>))}</ul>)}
      </section>
    </section>
  );
}
```

Ajouter à `app/src/styles.css` :
```css
.tours li.moi { background: var(--gold-soft); border-radius: 6px; padding: 6px 8px; }
.tours { padding-left: 0; }
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\app && npm test`
Expected: PASS (9 tests de l'espace membre + précédents).

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 4 : espace membre (cycle, déclaration, dettes, tours, historique)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Branchements — espace du groupe, Mes groupes, envoi au démarrage

**Files:**
- Modify: `app/src/ui/groupe/Groupe.tsx`, `app/src/ui/MesGroupes.tsx`, `app/src/ui/Coque.tsx`, `app/src/App.tsx`, `app/src/ui/groupe/Groupe.test.tsx`
- Test: `app/src/ui/MesGroupes.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `Groupe({ api, id, onglet, personId, stockage })` (membre → `EspaceMembre`, trésorier → onglets avec mémoire locale, temps réel, lecture seule hors ligne) ; cartes « Mes groupes » enrichies ; `demarrerEnvoi` lancé une fois l'utilisateur connecté.

- [ ] **Step 1: Écrire les tests (échouent)**

Dans `app/src/ui/groupe/Groupe.test.tsx`, remplacer les rendus `<Groupe api={…} id="g1" onglet="cycle" />` par `<Groupe api={…} id="g1" onglet="cycle" personId="u-tina" stockage={stockageMemoire()} />` (importer `stockageMemoire` depuis `../../lib/horsLigne`), remplacer l'attente `findByText(/espace membre arrive bientôt/)` du premier test par :
```tsx
    expect(await screen.findByRole("region", { name: "Cycle en cours" })).toBeTruthy();
```
et ajouter à la fin du `describe` :
```tsx
  it("trésorier hors ligne : dernière vue affichée, actions désactivées", async () => {
    const stockage = stockageMemoire();
    const api = fauxApi();
    const { unmount } = render(<Groupe api={api} id="g1" onglet="cycle" personId="u-tina" stockage={stockage} />);
    await screen.findByText("Octobre 2026");
    unmount();
    api.chargerGroupe.mockRejectedValue(new ErreurReseau());
    render(<Groupe api={api} id="g1" onglet="cycle" personId="u-tina" stockage={stockage} />);
    expect(await screen.findByText(/Hors ligne/)).toBeTruthy();
    expect(screen.getByText("Octobre 2026")).toBeTruthy();
    // Désactivé par le fieldset parent : la propriété disabled du bouton reste fausse, :disabled est vrai
    expect(screen.getByRole("button", { name: "Valider le paiement d'Alice" }).matches(":disabled")).toBe(true);
  });

  it("temps réel : l'écran du trésorier s'abonne aux changements du groupe", async () => {
    const api = fauxApi();
    render(<Groupe api={api} id="g1" onglet="cycle" personId="u-tina" stockage={stockageMemoire()} />);
    await screen.findByText("Octobre 2026");
    expect(api.abonner).toHaveBeenCalledWith(["g1"], expect.any(Function));
  });
```
(importer `ErreurReseau` depuis `../../lib/erreurs`).

`app/src/ui/MesGroupes.test.tsx` :
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MesGroupes } from "./MesGroupes";
import { fauxApi } from "../test/fauxApi";
import { stockageMemoire } from "../lib/horsLigne";

afterEach(cleanup);

describe("Mes groupes", () => {
  it("carte membre : à payer avec échéance ; carte trésorier : paiements à valider", async () => {
    const api = fauxApi();
    api.mesGroupes.mockResolvedValue([
      { membership_id: "m1", role: "membre", groupe: { id: "g1", name: "Tontine A", type: "tontine", amount: 5000, frequency: "mensuelle" },
        resume: { cycle: "Octobre 2026", echeance: "2026-10-30", montant: 5000, monEtat: "a_payer", aValider: 0 } },
      { membership_id: "m2", role: "tresorier", groupe: { id: "g2", name: "Cotisation B", type: "cotisation", amount: 2000, frequency: "mensuelle" },
        resume: { cycle: "Octobre 2026", echeance: null, montant: 2000, monEtat: "paye", aValider: 2 } },
    ]);
    render(<MesGroupes api={api} personId="u1" stockage={stockageMemoire()} />);
    expect(await screen.findByText("À payer : 5 000 FCFA avant le 30/10/2026")).toBeTruthy();
    expect(screen.getByText("2 paiements à valider")).toBeTruthy();
    expect(screen.getByText("Payé ✓")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `cd D:\njangi237\app && npm test`
Expected: FAIL — rendus de `Groupe` (propriétés inconnues ignorées, mais « Cycle en cours » introuvable pour un membre ; pas de « Hors ligne ») ; `MesGroupes` sans résumé.

- [ ] **Step 3: Implémenter**

`app/src/ui/groupe/Groupe.tsx` (remplacer) :
```tsx
import type { Stockage } from "../../lib/horsLigne";
import type { Api, VueGroupe } from "../../lib/types";
import { useVue } from "../../lib/useVue";
import { dateCourte } from "../../lib/format";
import { EspaceMembre } from "../membre/EspaceMembre";
import { OngletCycle } from "./OngletCycle";
import { OngletMembres } from "./OngletMembres";

/** Espace d'un groupe : trésorier (onglets) ou membre. Mémoire locale, temps réel, lecture seule hors ligne. */
export function Groupe({ api, id, onglet, personId, stockage }: {
  api: Api; id: string; onglet: "cycle" | "membres"; personId: string; stockage: Stockage;
}) {
  const { vue, le, horsLigne, err, recharger } = useVue<VueGroupe>({
    cle: `${personId}.groupe.${id}`, stockage,
    charger: () => api.chargerGroupe(id), abonner: (cb) => api.abonner([id], cb),
  });

  const bandeau = (err || horsLigne) && (
    <div className="alerte ligne" role="alert">
      <span>{horsLigne ? `Hors ligne${le ? ` · données du ${dateCourte(le).slice(0, 5)}` : ""} : les actions reprendront au retour du réseau` : err}</span>
      <button className="btn petit" onClick={recharger}>Réessayer</button>
    </div>);

  if (!vue) return bandeau || <p className="note">Chargement…</p>;
  if (vue.role !== "tresorier") return <EspaceMembre api={api} groupId={id} personId={personId} stockage={stockage} />;
  return (
    <section>
      <div className="ligne"><h2>{vue.groupe.name}</h2><a className="lien" href="#/">← Mes groupes</a></div>
      {bandeau}
      <nav className="onglets">
        <a href={`#/groupe/${id}`} className={onglet === "cycle" ? "actif" : ""}>Cycle</a>
        <a href={`#/groupe/${id}/membres`} className={onglet === "membres" ? "actif" : ""}>Membres</a>
      </nav>
      {/* Un fieldset désactivé désactive d'un coup tous les boutons et champs : lecture seule hors ligne */}
      <fieldset className="sans-cadre" disabled={horsLigne}>
        {onglet === "cycle" ? <OngletCycle api={api} vue={vue} recharger={recharger} /> : <OngletMembres api={api} vue={vue} recharger={recharger} />}
      </fieldset>
    </section>
  );
}
```

`app/src/ui/MesGroupes.tsx` (remplacer) :
```tsx
import type { Stockage } from "../lib/horsLigne";
import { dateCourte, fcfa } from "../lib/format";
import type { Api, MonGroupe } from "../lib/types";
import { useVue } from "../lib/useVue";

const TYPE: Record<string, string> = { tontine: "Tontine", cotisation: "Cotisation", association: "Association", autre: "Groupe" };

function Resume({ g }: { g: MonGroupe }) {
  const r = g.resume;
  if (!r || !r.cycle) return <p className="note">Aucun cycle en cours</p>;
  return (
    <>
      {r.monEtat === "paye" && <p className="ok">Payé ✓</p>}
      {r.monEtat === "en_attente" && <p className="note">En attente de validation</p>}
      {r.monEtat === "conteste" && <p className="alerte">Paiement contesté : à déclarer à nouveau</p>}
      {r.monEtat === "a_payer" && r.montant !== null && <p><b>À payer : {fcfa(r.montant)}{r.echeance ? ` avant le ${dateCourte(r.echeance)}` : ""}</b></p>}
      {g.role === "tresorier" && r.aValider > 0 && <p className="pastille declare">{r.aValider} paiement{r.aValider > 1 ? "s" : ""} à valider</p>}
    </>
  );
}

export function MesGroupes({ api, personId, stockage }: { api: Api; personId: string; stockage: Stockage }) {
  const { vue: groupes, horsLigne, err } = useVue<MonGroupe[]>({
    // Pas d'abonnement temps réel ici : la liste se recharge à chaque retour sur l'écran (et au retour du réseau)
    cle: `${personId}.groupes`, stockage, charger: () => api.mesGroupes(), abonner: () => () => {},
  });
  if (err && !groupes) return <p className="alerte">{err}</p>;
  if (!groupes) return <p className="note">Chargement…</p>;
  if (!groupes.length) return <div className="vide"><b>Aucun groupe pour l'instant</b><p>Votre trésorier vous enverra un lien d'invitation.</p></div>;
  return (
    <>
      {horsLigne && <p className="alerte">Hors ligne : dernières données connues</p>}
      <ul className="liste">
        {groupes.map((g) => (
          <li key={g.membership_id} className="carte groupe">
            <a className="groupe-lien" href={`#/groupe/${g.groupe.id}`}>
              <div className="ligne"><h3>{g.groupe.name}</h3>
                <span className={`pastille ${g.role}`}>{g.role === "tresorier" ? "Trésorier" : "Membre"}</span></div>
              <p className="note">{TYPE[g.groupe.type] ?? "Groupe"} · {g.groupe.frequency} · {fcfa(g.groupe.amount)} par cycle{g.resume?.cycle ? ` · ${g.resume.cycle}` : ""}</p>
              <Resume g={g} />
            </a>
          </li>))}
      </ul>
    </>
  );
}
```

Dans `app/src/ui/Coque.tsx` : importer `import { stockageNavigateur } from "../lib/horsLigne";` puis, en tête du composant, `const stockage = useMemo(stockageNavigateur, []);` (importer `useMemo` de `react`) ; remplacer les rendus par :
```tsx
        {onglet === "accueil" && (route.nom === "groupe"
          ? <Groupe key={route.id} api={api} id={route.id} onglet={route.onglet} personId={moi.id} stockage={stockage} />
          : <MesGroupes api={api} personId={moi.id} stockage={stockage} />)}
```

Dans `app/src/App.tsx` : importer `import { demarrerEnvoi } from "./lib/envoi";` et `import { stockageNavigateur } from "./lib/horsLigne";`, puis ajouter après l'effet `rafraichir` :
```tsx
  // Déclarations faites hors ligne : envoyées dès que la personne est connectée et à chaque retour du réseau
  useEffect(() => (api && moi ? demarrerEnvoi(api, stockageNavigateur()) : undefined), [moi]);
```

Ajouter à `app/src/styles.css` :
```css
fieldset.sans-cadre { border: 0; padding: 0; margin: 0; min-width: 0; }
```

- [ ] **Step 4: Lancer les tests et compiler**

Run: `cd D:\njangi237\app && npm test && npm run build`
Expected: PASS ; build OK.

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add app && git commit -m "Lot 4 : espace membre branché, Mes groupes enrichi, temps réel et hors ligne côté trésorier

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Mise en ligne et essai réel à deux

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Publier**

Run: `cd D:\njangi237\app && npm run build && npx wrangler pages deploy dist --project-name njangi237 --branch v2 --commit-dirty=true`
Expected: « Deployment complete ».

- [ ] **Step 2: Essai réel (point d'arrêt)**

Avec Olivier (trésorier de « Groupe test ») et Cathy (membre) — deux téléphones :
1. Olivier ouvre un cycle. Cathy voit « À payer » sur sa carte « Mes groupes » et dans l'espace du groupe, l'ordre des tours et la date estimée.
2. Cathy déclare un paiement MoMo (référence fictive « TEST-1 »). **Sans recharger**, Olivier voit apparaître la déclaration « À valider » (temps réel) et la valide ; Cathy voit « Payé ✓ » sans recharger.
3. Cathy coupe les données mobiles, ouvre l'application (données gardées, bandeau « Hors ligne »), déclare un règlement de dette ou un paiement si un cycle est ouvert → « envoyée automatiquement au retour du réseau » ; elle remet les données → la déclaration part (vérifier en base qu'il n'y a qu'un paiement avec cet identifiant).
Vérifier la base après chaque étape (`execute_sql`).

- [ ] **Step 3: Documenter et commit**

Dans `README.md`, section v2, ajouter :
```markdown
- Espace membre (lot 4) : cycle en cours, déclaration MoMo/OM/espèces, dettes, ordre des tours avec date estimée, historique ; cartes « Mes groupes » (à payer / payé / à valider). Temps réel (Supabase Realtime) et hors ligne : dernières données gardées sur le téléphone (localStorage), déclarations en file envoyées au retour du réseau.
```
```bash
cd D:\njangi237 && git add README.md && git commit -m "Lot 4 : espace membre en ligne

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
