# Njangi237 v2 — Lot 6 : mode démo, v1 sur /v1/ et bascule — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à n'importe qui d'essayer Njangi237 sans compte (bouton « Essayer la démo » : tontine de 12 membres et cotisation fictives, profils Tina trésorière et Alice membre), garder la v1 accessible sur `/v1/` avec ses données, puis publier la v2 sur `njangi237.pages.dev` après le feu vert d'Olivier.

**Architecture:** Un moteur pur (`app/src/lib/demo/`) rejoue en TypeScript les règles des fonctions SQL 0003 à 0006 et 0008 sur un état en mémoire, avec les mêmes messages d'erreur. `demoApi` implémente le contrat `Api` au-dessus du moteur : état dans le `localStorage` (relu à chaque action, écrit seulement si l'action réussit), profil et drapeau du mode démo dans le `sessionStorage`, synchronisation entre onglets par `BroadcastChannel`. Les écrans ne changent presque pas : ils ne dépendent que du contrat. La v1 (fichiers de la racine) est déplacée dans `app/public/v1/`, exclue du précache de la v2.

**Tech Stack:** React 18.3.1, TypeScript, Vite 8.3.4, vite-plugin-pwa 2.0.0 (Workbox), Vitest 4.1.11, React Testing Library 16.3.3, user-event 14.6.7 ; Cloudflare Pages (wrangler).

**Spec:** `docs/superpowers/specs/2026-10-16-njangi237-v2-design.md` — section « Mode démo », section 7 (architecture : `demoApi`), section 8 (tests : « mêmes scénarios rejoués sur demoApi »), section 9 (Cloudflare Pages, étiquette `v1`), section 10 lot 6.

### Décisions d'Olivier (2026-10-17)

1. **Accès à la démo** : bouton « Essayer la démo » sur l'écran de connexion.
2. **Anciens utilisateurs de la v1** : la v1 reste sur `/v1/` (même origine : la clé `applica_data_v1` du `localStorage` reste lisible), avec un lien « Vous utilisiez l'ancienne version ? Vos données sont ici → ».
3. **Bascule** : à la fin du lot 6, seulement après son feu vert explicite.

### Écarts assumés par rapport à la conception

1. **Moteur en plusieurs fichiers** (`etat`, `membres`, `cycles`, `paiements`, `tours`, `vues`) au lieu d'un seul `moteur.ts` : chaque fichier correspond à une migration SQL et reste lisible d'un coup d'œil.
2. **Données de démonstration rejouées** : `donnees.ts` ne pose pas un état à la main, il appelle les fonctions du moteur (création, invitations acceptées, paiements, clôture, remise). Les données respectent donc toujours les règles.
3. **Indisponible en démo** : connexion, invitation ouverte depuis un lien, nouveau PIN, changement de PIN, amorçage, création de groupe. Ils renvoient « Indisponible en mode démo ». Les invitations envoyées par le trésorier rendent un lien fictif (`LienEnvoye.demo = true`), sans bouton WhatsApp.
4. **Vue du trésorier** : en démo, tous les paiements du groupe sont renvoyés (la borne de `supabaseApi` existe à cause de la limite de 1 000 lignes de l'API, sans objet ici).
5. **Application sans configuration Supabase** : elle démarre directement en démo (au lieu de l'écran « Application non configurée ») ; le bouton « Quitter la démo » n'y est pas proposé.

## Global Constraints

- Le contrat `Api` (`app/src/lib/types.ts`) ne change pas, sauf le champ facultatif `LienEnvoye.demo?: boolean`.
- La démo n'appelle jamais Supabase et n'écrit rien sur le serveur : tout reste dans le navigateur.
- Données de la démo rangées à part dans le `localStorage` (préfixe `njangi.demo:`) : jamais mêlées aux vues gardées et à la file hors ligne d'un vrai compte sur le même téléphone.
- Messages d'erreur du moteur identiques à ceux des fonctions SQL (l'écran affiche le même texte en démo et en production).
- La clé `applica_data_v1` (données de la v1) n'est jamais lue, écrite ni effacée par la v2.
- Bascule en production (`--branch main`) uniquement après le feu vert explicite d'Olivier. Le secret `NJANGI_POIVRE` n'est pas touché.
- Branche `v2-lot6` ; commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commandes : `cd D:\njangi237\app && npm test` ; `npm run build` ; `node scripts/verifier-dist.mjs`.

## Review Focus

1. **Deux onglets, Tina dans l'un et Alice dans l'autre** : une déclaration d'Alice apparaît chez Tina sans recharger → test Task 5 (`abonner` prévenu par le canal d'un autre onglet).
2. **Vrai compte et démo sur le même téléphone** : la démo n'écrase ni la personne gardée hors ligne, ni les vues, ni la file d'envoi du vrai compte → test Task 5 (`stockageNavigateur("njangi.demo:")` préfixe toutes les clés).
3. **État de démo abîmé ou d'une ancienne version** (JSON invalide, `version` différente) : la démo repart des données fictives sans planter → test Task 5.
4. **Action refusée** (clôture avec un paiement à valider, ordre verrouillé…) : l'état enregistré ne bouge pas et le message est celui de la base → tests Tasks 1 à 3 (messages) et Task 5 (rien n'est écrit).
5. **Service worker de la v1 sous `/v1/`** : il ne doit pas effacer les caches de la v2, et celui de la v2 ne doit pas servir la page de la v2 à la place de `/v1/` → contrôle `scripts/verifier-dist.mjs`, Task 7.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `app/src/lib/demo/etat.ts` | Types de l'état, contexte d'action (`Ctx`), contrôles communs, journal |
| `app/src/lib/demo/membres.ts` | Groupes et membres (= 0003) |
| `app/src/lib/demo/cycles.ts` | Cycles et désignation des bénéficiaires (= 0004) |
| `app/src/lib/demo/paiements.ts` | Déclarations, espèces, validation, contestation, dettes (= 0005) |
| `app/src/lib/demo/tours.ts` | Ordre, tirage, échanges, remises, nouveau tour (= 0006) |
| `app/src/lib/demo/vues.ts` | Lectures : vue trésorier, vue membre, Mes groupes, journal (= RLS, 0002, 0008) |
| `app/src/lib/demo/donnees.ts` | Données fictives datées par rapport à aujourd'hui |
| `app/src/lib/demo/demoApi.ts` | Contrat `Api` au-dessus du moteur |
| `app/src/lib/demo/modeDemo.ts` | Drapeau et profil (sessionStorage), entrer / changer / quitter |
| `app/src/test/demo.ts` | Petit monde de test (tontine de 4) |
| `app/src/lib/horsLigne.ts` | `stockageNavigateur(prefixe)` |
| `app/src/lib/api.ts` | Choix démo ou Supabase, stockage préfixé |
| `app/src/lib/types.ts` | `LienEnvoye.demo` |
| `app/src/ui/BandeauDemo.tsx` | Bandeau « Mode démo » |
| `app/src/ui/Connexion.tsx`, `ui/Lien.tsx`, `ui/Coque.tsx`, `App.tsx`, `styles.css` | Branchements |
| `app/public/v1/` | La v1 (déplacée depuis la racine) |
| `app/vite.config.ts` | v1 hors précache et hors repli de navigation |
| `app/scripts/verifier-dist.mjs` | Contrôle du `dist` |
| `README.md` | Racine réécrite (v2 dans `app/`, v1 archivée) |

---

### Task 1: Moteur — état, groupes, membres, cycles

**Files:**
- Create: `app/src/lib/demo/etat.ts`, `app/src/lib/demo/membres.ts`, `app/src/lib/demo/cycles.ts`, `app/src/test/demo.ts`
- Test: `app/src/lib/demo/membres.test.ts`, `app/src/lib/demo/cycles.test.ts`

**Interfaces:**
- Produces (`etat.ts`): `EtatDemo`, `Ctx { acteur; maintenant(): Date; id(): string; hasard(): number }`, `etatVide()`, `VERSION_DEMO = 1`, `refus(message): never`, `horodatage(c)`, `aujourdhui(c)`, `groupeDe`, `membreDe`, `cycleDe`, `comptes(e, groupId)`, `estMembre`, `estTresorier`, `exigerTresorier`, `exigerTontine`, `garderUnTresorier`, `journaliser`, `parRang`, `ajouterPersonne`.
- Produces (`membres.ts`): `creerGroupe(e, c, g: NouveauGroupe) → { groupId, membershipId }`, `rejoindre(e, c, membershipId)`, `ajouterMembre(e, c, groupId, nom, tel) → string`, `changerRole(e, c, membershipId, role)`, `apercuRetrait(e, c, membershipId) → ApercuRetrait`, `retirerMembre(e, c, membershipId) → ApercuRetrait`.
- Produces (`cycles.ts`): `designerBeneficiaires(e, c, cycleId) → number`, `ouvrirCycle(e, c, groupId, libelle, echeance) → string`, `cloreCycle(e, c, cycleId) → { dettes, montant }`, `rouvrirCycle(e, c, cycleId)`.
- Règle commune : chaque fonction **modifie** `e` et peut lever une erreur après une modification partielle. L'appelant (`demoApi`) relit l'état à chaque action et n'enregistre qu'en cas de succès, ce qui joue le rôle de la transaction SQL.

- [ ] **Step 1: Se placer sur la branche** (créée avec ce plan, depuis `main` à jour)

```bash
cd D:\njangi237 && git checkout v2-lot6 && git log --oneline -1
```

- [ ] **Step 2: Écrire `etat.ts`** (types et contrôles, sans logique métier propre : rien à tester seul)

```ts
import type { Cycle, Dette, Groupe, Membre, MoyenPaiement, Paiement, Remise } from "../types";

export interface PersonneDemo { id: string; phone: string; full_name: string }
export interface GroupeDemo extends Groupe { max_members: number }
export interface MembreDemo extends Membre { group_id: string }
export interface CycleDemo extends Cycle { group_id: string }
export interface PaiementDemo extends Paiement { group_id: string; declared_by: string }
export interface DetteDemo extends Dette { group_id: string }
export interface RemiseDemo extends Remise { group_id: string; method: MoyenPaiement | null; reference: string | null }
export interface EntreeDemo {
  id: number; group_id: string; actor: string | null; action: string; details: Record<string, unknown>; created_at: string; visible: boolean;
}

/** À augmenter si la forme de l'état change : un état gardé d'une autre version est remplacé par les données de démonstration. */
export const VERSION_DEMO = 1;
export interface EtatDemo {
  version: number; personnes: PersonneDemo[]; groupes: GroupeDemo[]; membres: MembreDemo[]; cycles: CycleDemo[];
  paiements: PaiementDemo[]; dettes: DetteDemo[]; remises: RemiseDemo[]; journal: EntreeDemo[]; prochainJournal: number;
}
/** Contexte d'une action : qui agit (identifiant de personne), l'heure, les identifiants et le hasard (fixés dans les tests). */
export interface Ctx { acteur: string; maintenant: () => Date; id: () => string; hasard: () => number }

export const etatVide = (): EtatDemo => ({
  version: VERSION_DEMO, personnes: [], groupes: [], membres: [], cycles: [], paiements: [], dettes: [], remises: [],
  journal: [], prochainJournal: 1,
});

/** Refus d'une règle : même message que la fonction SQL correspondante. */
export function refus(message: string): never { throw new Error(message); }
export const horodatage = (c: Ctx) => c.maintenant().toISOString();
export const aujourdhui = (c: Ctx) => horodatage(c).slice(0, 10);

export const groupeDe = (e: EtatDemo, id: string) => e.groupes.find((g) => g.id === id) ?? refus("Groupe introuvable");
export const membreDe = (e: EtatDemo, id: string) => e.membres.find((m) => m.id === id) ?? refus("Membre introuvable");
export const cycleDe = (e: EtatDemo, id: string) => e.cycles.find((x) => x.id === id) ?? refus("Cycle introuvable");

/** Adhésions « comptées » : invitées ou actives (`status <> 'retire'` en base). */
export const comptes = (e: EtatDemo, groupId: string) => e.membres.filter((m) => m.group_id === groupId && m.status !== "retire");
export const estMembre = (e: EtatDemo, groupId: string, personId: string) =>
  e.membres.some((m) => m.group_id === groupId && m.person_id === personId && m.status === "actif");
export const estTresorier = (e: EtatDemo, groupId: string, personId: string) =>
  e.membres.some((m) => m.group_id === groupId && m.person_id === personId && m.status === "actif" && m.role === "tresorier");

export function exigerTresorier(e: EtatDemo, groupId: string, c: Ctx) {
  if (!estTresorier(e, groupId, c.acteur)) refus("Réservé aux trésoriers du groupe");
}
export function exigerTontine(e: EtatDemo, groupId: string) {
  if (groupeDe(e, groupId).type !== "tontine") refus("Réservé aux tontines");
}
export function garderUnTresorier(e: EtatDemo, groupId: string, sauf: string) {
  if (!e.membres.some((m) => m.group_id === groupId && m.role === "tresorier" && m.status === "actif" && m.id !== sauf))
    refus("Le groupe doit garder au moins un trésorier actif");
}
export function journaliser(e: EtatDemo, c: Ctx, groupId: string, action: string, details: Record<string, unknown> = {}, visible = false) {
  e.journal.push({ id: e.prochainJournal++, group_id: groupId, actor: c.acteur, action, details, created_at: horodatage(c), visible });
}
/** Ordre des tours : position, puis date d'arrivée (`order by position nulls last, created_at`). */
export const parRang = (a: MembreDemo, b: MembreDemo) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.created_at.localeCompare(b.created_at);
export function ajouterPersonne(e: EtatDemo, p: PersonneDemo) {
  if (!e.personnes.some((x) => x.id === p.id)) e.personnes.push(p);
}
```

- [ ] **Step 3: Écrire le monde de test `app/src/test/demo.ts`**

```ts
import { ajouterPersonne, etatVide, type Ctx } from "../lib/demo/etat";
import { ajouterMembre, creerGroupe, rejoindre } from "../lib/demo/membres";

/** Tontine de 4 (5 000 FCFA, un bénéficiaire) : Tina trésorière (1), Alice (2) et Bob (3) actifs, Ines invitée (4). */
export function monde() {
  const e = etatVide();
  let n = 0;
  let t = Date.parse("2026-09-01T08:00:00Z");
  const ctx = (acteur: string): Ctx => ({ acteur, maintenant: () => new Date(t), id: () => `id-${++n}`, hasard: () => 0.42 });
  const avancer = (heures = 1) => { t += heures * 3_600_000; };
  const personne = (id: string, nom: string, tel: string) => { ajouterPersonne(e, { id, full_name: nom, phone: tel }); return ctx(id); };

  const tina = personne("u-tina", "Tina", "237690000001");
  const { groupId, membershipId: mTina } = creerGroupe(e, ctx("plateforme"), {
    nom: "Tontine test", type: "tontine", montant: 5000, frequence: "mensuelle", beneficiaires: 1,
    tresorier_nom: "Tina", tresorier_telephone: "690000001",
  });
  rejoindre(e, tina, mTina);
  avancer();
  const alice = personne("u-alice", "Alice", "237690000002");
  const mAlice = ajouterMembre(e, tina, groupId, "Alice", "690000002"); rejoindre(e, alice, mAlice);
  const bob = personne("u-bob", "Bob", "237690000003");
  const mBob = ajouterMembre(e, tina, groupId, "Bob", "690000003"); rejoindre(e, bob, mBob);
  const mInes = ajouterMembre(e, tina, groupId, "Ines", "690000004");
  avancer();
  return { e, ctx, avancer, groupId, tina, alice, bob, m: { tina: mTina, alice: mAlice, bob: mBob, ines: mInes } };
}
```

- [ ] **Step 4: Écrire les tests qui échouent — `membres.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import { ouvrirCycle } from "./cycles";
import { ajouterMembre, apercuRetrait, changerRole, retirerMembre } from "./membres";

describe("moteur démo : membres", () => {
  it("place le nouveau membre en dernière position, invité", () => {
    const w = monde();
    const id = ajouterMembre(w.e, w.tina, w.groupId, "Zoé", "690000009");
    expect(w.e.membres.find((m) => m.id === id)).toMatchObject({ position: 5, status: "invite", role: "membre", phone: "237690000009" });
  });
  it("refuse un numéro déjà dans le groupe, accepte le retour d'un membre retiré", () => {
    const w = monde();
    expect(() => ajouterMembre(w.e, w.tina, w.groupId, "Bob bis", "690000003")).toThrow("Ce numéro est déjà dans le groupe");
    retirerMembre(w.e, w.tina, w.m.bob);
    expect(ajouterMembre(w.e, w.tina, w.groupId, "Bob", "690000003")).toBe(w.m.bob);
    expect(w.e.membres.find((m) => m.id === w.m.bob)?.status).toBe("invite");
  });
  it("réserve les actions au trésorier et refuse un numéro invalide", () => {
    const w = monde();
    expect(() => ajouterMembre(w.e, w.alice, w.groupId, "Zoé", "690000009")).toThrow("Réservé aux trésoriers du groupe");
    expect(() => ajouterMembre(w.e, w.tina, w.groupId, "Zoé", "12")).toThrow("Numéro de téléphone invalide");
  });
  it("garde au moins un trésorier actif", () => {
    const w = monde();
    expect(() => changerRole(w.e, w.tina, w.m.tina, "membre")).toThrow("Le groupe doit garder au moins un trésorier actif");
    changerRole(w.e, w.tina, w.m.alice, "tresorier");
    changerRole(w.e, w.tina, w.m.tina, "membre");
    expect(w.e.membres.find((m) => m.id === w.m.tina)?.role).toBe("membre");
  });
  it("refuse de retirer le bénéficiaire du cycle ouvert", () => {
    const w = monde();
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);   // Tina, première, est bénéficiaire
    changerRole(w.e, w.tina, w.m.alice, "tresorier");
    expect(() => retirerMembre(w.e, w.alice, w.m.tina)).toThrow("Ce membre est bénéficiaire du cycle en cours : remplacez-le d'abord");
  });
  it("fige ce que doit le membre qui part et l'inscrit au journal", () => {
    const w = monde();
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(apercuRetrait(w.e, w.tina, w.m.bob)).toEqual({ deja_servi: false, cycles_restants: 1, montant_restant: 5000, dettes: 0 });
    retirerMembre(w.e, w.tina, w.m.bob);
    expect(w.e.membres.find((m) => m.id === w.m.bob)).toMatchObject({ status: "retire", position: null, left_balance: 5000 });
    expect(w.e.journal.slice(-2).map((j) => [j.action, j.visible])).toEqual([["membre_retire", true], ["solde_depart", false]]);
  });
});
```

- [ ] **Step 5: Écrire les tests qui échouent — `cycles.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import { cloreCycle, ouvrirCycle, rouvrirCycle } from "./cycles";
import { ajouterMembre } from "./membres";

describe("moteur démo : cycles", () => {
  it("ouvre un cycle, verrouille l'ordre et désigne le premier bénéficiaire", () => {
    const w = monde();
    const id = ouvrirCycle(w.e, w.tina, w.groupId, " Septembre ", "2026-09-30");
    expect(w.e.cycles.find((c) => c.id === id)).toMatchObject({ label: "Septembre", round: 1, number: 1, amount_expected: 5000, status: "ouvert" });
    expect(w.e.groupes[0].order_locked).toBe(true);
    expect(w.e.remises).toEqual([expect.objectContaining({ cycle_id: id, membership_id: w.m.tina, amount_expected: 20000, status: "prevu" })]);
    expect(w.e.journal.at(-1)).toMatchObject({ action: "cycle_ouvert", visible: true, details: { cycle: "Septembre" } });
  });
  it("refuse un second cycle ouvert, un libellé vide et un membre non trésorier", () => {
    const w = monde();
    expect(() => ouvrirCycle(w.e, w.tina, w.groupId, "  ", null)).toThrow("Libellé du cycle obligatoire");
    expect(() => ouvrirCycle(w.e, w.alice, w.groupId, "Septembre", null)).toThrow("Réservé aux trésoriers du groupe");
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(() => ouvrirCycle(w.e, w.tina, w.groupId, "Octobre", null)).toThrow("Un cycle est déjà ouvert : clôturez-le d'abord");
  });
  it("à la clôture, crée une dette pour chaque membre compté (invité compris), pas pour un arrivé après l'ouverture", () => {
    const w = monde();
    const id = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    w.avancer();
    ajouterMembre(w.e, w.tina, w.groupId, "Zoé", "690000009");
    expect(cloreCycle(w.e, w.tina, id)).toEqual({ dettes: 4, montant: 20000 });
    expect(w.e.dettes.map((d) => d.membership_id).sort()).toEqual([w.m.alice, w.m.bob, w.m.ines, w.m.tina].sort());
    expect(w.e.cycles[0]).toMatchObject({ status: "clos" });
    expect(() => cloreCycle(w.e, w.tina, id)).toThrow("Ce cycle est déjà clos");
  });
  it("rouvre seulement le dernier cycle clos, et efface ses dettes", () => {
    const w = monde();
    const c1 = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    cloreCycle(w.e, w.tina, c1);
    expect(() => rouvrirCycle(w.e, w.tina, "inconnu")).toThrow("Cycle introuvable");
    rouvrirCycle(w.e, w.tina, c1);
    expect(w.e.dettes).toEqual([]);
    expect(w.e.cycles[0].status).toBe("ouvert");
    expect(() => rouvrirCycle(w.e, w.tina, c1)).toThrow("Ce cycle n'est pas clos");
    cloreCycle(w.e, w.tina, c1);
    const c2 = ouvrirCycle(w.e, w.tina, w.groupId, "Octobre", null);
    cloreCycle(w.e, w.tina, c2);
    expect(() => rouvrirCycle(w.e, w.tina, c1)).toThrow("Seul le dernier cycle peut être rouvert");
  });
  it("une cotisation n'a pas de bénéficiaire", () => {
    const w = monde();
    w.e.groupes[0].type = "cotisation";
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(w.e.remises).toEqual([]);
  });
});
```

- [ ] **Step 6: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo`
Expected: FAIL (`Failed to resolve import "./membres"` / `"./cycles"`).

- [ ] **Step 7: Écrire `membres.ts`**

```ts
import { normaliserTelephone } from "../telephone";
import type { ApercuRetrait, NouveauGroupe, RoleGroupe } from "../types";
import {
  comptes, exigerTresorier, garderUnTresorier, groupeDe, horodatage, journaliser, membreDe, refus, type Ctx, type EtatDemo,
} from "./etat";

/** Création d'un groupe par la plateforme (en démo : seulement pour bâtir les données). Le trésorier est invité, position 1. */
export function creerGroupe(e: EtatDemo, c: Ctx, g: NouveauGroupe): { groupId: string; membershipId: string } {
  if (!g.nom.trim()) refus("Nom du groupe obligatoire");
  if (!g.tresorier_nom.trim()) refus("Nom du trésorier obligatoire");
  if (!(g.montant > 0)) refus("Montant invalide");
  if (!(g.beneficiaires >= 1)) refus("Nombre de bénéficiaires par cycle invalide");
  const groupId = c.id();
  e.groupes.push({ id: groupId, name: g.nom.trim(), type: g.type, amount: g.montant, frequency: g.frequence,
    beneficiaries_per_cycle: g.beneficiaires, current_round: 1, order_locked: false, max_members: 50 });
  const membershipId = c.id();
  e.membres.push({ id: membershipId, group_id: groupId, display_name: g.tresorier_nom.trim(), phone: normaliserTelephone(g.tresorier_telephone),
    role: "tresorier", status: "invite", position: 1, person_id: null, left_balance: null, created_at: horodatage(c) });
  journaliser(e, c, groupId, "groupe_cree", { nom: g.nom.trim() }, true);
  return { groupId, membershipId };
}

/** Invitation acceptée (= finaliser_invitation) : `c.acteur` est la personne, déjà présente dans `e.personnes`. */
export function rejoindre(e: EtatDemo, c: Ctx, membershipId: string) {
  const m = membreDe(e, membershipId);
  if (m.status !== "invite") refus("Lien invalide ou expiré");
  m.person_id = c.acteur; m.status = "actif";
  journaliser(e, c, m.group_id, "membre_rejoint", { nom: m.display_name }, true);
}

export function ajouterMembre(e: EtatDemo, c: Ctx, groupId: string, nom: string, telephone: string): string {
  const phone = normaliserTelephone(telephone);
  exigerTresorier(e, groupId, c);
  if (!nom.trim()) refus("Nom obligatoire");
  const g = groupeDe(e, groupId);
  const actuels = comptes(e, groupId);
  if (actuels.length >= g.max_members) refus(`Nombre maximum de membres atteint (${g.max_members})`);
  const position = Math.max(0, ...actuels.map((m) => m.position ?? 0)) + 1;
  const ancien = e.membres.find((m) => m.group_id === groupId && m.phone === phone);
  let id: string;
  if (ancien) {
    if (ancien.status !== "retire") refus("Ce numéro est déjà dans le groupe");
    Object.assign(ancien, { display_name: nom.trim(), role: "membre", status: "invite", position });
    id = ancien.id;
  } else {
    id = c.id();
    e.membres.push({ id, group_id: groupId, display_name: nom.trim(), phone, role: "membre", status: "invite", position,
      person_id: null, left_balance: null, created_at: horodatage(c) });
  }
  journaliser(e, c, groupId, "membre_ajoute", { nom: nom.trim() });
  return id;
}

export function changerRole(e: EtatDemo, c: Ctx, membershipId: string, role: RoleGroupe) {
  const m = membreDe(e, membershipId);
  exigerTresorier(e, m.group_id, c);
  if (m.status === "retire") refus("Ce membre est retiré");
  if (m.role === "tresorier" && role === "membre") garderUnTresorier(e, m.group_id, m.id);
  m.role = role;
  journaliser(e, c, m.group_id, "role_change", { nom: m.display_name, role });
}

/** Ce que le membre doit encore s'il quitte le groupe maintenant. */
export function apercuRetrait(e: EtatDemo, c: Ctx, membershipId: string): ApercuRetrait {
  const m = membreDe(e, membershipId);
  exigerTresorier(e, m.group_id, c);
  const g = groupeDe(e, m.group_id);
  const ouvert = e.cycles.find((x) => x.group_id === g.id && x.status === "ouvert");
  const servi = e.remises.some((r) => r.membership_id === m.id && r.round === g.current_round && r.status === "remis");
  let restants = 0;
  if (g.type === "tontine" && servi) {
    const attente = comptes(e, g.id)
      .filter((x) => x.id !== m.id && !e.remises.some((r) => r.membership_id === x.id && r.round === g.current_round)).length;
    restants = Math.ceil(attente / g.beneficiaries_per_cycle);
  }
  if (ouvert && !e.paiements.some((p) => p.cycle_id === ouvert.id && p.membership_id === m.id && p.debt_id === null && p.status === "valide"))
    restants += 1;
  const dettes = e.dettes.filter((d) => d.membership_id === m.id && !d.settled_at).reduce((s, d) => s + d.amount, 0);
  return { deja_servi: servi, cycles_restants: restants, montant_restant: restants * g.amount, dettes };
}

export function retirerMembre(e: EtatDemo, c: Ctx, membershipId: string): ApercuRetrait {
  const m = membreDe(e, membershipId);
  exigerTresorier(e, m.group_id, c);
  if (m.status === "retire") refus("Ce membre est déjà retiré");
  if (m.role === "tresorier") garderUnTresorier(e, m.group_id, m.id);
  if (e.remises.some((r) => r.membership_id === m.id && r.status === "prevu"
      && e.cycles.some((x) => x.id === r.cycle_id && x.status === "ouvert")))
    refus("Ce membre est bénéficiaire du cycle en cours : remplacez-le d'abord");
  const apercu = apercuRetrait(e, c, membershipId);
  // Ce qu'il doit encore est figé : recalculé plus tard, l'aperçu diminuerait à mesure que les autres sont servis
  Object.assign(m, { status: "retire", position: null, left_balance: apercu.montant_restant });
  journaliser(e, c, m.group_id, "membre_retire", { nom: m.display_name }, true);
  journaliser(e, c, m.group_id, "solde_depart", { nom: m.display_name, ...apercu });
  return apercu;
}
```

- [ ] **Step 8: Écrire `cycles.ts`**

```ts
import {
  comptes, cycleDe, exigerTresorier, groupeDe, horodatage, journaliser, parRang, refus, type Ctx, type EtatDemo,
} from "./etat";

/** Les k membres suivants dans l'ordre, sans remise dans le tour du cycle, deviennent bénéficiaires prévus. */
export function designerBeneficiaires(e: EtatDemo, c: Ctx, cycleId: string): number {
  const cy = cycleDe(e, cycleId);
  const g = groupeDe(e, cy.group_id);
  if (g.type !== "tontine") return 0;
  const membres = comptes(e, g.id);
  const part = Math.floor((cy.amount_expected * membres.length) / g.beneficiaries_per_cycle);
  const choisis = membres.filter((m) => !e.remises.some((r) => r.membership_id === m.id && r.round === cy.round))
    .sort(parRang).slice(0, g.beneficiaries_per_cycle);
  for (const m of choisis)
    e.remises.push({ id: c.id(), group_id: g.id, cycle_id: cy.id, round: cy.round, membership_id: m.id, amount_expected: part,
      amount: null, status: "prevu", paid_on: null, method: null, reference: null });
  return choisis.length;
}

export function ouvrirCycle(e: EtatDemo, c: Ctx, groupId: string, libelle: string, echeance: string | null): string {
  exigerTresorier(e, groupId, c);
  if (!libelle.trim()) refus("Libellé du cycle obligatoire");
  const g = groupeDe(e, groupId);
  if (e.cycles.some((x) => x.group_id === groupId && x.status === "ouvert")) refus("Un cycle est déjà ouvert : clôturez-le d'abord");
  if (!comptes(e, groupId).length) refus("Aucun membre dans le groupe");
  const number = Math.max(0, ...e.cycles.filter((x) => x.group_id === groupId && x.round === g.current_round).map((x) => x.number)) + 1;
  const id = c.id();
  e.cycles.push({ id, group_id: groupId, round: g.current_round, number, label: libelle.trim(), due_date: echeance,
    amount_expected: g.amount, status: "ouvert", opened_at: horodatage(c), closed_at: null });
  if (g.type === "tontine") {
    g.order_locked = true;
    if (designerBeneficiaires(e, c, id) === 0) refus("Tour terminé : tous les membres ont reçu leur part. Démarrez un nouveau tour.");
  }
  journaliser(e, c, groupId, "cycle_ouvert", { cycle: libelle.trim() }, true);
  return id;
}

export function cloreCycle(e: EtatDemo, c: Ctx, cycleId: string): { dettes: number; montant: number } {
  const cy = cycleDe(e, cycleId);
  exigerTresorier(e, cy.group_id, c);
  if (cy.status !== "ouvert") refus("Ce cycle est déjà clos");
  const attente = e.paiements.filter((p) => p.cycle_id === cy.id && p.debt_id === null && p.status === "declare").length;
  if (attente > 0) refus(`${attente} paiement(s) à valider ou contester avant de clore`);
  let n = 0;
  for (const m of comptes(e, cy.group_id).filter((x) => x.created_at <= cy.opened_at)) {
    const paye = e.paiements.filter((p) => p.cycle_id === cy.id && p.membership_id === m.id && p.debt_id === null && p.status === "valide")
      .reduce((s, p) => s + p.amount, 0);
    if (paye < cy.amount_expected) {
      e.dettes.push({ id: c.id(), group_id: cy.group_id, membership_id: m.id, cycle_id: cy.id, amount: cy.amount_expected - paye, settled_at: null });
      n++;
    }
  }
  const montant = e.dettes.filter((d) => d.cycle_id === cy.id).reduce((s, d) => s + d.amount, 0);
  cy.status = "clos"; cy.closed_at = horodatage(c);
  journaliser(e, c, cy.group_id, "cycle_clos", { cycle: cy.label, dettes: n }, true);
  return { dettes: n, montant };
}

export function rouvrirCycle(e: EtatDemo, c: Ctx, cycleId: string) {
  const cy = cycleDe(e, cycleId);
  exigerTresorier(e, cy.group_id, c);
  if (cy.status !== "clos") refus("Ce cycle n'est pas clos");
  if (e.cycles.some((x) => x.group_id === cy.group_id && x.status === "ouvert")) refus("Un autre cycle est ouvert");
  if (e.cycles.some((x) => x.group_id === cy.group_id && (x.round > cy.round || (x.round === cy.round && x.number > cy.number))))
    refus("Seul le dernier cycle peut être rouvert");
  if (e.dettes.some((d) => d.cycle_id === cy.id
      && (d.settled_at || e.paiements.some((p) => p.debt_id === d.id && p.status !== "conteste"))))
    refus("Des dettes de ce cycle ont déjà des règlements");
  e.dettes = e.dettes.filter((d) => d.cycle_id !== cy.id);
  cy.status = "ouvert"; cy.closed_at = null;
  journaliser(e, c, cy.group_id, "cycle_rouvert", { cycle: cy.label });
}
```

- [ ] **Step 9: Lancer les tests**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo`
Expected: PASS (11 tests).

- [ ] **Step 10: Commit**

```bash
cd D:\njangi237 && git add app/src/lib/demo app/src/test/demo.ts && git commit -m "Lot 6 : moteur de démo, groupes, membres et cycles (mêmes règles que 0003 et 0004)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Moteur — paiements et dettes

**Files:**
- Create: `app/src/lib/demo/paiements.ts`
- Test: `app/src/lib/demo/paiements.test.ts`

**Interfaces:**
- Consumes: `etat.ts` (Task 1), `cloreCycle`/`ouvrirCycle` (Task 1, dans les tests), `Declaration` (`types.ts`).
- Produces: `declarerPaiement(e, c, d: Declaration)`, `saisirEspeces(e, c, id, membershipId, cycleId, montant, detteId?)`, `validerPaiement(e, c, paiementId)`, `contesterPaiement(e, c, paiementId, motif)`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import type { Declaration, MoyenPaiement } from "../types";
import { cloreCycle, ouvrirCycle } from "./cycles";
import { retirerMembre } from "./membres";
import { contesterPaiement, declarerPaiement, saisirEspeces, validerPaiement } from "./paiements";

const decl = (id: string, cycleId: string, moyen: MoyenPaiement = "mtn_momo", montant = 5000, detteId: string | null = null): Declaration =>
  ({ id, groupId: "g", cycleId, montant, moyen, reference: moyen === "mtn_momo" ? "MP42" : null, date: "2026-09-02", detteId });

describe("moteur démo : paiements", () => {
  it("exige la référence pour MoMo et Orange Money, et un membre actif du groupe", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(() => declarerPaiement(w.e, w.alice, { ...decl("p1", c), reference: " " }))
      .toThrow("Référence de transaction obligatoire pour MoMo et Orange Money");
    expect(() => declarerPaiement(w.e, w.ctx("u-inconnu"), decl("p1", c))).toThrow("Vous n'êtes pas membre de ce groupe");
    expect(() => declarerPaiement(w.e, w.alice, decl("p1", c, "especes", 0))).toThrow("Montant invalide");
  });
  it("un renvoi de la même déclaration est sans effet ; un second paiement pour le cycle est refusé", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    declarerPaiement(w.e, w.alice, decl("p1", c));
    declarerPaiement(w.e, w.alice, decl("p1", c));
    expect(w.e.paiements).toHaveLength(1);
    expect(() => declarerPaiement(w.e, w.bob, decl("p1", c))).toThrow("Identifiant de paiement déjà utilisé");
    expect(() => declarerPaiement(w.e, w.alice, decl("p2", c))).toThrow("Un paiement est déjà enregistré pour ce cycle");
    contesterPaiement(w.e, w.tina, "p1", "Référence introuvable");
    declarerPaiement(w.e, w.alice, decl("p2", c));
    expect(w.e.paiements.map((p) => p.status)).toEqual(["conteste", "declare"]);
  });
  it("bloque la clôture tant qu'une déclaration attend ; validée, elle évite la dette", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    declarerPaiement(w.e, w.alice, decl("p1", c));
    expect(() => cloreCycle(w.e, w.tina, c)).toThrow("1 paiement(s) à valider ou contester avant de clore");
    expect(() => validerPaiement(w.e, w.alice, "p1")).toThrow("Réservé aux trésoriers du groupe");
    validerPaiement(w.e, w.tina, "p1");
    expect(() => validerPaiement(w.e, w.tina, "p1")).toThrow("Ce paiement n'est pas en attente de validation");
    expect(cloreCycle(w.e, w.tina, c)).toEqual({ dettes: 3, montant: 15000 });
    expect(w.e.dettes.some((d) => d.membership_id === w.m.alice)).toBe(false);
  });
  it("une dette se règle en entier ; la validation la solde, la contestation la rouvre", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    cloreCycle(w.e, w.tina, c);
    const dette = w.e.dettes.find((d) => d.membership_id === w.m.alice)!;
    expect(() => declarerPaiement(w.e, w.alice, decl("r1", c, "especes", 3000, dette.id)))
      .toThrow("Le règlement doit couvrir toute la dette (5000 FCFA)");
    expect(() => declarerPaiement(w.e, w.bob, decl("r1", c, "especes", 5000, dette.id))).toThrow("Dette introuvable");
    declarerPaiement(w.e, w.alice, decl("r1", c, "especes", 5000, dette.id));
    validerPaiement(w.e, w.tina, "r1");
    expect(w.e.dettes.find((d) => d.id === dette.id)?.settled_at).not.toBeNull();
    contesterPaiement(w.e, w.tina, "r1", "Billets refusés");
    expect(w.e.dettes.find((d) => d.id === dette.id)?.settled_at).toBeNull();
    expect(w.e.journal.at(-1)).toMatchObject({ action: "paiement_conteste", visible: false, details: { nom: "Alice", montant: 5000 } });
  });
  it("les espèces saisies par le trésorier sont validées tout de suite ; un retiré ne cotise plus", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    saisirEspeces(w.e, w.tina, "e1", w.m.ines, c, 5000);
    expect(w.e.paiements[0]).toMatchObject({ status: "valide", method: "especes", membership_id: w.m.ines });
    retirerMembre(w.e, w.tina, w.m.bob);
    expect(() => saisirEspeces(w.e, w.tina, "e2", w.m.bob, c, 5000)).toThrow("Ce membre est retiré");
    expect(() => contesterPaiement(w.e, w.tina, "e1", " ")).toThrow("Motif obligatoire");
  });
  it("un paiement validé d'un cycle clos est figé", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    saisirEspeces(w.e, w.tina, "e1", w.m.alice, c, 5000);
    cloreCycle(w.e, w.tina, c);
    expect(() => contesterPaiement(w.e, w.tina, "e1", "Erreur")).toThrow("Ce cycle est clos");
    expect(() => declarerPaiement(w.e, w.bob, decl("p9", c))).toThrow("Ce cycle est clos");
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo/paiements.test.ts`
Expected: FAIL (`Failed to resolve import "./paiements"`).

- [ ] **Step 3: Écrire `paiements.ts`**

```ts
import type { Declaration, MoyenPaiement } from "../types";
import { aujourdhui, cycleDe, exigerTresorier, horodatage, journaliser, membreDe, refus, type Ctx, type DetteDemo, type EtatDemo } from "./etat";

const sansReference = (moyen: MoyenPaiement, reference: string | null) =>
  (moyen === "mtn_momo" || moyen === "orange_money") && !(reference ?? "").trim();

function detteAReglee(e: EtatDemo, detteId: string, membershipId: string, cycleId: string, montant: number): DetteDemo {
  const d = e.dettes.find((x) => x.id === detteId);
  if (!d || d.membership_id !== membershipId || d.cycle_id !== cycleId) return refus("Dette introuvable");
  if (d.settled_at) refus("Cette dette est déjà réglée");
  if (montant < d.amount) refus(`Le règlement doit couvrir toute la dette (${d.amount} FCFA)`);
  return d;
}
/** Index uniques de la base : un paiement non contesté par cycle et par membre, un par dette. */
function exigerUnique(e: EtatDemo, cycleId: string, membershipId: string, detteId: string | null) {
  const doublon = detteId
    ? e.paiements.some((p) => p.debt_id === detteId && p.status !== "conteste")
    : e.paiements.some((p) => p.cycle_id === cycleId && p.membership_id === membershipId && p.debt_id === null && p.status !== "conteste");
  if (doublon) refus("Un paiement est déjà enregistré pour ce cycle");
}
/** Idempotence : la file hors ligne peut renvoyer la même déclaration. */
function dejaRecu(e: EtatDemo, c: Ctx, id: string): boolean {
  const ancien = e.paiements.find((p) => p.id === id);
  if (!ancien) return false;
  return ancien.declared_by === c.acteur || refus("Identifiant de paiement déjà utilisé");
}

export function declarerPaiement(e: EtatDemo, c: Ctx, d: Declaration) {
  if (dejaRecu(e, c, d.id)) return;
  const cy = cycleDe(e, d.cycleId);
  const m = e.membres.find((x) => x.group_id === cy.group_id && x.person_id === c.acteur && x.status === "actif")
    ?? refus("Vous n'êtes pas membre de ce groupe");
  if (!(d.montant > 0)) refus("Montant invalide");
  if (sansReference(d.moyen, d.reference)) refus("Référence de transaction obligatoire pour MoMo et Orange Money");
  if (d.detteId === null) { if (cy.status !== "ouvert") refus("Ce cycle est clos"); }
  else detteAReglee(e, d.detteId, m.id, cy.id, d.montant);
  exigerUnique(e, cy.id, m.id, d.detteId);
  e.paiements.push({ id: d.id, group_id: cy.group_id, cycle_id: cy.id, membership_id: m.id, debt_id: d.detteId, amount: d.montant,
    method: d.moyen, reference: d.reference?.trim() || null, paid_on: d.date || aujourdhui(c), status: "declare",
    contest_reason: null, created_at: horodatage(c), declared_by: c.acteur });
}

export function saisirEspeces(e: EtatDemo, c: Ctx, id: string, membershipId: string, cycleId: string, montant: number, detteId?: string) {
  if (dejaRecu(e, c, id)) return;
  const m = membreDe(e, membershipId);
  exigerTresorier(e, m.group_id, c);
  const cy = e.cycles.find((x) => x.id === cycleId && x.group_id === m.group_id) ?? refus("Cycle introuvable");
  if (!(montant > 0)) refus("Montant invalide");
  let dette: DetteDemo | null = null;
  if (!detteId) {
    // Un membre retiré ne cotise plus, mais peut encore régler ses dettes
    if (m.status === "retire") refus("Ce membre est retiré");
    if (cy.status !== "ouvert") refus("Ce cycle est clos");
  } else dette = detteAReglee(e, detteId, m.id, cy.id, montant);
  exigerUnique(e, cy.id, m.id, detteId ?? null);
  e.paiements.push({ id, group_id: m.group_id, cycle_id: cy.id, membership_id: m.id, debt_id: detteId ?? null, amount: montant,
    method: "especes", reference: null, paid_on: aujourdhui(c), status: "valide", contest_reason: null,
    created_at: horodatage(c), declared_by: c.acteur });
  if (dette) dette.settled_at = horodatage(c);
}

export function validerPaiement(e: EtatDemo, c: Ctx, paiementId: string) {
  const p = e.paiements.find((x) => x.id === paiementId) ?? refus("Paiement introuvable");
  exigerTresorier(e, p.group_id, c);
  if (p.status !== "declare") refus("Ce paiement n'est pas en attente de validation");
  // Un paiement ordinaire ne peut pas entrer dans un cycle déjà clos (les dettes y sont déjà calculées)
  if (p.debt_id === null && cycleDe(e, p.cycle_id).status === "clos") refus("Ce cycle est clos");
  p.status = "valide";
  const dette = e.dettes.find((d) => d.id === p.debt_id);
  if (dette) dette.settled_at = horodatage(c);
}

export function contesterPaiement(e: EtatDemo, c: Ctx, paiementId: string, motif: string) {
  const p = e.paiements.find((x) => x.id === paiementId) ?? refus("Paiement introuvable");
  exigerTresorier(e, p.group_id, c);
  if (!motif.trim()) refus("Motif obligatoire");
  if (p.status === "conteste") refus("Ce paiement est déjà contesté");
  // Cycle clos : un paiement validé est figé, mais une déclaration arrivée trop tard doit pouvoir être écartée
  if (p.debt_id === null && cycleDe(e, p.cycle_id).status === "clos" && p.status === "valide") refus("Ce cycle est clos");
  p.status = "conteste"; p.contest_reason = motif.trim();
  const dette = e.dettes.find((d) => d.id === p.debt_id);
  if (dette) dette.settled_at = null;
  journaliser(e, c, p.group_id, "paiement_conteste", { nom: membreDe(e, p.membership_id).display_name, montant: p.amount, motif: motif.trim() });
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add app/src/lib/demo && git commit -m "Lot 6 : moteur de démo, paiements et dettes (mêmes règles que 0005)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Moteur — tours, remises, lectures et journal

**Files:**
- Create: `app/src/lib/demo/tours.ts`, `app/src/lib/demo/vues.ts`
- Test: `app/src/lib/demo/tours.test.ts`, `app/src/lib/demo/vues.test.ts`

**Interfaces:**
- Consumes: Tasks 1 et 2 ; `resumerGroupe` (`lib/resume.ts`) ; types `VueGroupe`, `VueMembre`, `MonGroupe`, `EntreeJournal`, `OrdreTour`, `Recouvrement`.
- Produces (`tours.ts`): `ordonnerTours(e, c, groupId, ordre: string[])`, `tirerAuSort(e, c, groupId) → string[]`, `echangerTours(e, c, a, b)`, `remplacerBeneficiaire(e, c, remiseId, membershipId)`, `enregistrerRemise(e, c, remiseId, montant, moyen, reference) → { ecart }`, `nouveauTour(e, c, groupId) → number`.
- Produces (`vues.ts`, lecture seule, `acteur` = identifiant de personne): `vueGroupe(e, acteur, groupId) → VueGroupe`, `vueMembre(e, acteur, groupId) → VueMembre`, `mesGroupes(e, acteur) → MonGroupe[]`, `lireJournal(e, acteur, groupId, avant?) → EntreeJournal[]`.

- [ ] **Step 1: Écrire les tests qui échouent — `tours.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import { cloreCycle, ouvrirCycle } from "./cycles";
import { echangerTours, enregistrerRemise, nouveauTour, ordonnerTours, remplacerBeneficiaire, tirerAuSort } from "./tours";

const VERROU = "L'ordre est verrouillé : utilisez l'échange de tours";

describe("moteur démo : tours", () => {
  it("règle l'ordre avant le premier cycle, puis le verrouille", () => {
    const w = monde();
    expect(() => ordonnerTours(w.e, w.tina, w.groupId, [w.m.bob, w.m.alice])).toThrow("La liste doit contenir chaque membre une seule fois");
    ordonnerTours(w.e, w.tina, w.groupId, [w.m.bob, w.m.ines, w.m.alice, w.m.tina]);
    expect(w.e.journal.at(-1)).toMatchObject({ action: "ordre_modifie", visible: true, details: { ordre: ["Bob", "Ines", "Alice", "Tina"] } });
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(w.e.remises[0].membership_id).toBe(w.m.bob);
    expect(() => ordonnerTours(w.e, w.tina, w.groupId, [w.m.tina, w.m.alice, w.m.bob, w.m.ines])).toThrow(VERROU);
    expect(() => tirerAuSort(w.e, w.tina, w.groupId)).toThrow(VERROU);
  });
  it("le tirage au sort donne chaque position une fois et renvoie les noms dans l'ordre", () => {
    const w = monde();
    const noms = tirerAuSort(w.e, w.tina, w.groupId);
    expect([...noms].sort()).toEqual(["Alice", "Bob", "Ines", "Tina"]);
    expect(w.e.membres.map((m) => m.position).sort()).toEqual([1, 2, 3, 4]);
    expect(w.e.journal.at(-1)).toMatchObject({ action: "tirage_au_sort", details: { ordre: noms } });
  });
  it("l'échange déplace aussi la remise prévue ; impossible avec un membre déjà servi", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    echangerTours(w.e, w.tina, w.m.tina, w.m.bob);
    expect(w.e.remises[0].membership_id).toBe(w.m.bob);
    expect(w.e.membres.find((m) => m.id === w.m.bob)?.position).toBe(1);
    enregistrerRemise(w.e, w.tina, w.e.remises[0].id, 20000, "especes", null);
    expect(() => echangerTours(w.e, w.tina, w.m.bob, w.m.alice)).toThrow("Un de ces membres a déjà reçu sa part dans ce tour");
    expect(() => remplacerBeneficiaire(w.e, w.tina, w.e.remises[0].id, w.m.alice)).toThrow("Cette cagnotte est déjà remise");
    cloreCycle(w.e, w.tina, c);
  });
  it("la remise donne l'écart avec le montant attendu et exige la référence MoMo", () => {
    const w = monde();
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    const r = w.e.remises[0].id;
    expect(() => enregistrerRemise(w.e, w.tina, r, 18000, "orange_money", null))
      .toThrow("Référence de transaction obligatoire pour MoMo et Orange Money");
    expect(enregistrerRemise(w.e, w.tina, r, 18000, "orange_money", "OM7")).toEqual({ ecart: -2000 });
    expect(w.e.journal.at(-1)).toMatchObject({ action: "cagnotte_remise", visible: true, details: { nom: "Tina", montant: 18000 } });
  });
  it("un nouveau tour attend que tous soient servis ; un cinquième cycle est refusé", () => {
    const w = monde();
    for (let i = 0; i < 4; i++) {
      const c = ouvrirCycle(w.e, w.tina, w.groupId, `Cycle ${i + 1}`, null);
      if (i === 0) expect(() => nouveauTour(w.e, w.tina, w.groupId)).toThrow("Clôturez d'abord le cycle en cours");
      enregistrerRemise(w.e, w.tina, w.e.remises.at(-1)!.id, 20000, "especes", null);
      cloreCycle(w.e, w.tina, c);
      if (i === 2) expect(() => nouveauTour(w.e, w.tina, w.groupId))
        .toThrow("Le tour n'est pas terminé : tous les membres n'ont pas reçu leur part");
    }
    // Le moteur modifie l'état avant de refuser (demoApi n'enregistre pas l'échec) : on essaie sur une copie
    expect(() => ouvrirCycle(structuredClone(w.e), w.tina, w.groupId, "Cycle 5", null))
      .toThrow("Tour terminé : tous les membres ont reçu leur part. Démarrez un nouveau tour.");
    expect(nouveauTour(w.e, w.tina, w.groupId)).toBe(2);
    expect(w.e.groupes[0]).toMatchObject({ current_round: 2, order_locked: false });
  });
  it("les tours sont réservés aux tontines", () => {
    const w = monde();
    w.e.groupes[0].type = "cotisation";
    expect(() => tirerAuSort(w.e, w.tina, w.groupId)).toThrow("Réservé aux tontines");
  });
});
```

- [ ] **Step 2: Écrire les tests qui échouent — `vues.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import { ouvrirCycle } from "./cycles";
import { declarerPaiement, saisirEspeces } from "./paiements";
import { lireJournal, mesGroupes, vueGroupe, vueMembre } from "./vues";

function avecPaiements() {
  const w = monde();
  const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", "2026-09-30");
  saisirEspeces(w.e, w.tina, "e-bob", w.m.bob, c, 5000);
  declarerPaiement(w.e, w.alice, { id: "p-alice", groupId: w.groupId, cycleId: c, montant: 5000, moyen: "mtn_momo", reference: "MP1", date: "2026-09-02", detteId: null });
  return { ...w, c };
}

describe("moteur démo : lectures", () => {
  it("le trésorier voit tout le groupe", () => {
    const w = avecPaiements();
    const v = vueGroupe(w.e, "u-tina", w.groupId);
    expect(v.role).toBe("tresorier");
    expect(v.membres.map((m) => m.display_name)).toEqual(["Tina", "Alice", "Bob", "Ines"]);
    expect(v.paiements).toHaveLength(2);
    expect(v.remises).toHaveLength(1);
  });
  it("un membre ne voit que sa fiche, ses paiements et ses dettes, mais tout l'ordre des tours", () => {
    const w = avecPaiements();
    const v = vueMembre(w.e, "u-alice", w.groupId);
    expect(v.moi.display_name).toBe("Alice");
    expect(v.paiements.map((p) => p.id)).toEqual(["p-alice"]);
    expect(v.ordre.map((o) => [o.display_name, o.is_me, o.prevu])).toEqual([
      ["Tina", false, true], ["Alice", true, false], ["Bob", false, false], ["Ines", false, false]]);
    expect(v.recouvrement).toEqual([{ cycle_id: w.c, membres: 4, attendu: 20000, payes: 1, collecte: 5000 }]);
    expect(vueGroupe(w.e, "u-alice", w.groupId).membres.map((m) => m.display_name)).toEqual(["Alice"]);
    expect(() => vueMembre(w.e, "u-inconnu", w.groupId)).toThrow("Groupe introuvable");
  });
  it("Mes groupes résume le cycle ouvert pour chacun", () => {
    const w = avecPaiements();
    expect(mesGroupes(w.e, "u-alice")[0].resume).toMatchObject({ cycle: "Septembre", monEtat: "en_attente" });
    expect(mesGroupes(w.e, "u-bob")[0].resume).toMatchObject({ monEtat: "paye", montant: 0 });
    expect(mesGroupes(w.e, "u-tina")[0].resume).toMatchObject({ monEtat: "a_payer", aValider: 1 });
    expect(mesGroupes(w.e, "u-inconnu")).toEqual([]);
  });
  it("le journal : le membre ne lit que les entrées visibles, avec le nom de l'auteur, de la plus récente à la plus ancienne", () => {
    const w = avecPaiements();
    const pourTina = lireJournal(w.e, "u-tina", w.groupId);
    const pourAlice = lireJournal(w.e, "u-alice", w.groupId);
    expect(pourTina.some((j) => j.action === "membre_ajoute")).toBe(true);
    expect(pourAlice.some((j) => j.action === "membre_ajoute")).toBe(false);
    expect(pourAlice[0]).toMatchObject({ action: "cycle_ouvert", auteur: "Tina", visible: true });
    expect(pourTina.map((j) => j.id)).toEqual([...pourTina.map((j) => j.id)].sort((a, b) => b - a));
    expect(lireJournal(w.e, "u-tina", w.groupId, pourTina[1].id).map((j) => j.id)).toEqual(pourTina.slice(2).map((j) => j.id));
    expect(() => lireJournal(w.e, "u-inconnu", w.groupId)).toThrow("Réservé aux membres du groupe");
  });
});
```

- [ ] **Step 3: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo/tours.test.ts src/lib/demo/vues.test.ts`
Expected: FAIL (`Failed to resolve import "./tours"` / `"./vues"`).

- [ ] **Step 4: Écrire `tours.ts`**

```ts
import type { MoyenPaiement } from "../types";
import {
  aujourdhui, comptes, exigerTontine, exigerTresorier, groupeDe, journaliser, membreDe, parRang, refus, type Ctx, type EtatDemo,
} from "./etat";

const VERROU = "L'ordre est verrouillé : utilisez l'échange de tours";
const nomsDansLOrdre = (e: EtatDemo, groupId: string) => comptes(e, groupId).sort(parRang).map((m) => m.display_name);

function avantVerrou(e: EtatDemo, c: Ctx, groupId: string) {
  exigerTresorier(e, groupId, c);
  exigerTontine(e, groupId);
  if (groupeDe(e, groupId).order_locked) refus(VERROU);
}

export function ordonnerTours(e: EtatDemo, c: Ctx, groupId: string, ordre: string[]) {
  avantVerrou(e, c, groupId);
  const attendus = comptes(e, groupId).map((m) => m.id).sort();
  const recus = [...ordre].sort();
  if (attendus.length !== recus.length || attendus.some((id, i) => id !== recus[i]))
    refus("La liste doit contenir chaque membre une seule fois");
  ordre.forEach((id, i) => { membreDe(e, id).position = i + 1; });
  journaliser(e, c, groupId, "ordre_modifie", { ordre: nomsDansLOrdre(e, groupId) }, true);
}

export function tirerAuSort(e: EtatDemo, c: Ctx, groupId: string): string[] {
  avantVerrou(e, c, groupId);
  const membres = comptes(e, groupId);
  for (let i = membres.length - 1; i > 0; i--) {   // Fisher-Yates
    const j = Math.floor(c.hasard() * (i + 1));
    [membres[i], membres[j]] = [membres[j], membres[i]];
  }
  membres.forEach((m, i) => { m.position = i + 1; });
  const ordre = nomsDansLOrdre(e, groupId);
  journaliser(e, c, groupId, "tirage_au_sort", { ordre }, true);
  return ordre;
}

export function echangerTours(e: EtatDemo, c: Ctx, a: string, b: string) {
  const ma = e.membres.find((m) => m.id === a), mb = e.membres.find((m) => m.id === b);
  if (!ma || !mb) return refus("Membre introuvable");
  if (ma.group_id !== mb.group_id || ma.id === mb.id) refus("Échange impossible entre ces membres");
  exigerTresorier(e, ma.group_id, c);
  exigerTontine(e, ma.group_id);
  if (ma.status === "retire" || mb.status === "retire") refus("Ce membre est retiré");
  const tour = groupeDe(e, ma.group_id).current_round;
  if (e.remises.some((r) => (r.membership_id === a || r.membership_id === b) && r.round === tour && r.status === "remis"))
    refus("Un de ces membres a déjà reçu sa part dans ce tour");
  [ma.position, mb.position] = [mb.position, ma.position];
  for (const r of e.remises) {
    if (r.round !== tour || r.status !== "prevu") continue;
    if (r.membership_id === a) r.membership_id = b; else if (r.membership_id === b) r.membership_id = a;
  }
  journaliser(e, c, ma.group_id, "tours_echanges", { a: ma.display_name, b: mb.display_name }, true);
}

export function remplacerBeneficiaire(e: EtatDemo, c: Ctx, remiseId: string, membershipId: string) {
  const r = e.remises.find((x) => x.id === remiseId) ?? refus("Bénéficiaire introuvable");
  exigerTresorier(e, r.group_id, c);
  if (r.status !== "prevu") refus("Cette cagnotte est déjà remise");
  echangerTours(e, c, r.membership_id, membershipId);
}

export function enregistrerRemise(e: EtatDemo, c: Ctx, remiseId: string, montant: number, moyen: MoyenPaiement,
  reference: string | null): { ecart: number } {
  const r = e.remises.find((x) => x.id === remiseId) ?? refus("Bénéficiaire introuvable");
  exigerTresorier(e, r.group_id, c);
  if (r.status !== "prevu") refus("Cette cagnotte est déjà remise");
  if (!(montant > 0)) refus("Montant invalide");
  if ((moyen === "mtn_momo" || moyen === "orange_money") && !(reference ?? "").trim())
    refus("Référence de transaction obligatoire pour MoMo et Orange Money");
  Object.assign(r, { amount: montant, method: moyen, reference: reference?.trim() || null, paid_on: aujourdhui(c), status: "remis" });
  journaliser(e, c, r.group_id, "cagnotte_remise", { nom: membreDe(e, r.membership_id).display_name, montant }, true);
  return { ecart: montant - r.amount_expected };
}

export function nouveauTour(e: EtatDemo, c: Ctx, groupId: string): number {
  exigerTresorier(e, groupId, c);
  exigerTontine(e, groupId);
  const g = groupeDe(e, groupId);
  if (e.cycles.some((x) => x.group_id === groupId && x.status === "ouvert")) refus("Clôturez d'abord le cycle en cours");
  if (comptes(e, groupId).some((m) => !e.remises.some((r) => r.membership_id === m.id && r.round === g.current_round && r.status === "remis")))
    refus("Le tour n'est pas terminé : tous les membres n'ont pas reçu leur part");
  g.current_round += 1; g.order_locked = false;
  journaliser(e, c, groupId, "nouveau_tour", { tour: g.current_round }, true);
  return g.current_round;
}
```

- [ ] **Step 5: Écrire `vues.ts`**

```ts
import { resumerGroupe } from "../resume";
import type { EntreeJournal, MonGroupe, OrdreTour, Recouvrement, VueGroupe, VueMembre } from "../types";
import { comptes, estMembre, estTresorier, groupeDe, refus, type EtatDemo, type MembreDemo } from "./etat";

/** Comme `order by position nulls last, display_name`. */
const parPositionPuisNom = (a: MembreDemo, b: MembreDemo) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.display_name.localeCompare(b.display_name, "fr");
const cyclesDu = (e: EtatDemo, groupId: string) =>
  e.cycles.filter((x) => x.group_id === groupId).sort((a, b) => a.round - b.round || a.number - b.number);
const parDate = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at);

/** RLS : trésorier, tout le groupe ; membre, sa fiche, ses paiements et ses dettes. */
export function vueGroupe(e: EtatDemo, acteur: string, groupId: string): VueGroupe {
  if (!estMembre(e, groupId, acteur)) refus("Groupe introuvable");
  const tresorier = estTresorier(e, groupId, acteur);
  const miens = new Set(e.membres.filter((m) => m.group_id === groupId && m.person_id === acteur).map((m) => m.id));
  const visible = (membershipId: string) => tresorier || miens.has(membershipId);
  return {
    role: tresorier ? "tresorier" : "membre",
    groupe: groupeDe(e, groupId),
    membres: e.membres.filter((m) => m.group_id === groupId && visible(m.id)).sort(parPositionPuisNom),
    cycles: cyclesDu(e, groupId),
    paiements: e.paiements.filter((p) => p.group_id === groupId && visible(p.membership_id)).sort(parDate),
    dettes: e.dettes.filter((d) => d.group_id === groupId && visible(d.membership_id)),
    remises: e.remises.filter((r) => r.group_id === groupId),
  };
}

function ordreTours(e: EtatDemo, acteur: string, groupId: string): OrdreTour[] {
  const tour = groupeDe(e, groupId).current_round;
  const remise = (id: string, statut: "prevu" | "remis") => e.remises.some((r) => r.membership_id === id && r.round === tour && r.status === statut);
  return comptes(e, groupId).sort(parPositionPuisNom).map((m) => ({
    membership_id: m.id, display_name: m.display_name, role: m.role, status: m.status, position: m.position,
    is_me: m.person_id === acteur, servi: remise(m.id, "remis"), prevu: remise(m.id, "prevu"),
  }));
}

function recouvrement(e: EtatDemo, groupId: string): Recouvrement[] {
  return cyclesDu(e, groupId).map((cy) => {
    const membres = comptes(e, groupId).filter((m) => m.created_at <= cy.opened_at).length;
    const valides = e.paiements.filter((p) => p.cycle_id === cy.id && p.debt_id === null && p.status === "valide");
    return { cycle_id: cy.id, membres, attendu: cy.amount_expected * membres,
      payes: new Set(valides.map((p) => p.membership_id)).size, collecte: valides.reduce((s, p) => s + p.amount, 0) };
  });
}

export function vueMembre(e: EtatDemo, acteur: string, groupId: string): VueMembre {
  if (!estMembre(e, groupId, acteur)) refus("Groupe introuvable");
  const moi = e.membres.find((m) => m.group_id === groupId && m.person_id === acteur)!;
  return {
    groupe: groupeDe(e, groupId), moi, cycles: cyclesDu(e, groupId),
    paiements: e.paiements.filter((p) => p.membership_id === moi.id).sort(parDate),
    dettes: e.dettes.filter((d) => d.membership_id === moi.id),
    remises: e.remises.filter((r) => r.group_id === groupId),
    ordre: ordreTours(e, acteur, groupId), recouvrement: recouvrement(e, groupId),
  };
}

export function mesGroupes(e: EtatDemo, acteur: string): MonGroupe[] {
  return e.membres.filter((m) => m.person_id === acteur && m.status === "actif")
    .map((m) => ({ m, g: groupeDe(e, m.group_id) }))
    .sort((a, b) => a.g.name.localeCompare(b.g.name, "fr"))
    .map(({ m, g }) => {
      const cy = e.cycles.find((x) => x.group_id === g.id && x.status === "ouvert") ?? null;
      const paiements = cy ? e.paiements.filter((p) => p.cycle_id === cy.id && p.debt_id === null
        && (m.role === "tresorier" || p.membership_id === m.id)) : [];
      return {
        membership_id: m.id, role: m.role,
        groupe: { id: g.id, name: g.name, type: g.type, amount: g.amount, frequency: g.frequency },
        resume: resumerGroupe(m.role, m.id, m.created_at, cy, paiements),
      };
    });
}

/** 50 entrées au plus, de la plus récente à la plus ancienne ; trésorier : tout, membre : entrées visibles. */
export function lireJournal(e: EtatDemo, acteur: string, groupId: string, avant?: number): EntreeJournal[] {
  if (!estMembre(e, groupId, acteur)) refus("Réservé aux membres du groupe");
  const tresorier = estTresorier(e, groupId, acteur);
  return e.journal
    .filter((j) => j.group_id === groupId && (tresorier || j.visible) && (avant === undefined || j.id < avant))
    .sort((a, b) => b.id - a.id).slice(0, 50)
    .map((j) => ({ id: j.id, action: j.action, details: j.details, created_at: j.created_at, visible: j.visible,
      auteur: e.personnes.find((p) => p.id === j.actor)?.full_name ?? null }));
}
```

- [ ] **Step 6: Lancer les tests**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo`
Expected: PASS (27 tests).

- [ ] **Step 7: Commit**

```bash
cd D:\njangi237 && git add app/src/lib/demo && git commit -m "Lot 6 : moteur de démo, tours, remises, lectures et journal (0006, 0008, RLS)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Données de démonstration

**Files:**
- Create: `app/src/lib/demo/donnees.ts`
- Test: `app/src/lib/demo/donnees.test.ts`

**Interfaces:**
- Consumes: moteur (Tasks 1 à 3).
- Produces: `TINA = "demo-tina"`, `ALICE = "demo-alice"`, `etatDemo(maintenant: Date) → EtatDemo`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, expect, it } from "vitest";
import { ALICE, etatDemo, TINA } from "./donnees";
import { mesGroupes } from "./vues";

const MAINTENANT = new Date("2026-10-17T10:00:00Z");

describe("données de démonstration", () => {
  const e = etatDemo(MAINTENANT);
  const tontine = e.groupes.find((g) => g.name === "Tontine des amis")!;
  const membres = e.membres.filter((m) => m.group_id === tontine.id);

  it("une tontine de 12 membres dont 2 invités, et une cotisation de 5", () => {
    expect(membres).toHaveLength(12);
    expect(membres.filter((m) => m.status === "invite")).toHaveLength(2);
    const cotisation = e.groupes.find((g) => g.name === "Cotisation du quartier")!;
    expect(cotisation.type).toBe("cotisation");
    expect(e.membres.filter((m) => m.group_id === cotisation.id)).toHaveLength(5);
  });
  it("un cycle clos avec une dette et une cagnotte remise, un cycle ouvert avec des paiements à valider", () => {
    const cycles = e.cycles.filter((c) => c.group_id === tontine.id);
    expect(cycles.map((c) => c.status)).toEqual(["clos", "ouvert"]);
    expect(e.dettes.filter((d) => d.group_id === tontine.id && !d.settled_at)).toEqual([expect.objectContaining({ amount: 5000 })]);
    expect(e.remises.filter((r) => r.group_id === tontine.id).map((r) => [r.status, r.amount])).toEqual([["remis", 120000], ["prevu", null]]);
    const ouvert = cycles[1];
    expect(e.paiements.filter((p) => p.cycle_id === ouvert.id && p.status === "declare")).toHaveLength(2);
    expect(e.paiements.filter((p) => p.cycle_id === ouvert.id && p.status === "conteste")).toHaveLength(1);
  });
  it("Alice a encore à payer ; Tina a deux paiements à valider", () => {
    const pourAlice = mesGroupes(e, ALICE);
    expect(pourAlice.map((g) => g.groupe.name)).toEqual(["Cotisation du quartier", "Tontine des amis"]);
    expect(pourAlice[1].resume).toMatchObject({ monEtat: "a_payer", montant: 10000 });
    expect(mesGroupes(e, TINA).find((g) => g.groupe.name === "Tontine des amis")?.resume?.aValider).toBe(2);
  });
  it("rien n'est daté après aujourd'hui", () => {
    const dates = [...e.journal.map((j) => j.created_at), ...e.paiements.map((p) => p.created_at), ...e.cycles.map((c) => c.opened_at)];
    expect(dates.every((d) => d <= MAINTENANT.toISOString())).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo/donnees.test.ts`
Expected: FAIL (`Failed to resolve import "./donnees"`).

- [ ] **Step 3: Écrire `donnees.ts`**

```ts
import type { MoyenPaiement } from "../types";
import { cloreCycle, ouvrirCycle } from "./cycles";
import { ajouterPersonne, comptes, etatVide, type Ctx, type EtatDemo } from "./etat";
import { ajouterMembre, creerGroupe, rejoindre } from "./membres";
import { contesterPaiement, declarerPaiement, saisirEspeces, validerPaiement } from "./paiements";
import { enregistrerRemise, ordonnerTours } from "./tours";

export const TINA = "demo-tina";
export const ALICE = "demo-alice";
const JOUR = 86_400_000;
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const libelleMois = (t: number) => { const d = new Date(t); return `${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const jour = (t: number) => new Date(t).toISOString().slice(0, 10);

/** [nom, téléphone (9 chiffres), identifiant de personne ou null pour un invité] ; Tina est ajoutée à la création. */
const AMIS: [string, string, string | null][] = [
  ["Brice Fotso", "690000003", "demo-brice"], ["Clarisse Ndjock", "690000004", "demo-clarisse"], ["Alice Ekane", "690000002", ALICE],
  ["Didier Kamga", "690000005", "demo-didier"], ["Estelle Tchoupo", "690000006", "demo-estelle"], ["Fabrice Essomba", "690000007", "demo-fabrice"],
  ["Grâce Atangana", "690000008", "demo-grace"], ["Hervé Nana", "690000009", "demo-herve"], ["Joël Owona", "690000010", "demo-joel"],
  ["Inès Moukouri", "690000011", null], ["Kevin Priso", "690000012", null],
];

/**
 * Données fictives rejouées avec les règles du moteur (donc toujours cohérentes), datées par rapport à `maintenant` :
 * la tontine a un cycle clos (une dette, cagnotte remise à Brice) et un cycle ouvert (Clarisse bénéficiaire, deux paiements
 * à valider, un contesté, Alice n'a rien payé) ; la cotisation a un cycle ouvert.
 */
export function etatDemo(maintenant: Date): EtatDemo {
  const e = etatVide();
  let t = maintenant.getTime() - 75 * JOUR;
  let n = 0;
  const ctx = (acteur: string): Ctx => ({ acteur, maintenant: () => new Date(t), id: () => `demo-${++n}`, hasard: () => 0.5 });
  const avancer = (jours: number) => { t += jours * JOUR; };
  const tina = ctx(TINA);
  const membre: Record<string, string> = {};   // identifiant de personne (ou nom pour un invité) → adhésion dans la tontine

  ajouterPersonne(e, { id: TINA, full_name: "Tina Mbarga", phone: "237690000001" });
  const t1 = creerGroupe(e, ctx("plateforme"), { nom: "Tontine des amis", type: "tontine", montant: 10000, frequence: "mensuelle",
    beneficiaires: 1, tresorier_nom: "Tina Mbarga", tresorier_telephone: "690000001" });
  rejoindre(e, tina, t1.membershipId);
  membre[TINA] = t1.membershipId;
  const c1g = creerGroupe(e, ctx("plateforme"), { nom: "Cotisation du quartier", type: "cotisation", montant: 5000, frequence: "ponctuelle",
    beneficiaires: 1, tresorier_nom: "Tina Mbarga", tresorier_telephone: "690000001" });
  rejoindre(e, tina, c1g.membershipId);
  avancer(1);
  for (const [nom, tel, personne] of AMIS) {
    const id = ajouterMembre(e, tina, t1.groupId, nom, tel);
    membre[personne ?? nom] = id;
    if (personne) { ajouterPersonne(e, { id: personne, full_name: nom, phone: `237${tel}` }); rejoindre(e, ctx(personne), id); }
  }
  const voisins: Record<string, string> = {};
  for (const [nom, tel, personne] of AMIS.filter(([, , p]) => p === ALICE || p === "demo-herve" || p === "demo-joel" || p === "demo-grace")) {
    const id = ajouterMembre(e, tina, c1g.groupId, nom, tel);
    voisins[personne!] = id;
    rejoindre(e, ctx(personne!), id);
  }
  avancer(1);
  ordonnerTours(e, tina, t1.groupId, ["demo-brice", "demo-clarisse", TINA, ALICE, "demo-didier", "demo-estelle", "demo-fabrice",
    "demo-grace", "demo-herve", "demo-joel", "Inès Moukouri", "Kevin Priso"].map((k) => membre[k]));

  // Cycle 1, clos : tout le monde paie sauf Didier (moitié) ; cagnotte remise à Brice
  avancer(5);
  const c1 = ouvrirCycle(e, tina, t1.groupId, libelleMois(t), jour(t + 25 * JOUR));
  avancer(3);
  const moyens: MoyenPaiement[] = ["mtn_momo", "orange_money", "especes"];
  let k = 0;
  const declarerEtValider = (personne: string, cycleId: string, moyen: MoyenPaiement, montant: number, groupId = t1.groupId) => {
    const c = ctx(personne); const id = c.id();
    declarerPaiement(e, c, { id, groupId, cycleId, montant, moyen, date: jour(t),
      reference: moyen === "especes" ? null : `${moyen === "mtn_momo" ? "MP" : "OM"}${jour(t).replace(/-/g, "")}.${1000 + ++k}`, detteId: null });
    return id;
  };
  saisirEspeces(e, tina, tina.id(), membre[TINA], c1, 10000);
  AMIS.filter(([, , p]) => p && p !== "demo-didier")
    .forEach(([, , personne], i) => validerPaiement(e, tina, declarerEtValider(personne!, c1, moyens[i % 3], 10000)));
  saisirEspeces(e, tina, tina.id(), membre["Inès Moukouri"], c1, 10000);
  saisirEspeces(e, tina, tina.id(), membre["Kevin Priso"], c1, 10000);
  saisirEspeces(e, tina, tina.id(), membre["demo-didier"], c1, 5000);
  avancer(20);
  cloreCycle(e, tina, c1);
  avancer(1);
  const remise1 = e.remises.find((r) => r.cycle_id === c1)!;
  enregistrerRemise(e, tina, remise1.id, remise1.amount_expected, "mtn_momo", `MP${jour(t).replace(/-/g, "")}.0042`);

  // Cycle 2, ouvert depuis 8 jours : Clarisse bénéficiaire
  avancer(36);
  const c2 = ouvrirCycle(e, tina, t1.groupId, libelleMois(t), jour(t + 28 * JOUR));
  avancer(1);
  saisirEspeces(e, tina, tina.id(), membre[TINA], c2, 10000);
  for (const [personne, moyen] of [["demo-brice", "mtn_momo"], ["demo-clarisse", "orange_money"], ["demo-grace", "especes"], ["demo-herve", "mtn_momo"]] as const)
    validerPaiement(e, tina, declarerEtValider(personne, c2, moyen, 10000));
  avancer(2);
  declarerEtValider("demo-estelle", c2, "mtn_momo", 10000);
  declarerEtValider("demo-joel", c2, "especes", 10000);
  contesterPaiement(e, tina, declarerEtValider("demo-fabrice", c2, "orange_money", 10000), "Référence introuvable chez Orange Money");

  // Cotisation : réparation du forage, ouverte depuis 4 jours
  avancer(1);
  const c3 = ouvrirCycle(e, tina, c1g.groupId, "Réparation du forage", jour(t + 10 * JOUR));
  avancer(1);
  saisirEspeces(e, tina, tina.id(), voisins["demo-herve"], c3, 5000);
  validerPaiement(e, tina, declarerEtValider("demo-grace", c3, "mtn_momo", 5000, c1g.groupId));
  declarerEtValider("demo-joel", c3, "orange_money", 5000, c1g.groupId);
  if (comptes(e, t1.groupId).length !== 12 || t > maintenant.getTime()) throw new Error("Données de démonstration incohérentes");
  return e;
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo`
Expected: PASS (31 tests). Si « rien n'est daté après aujourd'hui » échoue, réduire les `avancer` du cycle 2 (la somme des jours doit rester sous 75).

- [ ] **Step 5: Commit**

```bash
cd D:\njangi237 && git add app/src/lib/demo && git commit -m "Lot 6 : données de démonstration rejouées avec les règles du moteur

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `demoApi`, mode démo et stockage séparé

**Files:**
- Create: `app/src/lib/demo/demoApi.ts`, `app/src/lib/demo/modeDemo.ts`
- Modify: `app/src/lib/types.ts` (`LienEnvoye`), `app/src/lib/horsLigne.ts` (`stockageNavigateur`), `app/src/lib/api.ts`
- Test: `app/src/lib/demo/demoApi.test.ts`, `app/src/lib/demo/modeDemo.test.ts`, `app/src/lib/horsLigne.test.ts` (ajout)

**Interfaces:**
- Consumes: moteur et `etatDemo` (Tasks 1 à 4) ; `Stockage` (`horsLigne.ts`) ; `lienApp` (`liens.ts`).
- Produces (`modeDemo.ts`): `type ProfilDemo = "tina" | "alice"`, `estModeDemo()`, `profilDemo()`, `entrerDemo(recharger?)`, `changerProfil(recharger?)`, `quitterDemo(recharger?)`, `rechargerPage()`.
- Produces (`demoApi.ts`): `CLE_ETAT = "njangi.demo.etat"`, `INDISPONIBLE = "Indisponible en mode démo"`, `interface CanalDemo { postMessage(m: unknown): void; addEventListener(type: "message", f: () => void): void }`, `interface OptionsDemo`, `interface DemoApi extends Api { reinitialiser(): void }`, `createDemoApi(o) → DemoApi`.
- Produces (`api.ts`): `configuree: boolean`, `modeDemo: boolean`, `stockage: Stockage`, `demo: DemoApi | null`, `api: Api`.
- Produces (`horsLigne.ts`): `stockageNavigateur(prefixe = "")`.

- [ ] **Step 1: Écrire les tests qui échouent — `demoApi.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { stockageMemoire, type Stockage } from "../horsLigne";
import { CLE_ETAT, createDemoApi, INDISPONIBLE, type CanalDemo } from "./demoApi";
import type { ProfilDemo } from "./modeDemo";

const options = (stockage: Stockage = stockageMemoire(), profil: ProfilDemo = "tina", canal: CanalDemo | null = null) => ({
  stockage, profil: () => profil, quitter: vi.fn(), base: () => "https://njangi237.pages.dev/", canal,
  maintenant: () => new Date("2026-10-17T10:00:00Z"), hasard: () => 0.3,
});
/** Deux onglets : ce que l'un publie, l'autre le reçoit. */
function deuxOnglets(): [CanalDemo, CanalDemo] {
  const ecoutes: (() => void)[][] = [[], []];
  const canal = (i: 0 | 1): CanalDemo => ({ postMessage: () => ecoutes[1 - i].forEach((f) => f()), addEventListener: (_t, f) => { ecoutes[i].push(f); } });
  return [canal(0), canal(1)];
}
const tontine = async (api: ReturnType<typeof createDemoApi>) => (await api.mesGroupes()).find((g) => g.groupe.name === "Tontine des amis")!.groupe.id;

describe("demoApi", () => {
  it("connecte Tina ou Alice selon le profil, sans administration", async () => {
    expect(await createDemoApi(options()).session()).toMatchObject({ full_name: "Tina Mbarga", admin: false });
    expect(await createDemoApi(options(stockageMemoire(), "alice")).session()).toMatchObject({ full_name: "Alice Ekane" });
  });
  it("garde l'état : une action d'Alice se voit chez Tina sur le même téléphone", async () => {
    const s = stockageMemoire();
    const alice = createDemoApi(options(s, "alice"));
    const g = await tontine(alice);
    const vue = await alice.chargerVueMembre(g);
    const cycle = vue.cycles.find((c) => c.status === "ouvert")!;
    await alice.declarerPaiement({ id: "p-demo", groupId: g, cycleId: cycle.id, montant: 10000, moyen: "mtn_momo", reference: "MP1", date: "2026-10-17", detteId: null });
    const tina = createDemoApi(options(s, "tina"));
    expect((await tina.chargerGroupe(g)).paiements.find((p) => p.id === "p-demo")?.status).toBe("declare");
    expect((await alice.chargerVueMembre(g)).paiements.every((p) => p.membership_id === vue.moi.id)).toBe(true);
  });
  it("une action refusée n'enregistre rien et garde le message de la base", async () => {
    const s = stockageMemoire();
    const api = createDemoApi(options(s));
    const g = await tontine(api);
    const avant = s.lire(CLE_ETAT);
    await expect(api.ouvrirCycle(g, "Encore un", null)).rejects.toThrow("Un cycle est déjà ouvert : clôturez-le d'abord");
    const ouvert = (await api.chargerGroupe(g)).cycles.find((c) => c.status === "ouvert")!;
    await expect(api.cloreCycle(ouvert.id)).rejects.toThrow("2 paiement(s) à valider ou contester avant de clore");
    expect(s.lire(CLE_ETAT)).toBe(avant);
  });
  it("repart des données de démonstration si l'état gardé est abîmé ou d'une autre version", async () => {
    for (const brut of ["{pas du json", JSON.stringify({ version: 0 })]) {
      const s = stockageMemoire(); s.ecrire(CLE_ETAT, brut);
      expect(await createDemoApi(options(s)).mesGroupes()).toHaveLength(2);
    }
  });
  it("prévient les écrans abonnés, dans cet onglet et dans un autre", async () => {
    const s = stockageMemoire();
    const [a, b] = deuxOnglets();
    const tina = createDemoApi(options(s, "tina", a));
    const alice = createDemoApi(options(s, "alice", b));
    const ici = vi.fn(), labas = vi.fn();
    const arreter = tina.abonner(["x"], ici);
    alice.abonner(["x"], labas);
    const g = await tontine(tina);
    const attente = (await tina.chargerGroupe(g)).paiements.find((p) => p.status === "declare")!;
    await tina.validerPaiement(attente.id);
    expect(ici).toHaveBeenCalledTimes(1);
    expect(labas).toHaveBeenCalledTimes(1);
    arreter();
    await tina.contesterPaiement(attente.id, "Erreur");
    expect(ici).toHaveBeenCalledTimes(1);
  });
  it("rend un lien d'invitation fictif, sans WhatsApp", async () => {
    const api = createDemoApi(options());
    const g = await tontine(api);
    const ines = (await api.chargerGroupe(g)).membres.find((m) => m.display_name === "Inès Moukouri")!;
    expect(await api.inviter(ines.id, "invitation")).toEqual({ lien: "https://njangi237.pages.dev/#/invitation/demo", whatsapp: "",
      expire: "2026-10-24T10:00:00.000Z", nom: "Inès Moukouri", demo: true });
  });
  it("refuse ce qui demande un vrai compte", async () => {
    const api = createDemoApi(options());
    // Appels lancés un par un : une promesse rejetée et pas encore attendue ferait échouer Vitest
    for (const appel of [() => api.connexion("690000001", "123456"), () => api.changerPin("123456", "654321"), () => api.apercu("j"),
      () => api.creerGroupe({ nom: "x", type: "tontine", montant: 1, frequence: "mensuelle", beneficiaires: 1, tresorier_nom: "x", tresorier_telephone: "690000001" })])
      await expect(appel()).rejects.toThrow(INDISPONIBLE);
  });
  it("réinitialise la démo et quitte par la fonction fournie", async () => {
    const o = options();
    const api = createDemoApi(o);
    const g = await tontine(api);
    await api.ajouterMembre(g, "Zoé", "690000099");
    api.reinitialiser();
    expect((await api.chargerGroupe(g)).membres).toHaveLength(12);
    await api.quitter();
    expect(o.quitter).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Écrire les tests qui échouent — `modeDemo.test.ts` et ajout à `horsLigne.test.ts`**

`app/src/lib/demo/modeDemo.test.ts` :

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changerProfil, entrerDemo, estModeDemo, profilDemo, quitterDemo } from "./modeDemo";

describe("mode démo", () => {
  beforeEach(() => sessionStorage.clear());
  it("entre en démo avec Tina, passe en Alice, puis quitte", () => {
    const recharger = vi.fn();
    expect(estModeDemo()).toBe(false);
    entrerDemo(recharger);
    expect([estModeDemo(), profilDemo()]).toEqual([true, "tina"]);
    changerProfil(recharger);
    expect(profilDemo()).toBe("alice");
    quitterDemo(recharger);
    expect(estModeDemo()).toBe(false);
    expect(recharger).toHaveBeenCalledTimes(3);
  });
});
```

Ajouter à la fin de `app/src/lib/horsLigne.test.ts` (créer le bloc ; garder les imports existants et ajouter `stockageNavigateur` à l'import de `./horsLigne`) :

```ts
describe("stockageNavigateur", () => {
  it("range les clés sous le préfixe donné : la démo ne touche pas aux données d'un vrai compte", () => {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } });
    const demo = stockageNavigateur("njangi.demo:");
    demo.ecrire("njangi.vue.moi", "demo");
    expect([...m.keys()]).toEqual(["njangi.demo:njangi.vue.moi"]);
    expect(stockageNavigateur().lire("njangi.vue.moi")).toBeNull();
    vi.unstubAllGlobals();
  });
});
```

(Ajouter `vi` à l'import de `vitest` en tête de `horsLigne.test.ts` s'il n'y est pas.)

- [ ] **Step 3: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/lib/demo src/lib/horsLigne.test.ts`
Expected: FAIL (`Failed to resolve import "./demoApi"`, `"./modeDemo"` ; le test du préfixe échoue : clé sans préfixe).

- [ ] **Step 4: `LienEnvoye.demo` et préfixe du stockage**

Dans `app/src/lib/types.ts`, remplacer la ligne de `LienEnvoye` :

```ts
/** `demo` : lien fictif du mode démo (rien n'est envoyé, pas de bouton WhatsApp). */
export interface LienEnvoye { lien: string; whatsapp: string; expire: string; nom: string; demo?: boolean }
```

Dans `app/src/lib/horsLigne.ts`, remplacer `stockageNavigateur` :

```ts
/** `prefixe` : espace séparé dans le localStorage (la démo y range ses vues et sa file, à part de celles d'un vrai compte). */
export function stockageNavigateur(prefixe = ""): Stockage {
  return {
    lire: (k) => { try { return localStorage.getItem(prefixe + k); } catch { return null; } },
    ecrire: (k, v) => { try { localStorage.setItem(prefixe + k, v); } catch { /* mémoire pleine ou désactivée : on continue sans */ } },
    supprimer: (k) => { try { localStorage.removeItem(prefixe + k); } catch { /* idem */ } },
  };
}
```

- [ ] **Step 5: Écrire `modeDemo.ts`**

```ts
/** Mode démo propre à l'onglet (sessionStorage) ; l'état fictif, lui, est partagé entre onglets (localStorage). */
export type ProfilDemo = "tina" | "alice";

const DRAPEAU = "njangi.demo";
const PROFIL = "njangi.demo.profil";
const session = (): Storage | null => { try { return sessionStorage; } catch { return null; } };

export const rechargerPage = () => { location.hash = "#/"; location.reload(); };
export const estModeDemo = () => session()?.getItem(DRAPEAU) === "1";
export const profilDemo = (): ProfilDemo => (session()?.getItem(PROFIL) === "alice" ? "alice" : "tina");

export function entrerDemo(recharger = rechargerPage) {
  session()?.setItem(DRAPEAU, "1"); session()?.setItem(PROFIL, "tina"); recharger();
}
export function changerProfil(recharger = rechargerPage) {
  session()?.setItem(PROFIL, profilDemo() === "tina" ? "alice" : "tina"); recharger();
}
export function quitterDemo(recharger = rechargerPage) {
  session()?.removeItem(DRAPEAU); session()?.removeItem(PROFIL); recharger();
}
```

- [ ] **Step 6: Écrire `demoApi.ts`**

```ts
import type { Stockage } from "../horsLigne";
import { lienApp, type TypeLien } from "../liens";
import type { Api, LienEnvoye } from "../types";
import * as cycles from "./cycles";
import { ALICE, etatDemo, TINA } from "./donnees";
import { estTresorier, refus, VERSION_DEMO, type Ctx, type EtatDemo } from "./etat";
import * as membres from "./membres";
import type { ProfilDemo } from "./modeDemo";
import * as paiements from "./paiements";
import * as tours from "./tours";
import * as vues from "./vues";

export const CLE_ETAT = "njangi.demo.etat";
export const INDISPONIBLE = "Indisponible en mode démo";
const PERSONNE: Record<ProfilDemo, string> = { tina: TINA, alice: ALICE };

/** Sous-ensemble de BroadcastChannel utilisé (remplaçable dans les tests). */
export interface CanalDemo { postMessage(m: unknown): void; addEventListener(type: "message", f: () => void): void }
export interface OptionsDemo {
  stockage: Stockage; profil: () => ProfilDemo; quitter: () => void; base: () => string;
  canal?: CanalDemo | null; maintenant?: () => Date; id?: () => string; hasard?: () => number;
}
export interface DemoApi extends Api { reinitialiser(): void }

function inviterDemo(e: EtatDemo, acteur: string, membershipId: string, type: TypeLien, maintenant: Date, base: string): LienEnvoye {
  const m = e.membres.find((x) => x.id === membershipId) ?? refus("Membre introuvable");
  if (!estTresorier(e, m.group_id, acteur)) refus("Réservé aux trésoriers du groupe");
  if (type === "invitation" && m.status !== "invite") refus("Ce membre a déjà rejoint le groupe");
  if (type === "reinitialisation" && (m.status !== "actif" || !m.person_id)) refus("Ce membre n'a pas encore de compte");
  const duree = type === "invitation" ? 7 * 86_400_000 : 86_400_000;
  return { lien: lienApp(base, type, "demo"), whatsapp: "", expire: new Date(maintenant.getTime() + duree).toISOString(), nom: m.display_name, demo: true };
}

/** Contrat `Api` sur les données fictives : rien ne quitte le navigateur. */
export function createDemoApi(o: OptionsDemo): DemoApi {
  const maintenant = o.maintenant ?? (() => new Date());
  const id = o.id ?? (() => crypto.randomUUID());
  const hasard = o.hasard ?? Math.random;
  const abonnes = new Set<() => void>();
  const prevenirIci = () => abonnes.forEach((f) => f());
  o.canal?.addEventListener("message", prevenirIci);
  const prevenir = () => { prevenirIci(); o.canal?.postMessage("change"); };

  const lire = (): EtatDemo => {
    const brut = o.stockage.lire(CLE_ETAT);
    if (brut) {
      try { const e = JSON.parse(brut) as EtatDemo; if (e.version === VERSION_DEMO) return e; }
      catch { /* état abîmé : on repart des données de démonstration */ }
    }
    const e = etatDemo(maintenant());
    o.stockage.ecrire(CLE_ETAT, JSON.stringify(e));
    return e;
  };
  const acteur = () => PERSONNE[o.profil()];
  const ctx = (): Ctx => ({ acteur: acteur(), maintenant, id, hasard });
  const voir = async <T>(f: (e: EtatDemo, acteur: string) => T): Promise<T> => f(lire(), acteur());
  /** L'état relu est modifié puis enregistré seulement si l'action réussit (comme une transaction). */
  const agir = async <T>(f: (e: EtatDemo, c: Ctx) => T): Promise<T> => {
    const e = lire();
    const r = f(e, ctx());
    o.stockage.ecrire(CLE_ETAT, JSON.stringify(e));
    prevenir();
    return r;
  };
  const indisponible = async (): Promise<never> => refus(INDISPONIBLE);

  return {
    session: () => voir((e, a) => { const p = e.personnes.find((x) => x.id === a)!; return { ...p, admin: false }; }),
    connexion: indisponible, apercu: indisponible, accepter: indisponible, nouveauPin: indisponible, changerPin: indisponible,
    amorcer: indisponible, creerGroupe: indisponible,
    async quitter() { o.quitter(); },
    mesGroupes: () => voir(vues.mesGroupes),
    inviter: (membershipId, type) => voir((e, a) => inviterDemo(e, a, membershipId, type, maintenant(), o.base())),
    chargerGroupe: (groupId) => voir((e, a) => vues.vueGroupe(e, a, groupId)),
    ouvrirCycle: (groupId, libelle, echeance) => agir((e, c) => { cycles.ouvrirCycle(e, c, groupId, libelle, echeance); }),
    cloreCycle: (cycleId) => agir((e, c) => cycles.cloreCycle(e, c, cycleId)),
    rouvrirCycle: (cycleId) => agir((e, c) => cycles.rouvrirCycle(e, c, cycleId)),
    validerPaiement: (pid) => agir((e, c) => paiements.validerPaiement(e, c, pid)),
    contesterPaiement: (pid, motif) => agir((e, c) => paiements.contesterPaiement(e, c, pid, motif)),
    saisirEspeces: (pid, membershipId, cycleId, montant, detteId) =>
      agir((e, c) => paiements.saisirEspeces(e, c, pid, membershipId, cycleId, montant, detteId)),
    ajouterMembre: (groupId, nom, telephone) => agir((e, c) => membres.ajouterMembre(e, c, groupId, nom, telephone)),
    changerRole: (membershipId, role) => agir((e, c) => membres.changerRole(e, c, membershipId, role)),
    apercuRetrait: (membershipId) => voir((e) => membres.apercuRetrait(e, ctx(), membershipId)),
    retirerMembre: (membershipId) => agir((e, c) => { membres.retirerMembre(e, c, membershipId); }),
    chargerVueMembre: (groupId) => voir((e, a) => vues.vueMembre(e, a, groupId)),
    declarerPaiement: (d) => agir((e, c) => paiements.declarerPaiement(e, c, d)),
    abonner(_groupIds, surChangement) { abonnes.add(surChangement); return () => { abonnes.delete(surChangement); }; },
    ordonnerTours: (groupId, ordre) => agir((e, c) => tours.ordonnerTours(e, c, groupId, ordre)),
    tirerAuSort: (groupId) => agir((e, c) => tours.tirerAuSort(e, c, groupId)),
    echangerTours: (a, b) => agir((e, c) => tours.echangerTours(e, c, a, b)),
    remplacerBeneficiaire: (remiseId, membershipId) => agir((e, c) => tours.remplacerBeneficiaire(e, c, remiseId, membershipId)),
    enregistrerRemise: (remiseId, montant, moyen, reference) => agir((e, c) => tours.enregistrerRemise(e, c, remiseId, montant, moyen, reference)),
    nouveauTour: (groupId) => agir((e, c) => tours.nouveauTour(e, c, groupId)),
    lireJournal: (groupId, avant) => voir((e, a) => vues.lireJournal(e, a, groupId, avant)),
    reinitialiser() { o.stockage.supprimer(CLE_ETAT); prevenir(); },
  };
}
```

- [ ] **Step 7: Brancher `api.ts`**

Remplacer tout `app/src/lib/api.ts` :

```ts
import { createDemoApi, type DemoApi } from "./demo/demoApi";
import { estModeDemo, profilDemo, quitterDemo } from "./demo/modeDemo";
import { stockageNavigateur } from "./horsLigne";
import { createSupabaseApi } from "./supabaseApi";
import type { Api } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Application branchée sur Supabase ; sans configuration, seule la démo est possible. */
export const configuree = Boolean(url && key);
export const modeDemo = !configuree || estModeDemo();
/** Vues gardées et file hors ligne de la démo rangées à part : jamais mêlées à celles d'un vrai compte sur le même téléphone. */
export const stockage = stockageNavigateur(modeDemo ? "njangi.demo:" : "");
export const demo: DemoApi | null = modeDemo
  ? createDemoApi({
      stockage, profil: profilDemo, quitter: () => quitterDemo(), base: () => `${location.origin}${location.pathname}`,
      canal: typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("njangi-demo") : null,
    })
  : null;
export const api: Api = demo ?? createSupabaseApi(url!, key!);
```

- [ ] **Step 8: Lancer les tests et la compilation**

Run: `cd D:\njangi237\app && npx vitest run src/lib && npx tsc -b`
Expected: PASS (tous les tests de `src/lib`), `tsc` sans erreur. `App.tsx` peut encore signaler `api` jamais nul (`if (!api)`) : sans erreur de type, il est corrigé à la Task 6.

- [ ] **Step 9: Commit**

```bash
cd D:\njangi237 && git add app/src/lib && git commit -m "Lot 6 : demoApi (état local, profils Tina et Alice, synchronisation entre onglets) et stockage séparé pour la démo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Écrans — bandeau, connexion, liens fictifs

**Files:**
- Create: `app/src/ui/BandeauDemo.tsx`
- Modify: `app/src/ui/Connexion.tsx`, `app/src/ui/Lien.tsx`, `app/src/ui/Coque.tsx`, `app/src/App.tsx`, `app/src/styles.css`
- Test: `app/src/ui/BandeauDemo.test.tsx`, `app/src/ui/Connexion.test.tsx`, `app/src/ui/Lien.test.tsx`

**Interfaces:**
- Consumes: `api`, `demo`, `configuree`, `modeDemo`, `stockage` (`lib/api.ts`) ; `profilDemo`, `changerProfil`, `quitterDemo`, `entrerDemo`, `rechargerPage` (`modeDemo.ts`) ; `LienEnvoye.demo`.
- Produces: `BandeauDemo({ profil, onChanger, onReinitialiser, onQuitter? })` ; `Connexion({ api, onConnecte, onDemo? })` ; `Coque({ api, moi, route, onQuitter, stockage })`.

- [ ] **Step 1: Écrire les tests qui échouent**

`app/src/ui/BandeauDemo.test.tsx` :

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BandeauDemo } from "./BandeauDemo";

afterEach(cleanup);

describe("BandeauDemo", () => {
  it("dit qui l'on est et propose l'autre profil", async () => {
    const onChanger = vi.fn();
    render(<BandeauDemo profil="tina" onChanger={onChanger} onReinitialiser={vi.fn()} onQuitter={vi.fn()} />);
    expect(screen.getByText(/Tina \(trésorière\)/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Passer en Alice (membre)" }));
    expect(onChanger).toHaveBeenCalled();
  });
  it("demande une confirmation avant de tout remettre à zéro", async () => {
    const onReinitialiser = vi.fn();
    render(<BandeauDemo profil="alice" onChanger={vi.fn()} onReinitialiser={onReinitialiser} />);
    await userEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    expect(onReinitialiser).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer : tout remettre à zéro" }));
    expect(onReinitialiser).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Quitter la démo" })).toBeNull();
  });
});
```

`app/src/ui/Connexion.test.tsx` :

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fauxApi } from "../test/fauxApi";
import { Connexion } from "./Connexion";

afterEach(cleanup);

describe("Connexion", () => {
  it("propose la démo et le lien vers la v1", async () => {
    const onDemo = vi.fn();
    render(<Connexion api={fauxApi()} onConnecte={vi.fn()} onDemo={onDemo} />);
    await userEvent.click(screen.getByRole("button", { name: "Essayer la démo" }));
    expect(onDemo).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /ancienne version/ }).getAttribute("href")).toBe("v1/");
  });
});
```

`app/src/ui/Lien.test.tsx` :

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Lien } from "./Lien";

afterEach(cleanup);
const envoi = { lien: "https://x/#/invitation/demo", whatsapp: "", expire: "2026-10-24T10:00:00Z", nom: "Inès" };

describe("Lien", () => {
  it("en démo : pas de bouton WhatsApp, un avertissement", () => {
    render(<Lien envoi={{ ...envoi, demo: true }} titre="Invitation" />);
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    expect(screen.getByText(/lien fictif/)).toBeTruthy();
  });
  it("en vrai : le bouton WhatsApp", () => {
    render(<Lien envoi={{ ...envoi, whatsapp: "https://wa.me/237690000011?text=x" }} titre="Invitation" />);
    expect(screen.getByRole("link", { name: "Envoyer à Inès sur WhatsApp" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd D:\njangi237\app && npx vitest run src/ui/BandeauDemo.test.tsx src/ui/Connexion.test.tsx src/ui/Lien.test.tsx`
Expected: FAIL (`BandeauDemo` introuvable ; pas de bouton « Essayer la démo » ; texte « lien fictif » absent).

- [ ] **Step 3: Écrire `BandeauDemo.tsx`**

```tsx
import { useState } from "react";
import type { ProfilDemo } from "../lib/demo/modeDemo";

const NOM: Record<ProfilDemo, string> = { tina: "Tina (trésorière)", alice: "Alice (membre)" };

/** Rappel permanent du mode démo : profil courant, passage à l'autre profil, remise à zéro, sortie. */
export function BandeauDemo({ profil, onChanger, onReinitialiser, onQuitter }: {
  profil: ProfilDemo; onChanger: () => void; onReinitialiser: () => void; onQuitter?: () => void;
}) {
  const [confirmer, setConfirmer] = useState(false);
  const autre: ProfilDemo = profil === "tina" ? "alice" : "tina";
  return (
    <div className="bandeau-demo" role="region" aria-label="Mode démo">
      <p><b>Mode démo</b> · {NOM[profil]} · données fictives, rien n'est envoyé</p>
      <div className="actions-demo">
        <button className="btn petit" onClick={onChanger}>Passer en {NOM[autre]}</button>
        {confirmer
          ? <button className="btn petit" onClick={onReinitialiser}>Confirmer : tout remettre à zéro</button>
          : <button className="btn petit" onClick={() => setConfirmer(true)}>Réinitialiser la démo</button>}
        {onQuitter && <button className="btn petit" onClick={onQuitter}>Quitter la démo</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Modifier `Connexion.tsx`**

Remplacer la signature et la fin du composant :

```tsx
export function Connexion({ api, onConnecte, onDemo }: { api: Api; onConnecte: () => void; onDemo?: () => void }) {
```

et, après `<p className="note">PIN oublié ? Demandez un lien à votre trésorier.</p>` :

```tsx
      {onDemo && <button className="btn" type="button" onClick={onDemo}>Essayer la démo</button>}
      <p className="note"><a className="lien" href="v1/">Vous utilisiez l'ancienne version ? Vos données sont ici →</a></p>
```

- [ ] **Step 5: Modifier `Lien.tsx`**

Remplacer la ligne du bouton WhatsApp :

```tsx
      {envoi.demo
        ? <p className="note">Mode démo : lien fictif, rien n'est envoyé.</p>
        : <a className="btn principal" href={envoi.whatsapp} target="_blank" rel="noreferrer">Envoyer à {envoi.nom} sur WhatsApp</a>}
```

- [ ] **Step 6: `Coque.tsx` reçoit le stockage**

Remplacer l'import de `useMemo` et de `stockageNavigateur` et la signature :

```tsx
import type { Stockage } from "../lib/horsLigne";
import type { Route } from "../lib/routes";
import type { Api, Personne } from "../lib/types";
```

```tsx
export function Coque({ api, moi, route, onQuitter, stockage }: {
  api: Api; moi: Personne; route: Route; onQuitter: () => void; stockage: Stockage;
}) {
```

et supprimer la ligne `const stockage = useMemo(stockageNavigateur, []);`.

- [ ] **Step 7: Modifier `App.tsx`**

Remplacer tout le fichier :

```tsx
import { useCallback, useEffect, useState } from "react";
import { api, configuree, demo, stockage } from "./lib/api";
import { changerProfil, entrerDemo, profilDemo, quitterDemo, rechargerPage } from "./lib/demo/modeDemo";
import { demarrerEnvoi } from "./lib/envoi";
import { chargerMoi, oublierMoi } from "./lib/session";
import { lireRoute } from "./lib/routes";
import type { Personne } from "./lib/types";
import { BandeauDemo } from "./ui/BandeauDemo";
import { Connexion } from "./ui/Connexion";
import { Coque } from "./ui/Coque";
import { Amorcage } from "./ui/Amorcage";
import { Invitation } from "./ui/Invitation";

export default function App() {
  const [route, setRoute] = useState(() => lireRoute(location.hash));
  const [moi, setMoi] = useState<Personne | null | undefined>(undefined);

  useEffect(() => {
    const suivre = () => setRoute(lireRoute(location.hash));
    addEventListener("hashchange", suivre);
    return () => removeEventListener("hashchange", suivre);
  }, []);
  const rafraichir = useCallback(() => { chargerMoi(api, stockage).then(setMoi); }, []);
  useEffect(() => { rafraichir(); }, [rafraichir]);
  // Déclarations faites hors ligne : envoyées dès que la personne est connectée et à chaque retour du réseau
  const moiId = moi?.id;
  useEffect(() => (moiId ? demarrerEnvoi(api, stockage, moiId) : undefined), [moiId]);

  const bandeau = demo && <BandeauDemo profil={profilDemo()} onChanger={() => changerProfil()}
    onReinitialiser={() => { demo?.reinitialiser(); rechargerPage(); }} onQuitter={configuree ? () => quitterDemo() : undefined} />;
  let ecran;
  if (route.nom === "invitation" || route.nom === "nouveau-pin")
    ecran = <Invitation api={api} jeton={route.jeton} mode={route.nom} onFini={() => { location.hash = "#/"; rafraichir(); }} />;
  else if (route.nom === "amorcer" && !moi) ecran = <Amorcage api={api} onFini={() => { location.hash = "#/admin"; rafraichir(); }} />;
  else if (moi === undefined) ecran = <main className="ecran etroit"><p className="note">Chargement…</p></main>;
  else if (!moi) ecran = <Connexion api={api} onConnecte={rafraichir} onDemo={() => entrerDemo()} />;
  else ecran = <Coque api={api} moi={moi} route={route} stockage={stockage}
    onQuitter={async () => { await api.quitter(); oublierMoi(stockage); setMoi(null); location.hash = "#/"; }} />;
  return <>{bandeau}{ecran}</>;
}
```

- [ ] **Step 8: Styles du bandeau**

Ajouter à la fin de `app/src/styles.css` :

```css
/* Mode démo */
.bandeau-demo { background: var(--gold-soft); border-bottom: 2px solid var(--gold); padding: 10px 16px; display: grid; gap: 8px; }
.bandeau-demo p { margin: 0; color: var(--gold-dark); font-size: 14px; }
.actions-demo { display: flex; flex-wrap: wrap; gap: 8px; }
```

- [ ] **Step 9: Lancer toute la suite et la compilation**

Run: `cd D:\njangi237\app && npm test && npm run build`
Expected: PASS (133 tests existants + ceux du lot 6) ; build sans erreur.

- [ ] **Step 10: Essai rapide en local**

Run (une fois) : `cd D:\njangi237\app && npx vite preview --port 4173`, ouvrir `http://localhost:4173`, cliquer « Essayer la démo ».
Expected: bandeau « Mode démo · Tina (trésorière) », « Mes groupes » montre « Cotisation du quartier » et « Tontine des amis (2 paiements à valider) » ; « Passer en Alice » montre « À payer : 10 000 FCFA ». Arrêter l'aperçu ensuite.

- [ ] **Step 11: Commit**

```bash
cd D:\njangi237 && git add app/src && git commit -m "Lot 6 : bandeau du mode démo, bouton « Essayer la démo », lien vers la v1, invitations fictives sans WhatsApp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: La v1 sur `/v1/`

**Files:**
- Move: `index.html`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png` (racine) → `app/public/v1/`
- Modify: `app/public/v1/sw.js`, `app/vite.config.ts`, `app/package.json`, `README.md`
- Create: `app/scripts/verifier-dist.mjs`

**Interfaces:**
- Consumes: build de la Task 6.
- Produces: `dist/v1/` (v1 intacte, même origine), commande `npm run verifier`.

- [ ] **Step 1: Poser l'étiquette `v1` sur la dernière version où la v1 est à la racine**

```bash
cd D:\njangi237 && git tag -a v1 main -m "Njangi237 v1 (page unique, données dans le téléphone) avant la bascule vers la v2" && git tag -l v1
```

Expected: `v1`.

- [ ] **Step 2: Écrire le contrôle du `dist` (il échoue tant que la v1 n'est pas déplacée)**

`app/scripts/verifier-dist.mjs` :

```js
// Contrôle du dist avant publication : la v1 est servie sur /v1/ et la v2 ne la met pas en cache.
import { existsSync, readFileSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const lire = (p) => readFileSync(new URL(p, dist), "utf8");
const erreurs = [];
for (const f of ["index.html", "sw.js", "v1/index.html", "v1/sw.js", "v1/manifest.json", "v1/icon-192.png", "v1/icon-512.png"])
  if (!existsSync(new URL(f, dist))) erreurs.push(`manquant : ${f}`);
if (!erreurs.length) {
  const sw = lire("sw.js");
  if (/url:"v1\//.test(sw)) erreurs.push("le service worker de la v2 met des fichiers de la v1 en cache (globIgnores)");
  if (!sw.includes("\\/v1\\/")) erreurs.push("/v1/ n'est pas exclu du repli de navigation de la v2 (navigateFallbackDenylist)");
  if (!lire("v1/sw.js").includes('k.startsWith("njangi237-")')) erreurs.push("le service worker de la v1 peut effacer les caches de la v2");
  if (!lire("v1/index.html").includes('"applica_data_v1"')) erreurs.push("dist/v1/index.html n'est pas la page de la v1");
}
if (erreurs.length) { console.error(erreurs.join("\n")); process.exit(1); }
console.log("dist vérifié : v1 servie sur /v1/, hors du précache de la v2");
```

Dans `app/package.json`, ajouter le script `"verifier": "node scripts/verifier-dist.mjs"` après `"test"`.

Run: `cd D:\njangi237\app && npm run build && npm run verifier`
Expected: FAIL avec `manquant : v1/index.html` (et les autres fichiers de `v1/`).

- [ ] **Step 3: Déplacer la v1**

```bash
cd D:\njangi237 && mkdir -p app/public/v1 && git mv index.html sw.js manifest.json icon-192.png icon-512.png app/public/v1/
```

- [ ] **Step 4: Le service worker de la v1 ne touche qu'à ses propres caches**

Dans `app/public/v1/sw.js`, remplacer :

```js
const CACHE = "njangi237-v2";
```

par :

```js
// Servi sous /v1/ depuis la bascule : ne jamais effacer les caches de la v2 (même origine)
const CACHE = "njangi237-v1";
```

et remplacer :

```js
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
```

par :

```js
      Promise.all(keys.filter((k) => k.startsWith("njangi237-") && k !== CACHE).map((k) => caches.delete(k)))
```

- [ ] **Step 5: La v2 laisse `/v1/` à la v1**

Dans `app/vite.config.ts`, remplacer la ligne `workbox` :

```ts
      // La v1 (dans public/v1) a son propre service worker : ni précache, ni page de repli de la v2 pour /v1/
      workbox: { globPatterns: ["**/*.{js,css,html,png}"], globIgnores: ["v1/**"], navigateFallback: "index.html",
        navigateFallbackDenylist: [/\/v1\//] },
```

- [ ] **Step 6: Lancer le contrôle**

Run: `cd D:\njangi237\app && npm run build && npm run verifier && npm test`
Expected: `dist vérifié : v1 servie sur /v1/, hors du précache de la v2` ; tests PASS.

- [ ] **Step 7: README de la racine**

Remplacer tout `README.md` :

```markdown
# Njangi237 — tontines et cotisations

Application web (PWA) de suivi des tontines et cotisations : trésoriers et membres ont chacun leur compte, les paiements MoMo, Orange Money ou espèces sont déclarés par les membres et validés par le trésorier, les tours et la cagnotte sont suivis jusqu'au bout.

- **En ligne** : https://njangi237.pages.dev — bouton « Essayer la démo » pour la découvrir sans compte.
- **Code** : `app/` (React + TypeScript + Vite), base `supabase/migrations/`, fonction serveur `supabase/functions/comptes/`, tests de la base `db/`.
- **Conception** : `docs/superpowers/specs/2026-10-16-njangi237-v2-design.md` ; plans par lot dans `docs/superpowers/plans/`.

## Développer

```bash
cd app
npm install
npm run dev        # sans .env : mode démo uniquement
npm test
npm run build && npm run verifier
```

## Publier

```bash
cd app
npm run build && npm run verifier
npx wrangler pages deploy dist --project-name njangi237 --branch main --commit-dirty=true
```

## Ancienne version (v1)

La v1 (une page, données gardées dans le téléphone) reste sur https://njangi237.pages.dev/v1/ : ses utilisateurs y retrouvent leurs données. Source : `app/public/v1/` ; état d'origine : étiquette git `v1`.
```

- [ ] **Step 8: Commit**

```bash
cd D:\njangi237 && git add -A README.md app/public/v1 app/vite.config.ts app/package.json app/scripts && git commit -m "Lot 6 : la v1 passe sous /v1/ (même origine, données gardées), hors du précache de la v2 ; contrôle du dist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Essai en ligne, PR, puis bascule après feu vert

**Files:** aucun fichier de code (publication et vérification).

**Interfaces:**
- Consumes: branche `v2-lot6` complète (Tasks 1 à 7).

- [ ] **Step 1: Suite complète et dist**

Run: `cd D:\njangi237\app && npm test && npm run build && npm run verifier`
Expected: tous les tests PASS ; `dist vérifié`.

- [ ] **Step 2: Publier l'aperçu**

Run: `cd D:\njangi237\app && npx wrangler pages deploy dist --project-name njangi237 --branch v2 --commit-dirty=true`
Expected: déploiement réussi, alias `https://v2.njangi237.pages.dev`.

- [ ] **Step 3: Parcours de la démo dans Chrome** (lire les écrans avec `get_page_text` si les captures échouent)

Sur `https://v2.njangi237.pages.dev` :
1. L'écran de connexion montre « Essayer la démo » et « Vous utilisiez l'ancienne version ? ».
2. « Essayer la démo » : bandeau « Mode démo · Tina (trésorière) » ; « Tontine des amis » : 2 paiements à valider ; valider celui d'Estelle.
3. Onglet Tours : Clarisse bénéficiaire prévue ; Journal : « Cagnotte remise à Brice Fotso ».
4. « Passer en Alice (membre) » : « À payer : 10 000 FCFA » ; déclarer 10 000 par MTN MoMo avec la référence `MP-TEST-1`.
5. « Passer en Tina » : la déclaration d'Alice est à valider.
6. « Réinitialiser la démo » puis confirmer : retour aux données de départ.
7. `https://v2.njangi237.pages.dev/v1/` : page de la v1 (titre « Njangi237 — Recouvrement communautaire », groupes de la v1).

Expected: les sept points comme décrits. Corriger et republier en cas d'écart.

- [ ] **Step 4: Pousser la branche et l'étiquette, ouvrir la PR**

```bash
cd D:\njangi237 && git push -u origin v2-lot6 && git push origin v1
```

Puis ouvrir la PR `v2-lot6` → `main` avec la même méthode qu'aux lots précédents, titre « Lot 6 : mode démo, v1 sur /v1/ », description résumant les Tasks 1 à 7, terminée par `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 5: ARRÊT — demander le feu vert d'Olivier**

Présenter à Olivier : le lien de l'aperçu, ce qui change pour les utilisateurs de la v1 (leur adresse affiche maintenant la v2 ; leurs données sont sur `/v1/` ; une icône v1 installée sur l'écran d'accueil ouvre désormais la v2) et la façon de revenir en arrière. **Ne rien publier en production sans un « oui » explicite.**

- [ ] **Step 6: Après le feu vert — fusionner et publier**

```bash
cd D:\njangi237 && git checkout main && git pull && git merge --no-ff v2-lot6 -m "Fusion du lot 6 : mode démo et bascule" && git push
cd app && npm test && npm run build && npm run verifier && npx wrangler pages deploy dist --project-name njangi237 --branch main --commit-dirty=true
```

Expected: déploiement en production réussi.

- [ ] **Step 7: Vérifier la production**

1. `https://njangi237.pages.dev` : écran de connexion de la v2 avec « Essayer la démo ».
2. Olivier se connecte avec son compte (téléphone et PIN saisis par lui) : ses groupes réels s'affichent.
3. `https://njangi237.pages.dev/v1/` : la v1 ; sur le téléphone où il utilisait la v1, Olivier y retrouve ses données.

Retour en arrière si besoin : republier la v1 telle quelle depuis l'étiquette :

```bash
cd D:\njangi237 && git worktree add D:\njangi237-v1 v1 && npx wrangler pages deploy D:\njangi237-v1 --project-name njangi237 --branch main --commit-dirty=true
```

- [ ] **Step 8: Mettre à jour la note de mémoire `njangi237-project.md`** (lot 6 fait, bascule faite, adresse de la v1).
