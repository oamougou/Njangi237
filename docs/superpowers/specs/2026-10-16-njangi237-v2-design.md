# Njangi237 v2 — conception

Date : 2026-10-16 · Statut : à relire par Olivier

## 1. Objectif

Passer de la v1 (une page `index.html` hors ligne, données dans le téléphone du trésorier) à une application multi-utilisateurs où **trésoriers et membres** ont chacun leur compte.

- **Usage visé** : pilote avec 1 ou 2 vrais groupes, puis ouverture à d'autres groupes sans refonte.
- **Critères de réussite du pilote** : un vrai groupe (1 trésorier, au moins 5 membres) mène un cycle complet dans l'application : invitations acceptées, paiements déclarés puis validés, cagnotte remise. Aucun membre ne voit les données d'un autre, aucune donnée n'est perdue, même après un passage hors ligne.
- **Données de la v1** : pas de reprise, on repart à zéro.

### Décisions prises avec Olivier

| Sujet | Décision |
|---|---|
| Utilisateurs | Trésoriers et membres, chacun avec son compte |
| Paiements | Le membre déclare (MoMo/OM + référence), le trésorier valide ou conteste ; le trésorier saisit les espèces |
| Tours | Ordre des tours géré (bénéficiaires par cycle, remise de la cagnotte) |
| Connexion | Lien d'invitation WhatsApp puis numéro + PIN à 6 chiffres choisi par le membre |
| Technique | Même socle que KoliTrack : React + TypeScript + Vite (PWA), nouveau projet Supabase dédié, Cloudflare Pages |

### Hypothèses retenues

- Une personne = un compte lié à son numéro, valable pour tous ses groupes ; elle peut être trésorière dans l'un et membre dans l'autre.
- Plusieurs trésoriers possibles par groupe ; le créateur est le trésorier principal.
- Un membre voit ses propres paiements, l'ordre des tours et le taux de recouvrement du groupe, pas le détail des paiements des autres.
- Pas de facturation ni de paiement intégré dans la v2 ; le modèle prévoit `plan` et une limite de membres.

### Hors périmètre de la v2

Amendes de retard, enchères sur le tour, épargne avec intérêts, paiement intégré (Campay, Notch Pay…), notifications push, code SMS, inscription libre, reprise des données de la v1.

## 2. Données et droits d'accès

Nouveau projet Supabase `njangi237` (organisation « cyberIA org », eu-west-1, fuseau `Africa/Douala`). Montants en entiers FCFA.

### Tables

| Table | Colonnes principales |
|---|---|
| `people` | `id` (= `auth.users.id`), `phone` (unique, `237XXXXXXXXX`), `full_name`, `created_at` |
| `platform_admins` | `person_id` — personnes autorisées à créer des groupes pendant le pilote |
| `groups` | `id`, `name`, `type` (`tontine`/`cotisation`/`association`/`autre`), `amount`, `frequency` (`hebdomadaire`/`mensuelle`/`ponctuelle`), `beneficiaries_per_cycle` (défaut 1), `plan` (défaut `pilote`), `max_members` (défaut 50), `order_locked` (bool), `current_round` (défaut 1), `created_by`, `created_at` |
| `memberships` | `id`, `group_id`, `person_id` (null tant que l'invitation n'est pas acceptée), `display_name`, `phone`, `role` (`tresorier`/`membre`), `status` (`invite`/`actif`/`retire`), `position` (ordre des tours), `joined_at`, `left_at` ; unicité (`group_id`, `phone`) |
| `cycles` | `id`, `group_id`, `round`, `number`, `label`, `due_date`, `amount_expected` (figé à l'ouverture), `status` (`ouvert`/`clos`), `opened_at`, `closed_at` |
| `payments` | `id` (uuid généré sur le téléphone), `group_id`, `cycle_id`, `membership_id`, `debt_id` (null sauf règlement d'une dette), `amount`, `method` (`mtn_momo`/`orange_money`/`especes`/`autre`), `reference`, `paid_on`, `status` (`declare`/`valide`/`conteste`), `declared_by`, `validated_by`, `validated_at`, `contest_reason` ; au plus un paiement non contesté par (`cycle_id`, `membership_id`) parmi ceux sans `debt_id`, et au plus un par `debt_id` |
| `debts` | `id`, `group_id`, `membership_id`, `cycle_id` (cycle d'origine), `amount`, `settled_at` — impayés reportés à la clôture d'un cycle |
| `payouts` | `id`, `group_id`, `cycle_id`, `round`, `membership_id`, `amount_expected`, `amount`, `method`, `reference`, `paid_on`, `status` (`prevu`/`remis`), `recorded_by` |
| `invitations` | `id`, `membership_id`, `kind` (`invitation`/`reinitialisation`), `token_hash`, `expires_at`, `used_at`, `created_by` |
| `login_attempts` | `phone`, `failures`, `locked_until` |
| `journal` | `id`, `group_id`, `actor`, `action`, `details` (jsonb), `created_at`, `visible_to_members` (bool) |

### Règles d'accès (RLS)

- **Membre actif d'un groupe** : lit `groups`, `cycles`, `payouts`, sa propre ligne `memberships`, ses propres `payments` et `debts`, les entrées du `journal` marquées `visible_to_members`. L'ordre des tours passe par la vue `v_ordre_tours` (nom, position, rôle, statut, sans numéro) et le taux de recouvrement par la vue `v_recouvrement` (agrégats par cycle, aucun paiement individuel). Les règles d'accès filtrent des lignes, pas des colonnes : c'est pourquoi les numéros des autres ne passent que par ces vues, jamais par la table.
- **Trésorier** : lit tout ce qui concerne son groupe, numéros compris, directement dans les tables.
- **Personne d'un autre groupe ou non connectée** : rien.
- **Écritures** : uniquement par fonctions `security definer` qui contrôlent rôle, groupe, montants et état du cycle ; aucune écriture directe depuis l'application. `execute` retiré à `anon` et `public`, `search_path` figé (leçons de KoliTrack, migration 0002).

### Fonctions serveur (RPC)

`declarer_paiement`, `saisir_especes`, `valider_paiement`, `contester_paiement`, `ouvrir_cycle`, `clore_cycle`, `rouvrir_cycle`, `ordonner_tours`, `tirer_au_sort`, `echanger_tours`, `remplacer_beneficiaire`, `enregistrer_remise`, `nouveau_tour`, `ajouter_membre`, `changer_role`, `retirer_membre`, `creer_groupe` (admins plateforme).

### Garde-fous

- Un groupe garde toujours au moins un trésorier actif.
- Un cycle clos est figé (seuls les règlements de dette, qui portent un `debt_id`, peuvent encore s'y rattacher) ; `rouvrir_cycle` est réservé aux trésoriers et inscrit au journal.
- `declarer_paiement` et `saisir_especes` sont idempotentes (même `id` = même paiement).
- Un seul cycle `ouvert` à la fois par groupe.

## 3. Comptes, invitations et connexion

- **Identifiant interne** : `237XXXXXXXXX@njangi237.local`, mot de passe = PIN à 6 chiffres. Le membre ne voit que son numéro.
- **Normalisation du numéro** (une seule fonction, partagée application/serveur) : chiffres seulement ; 9 chiffres → préfixe `237` ; sinon le numéro doit commencer par `237` et compter 12 chiffres.

### Invitation (Edge Function `inviter`, puis `accepter_invitation`)

1. Le trésorier ajoute un membre (nom, numéro) → adhésion `invite`.
2. `inviter` crée un jeton aléatoire de 32 octets, stocke son empreinte SHA-256, expiration 7 jours, et renvoie `https://<hôte>/#/invitation/<jeton>`. Une nouvelle invitation annule la précédente.
3. L'application ouvre `wa.me/<numéro>` avec un message pré-rempli contenant le lien.
4. Le membre ouvre le lien : nom du groupe et du trésorier affichés. Sans compte → il choisit son PIN (deux saisies). Avec un compte existant → il entre son PIN pour rattacher le groupe.
5. `accepter_invitation` vérifie empreinte, expiration et usage unique, crée le compte si besoin (`people` + utilisateur Auth), passe l'adhésion à `actif`, inscrit l'événement au journal et ouvre la session.

### Création des groupes pendant le pilote

Pas d'inscription libre. Un administrateur plateforme (Olivier, via `platform_admins`) crée le groupe et son premier trésorier depuis l'écran Administration ; l'écran produit le lien d'invitation du trésorier.

### Connexion (Edge Function `connexion`)

Reçoit numéro + PIN. Refuse si `locked_until` est dans le futur. Sinon tente la connexion côté serveur : échec → `failures + 1`, blocage 15 min à 5 échecs ; succès → remise à zéro, renvoi de la session à l'application. La limite par IP de Supabase Auth reste active.

### PIN

- **Changer mon PIN** (profil) : ancien PIN demandé.
- **PIN oublié** : un trésorier d'un groupe du membre génère un lien `#/nouveau-pin/<jeton>` (`kind = reinitialisation`, 24 h, usage unique), envoyé par WhatsApp ; `reinitialiser_pin` fixe le nouveau PIN. Personne d'autre que le membre ne connaît son PIN.

### Limite assumée

Pendant le pilote, c'est l'envoi par WhatsApp au bon numéro qui prouve la possession du numéro. Un lien transféré avant usage permettrait à un tiers de prendre la place du membre ; usage unique, expiration et visibilité de l'acceptation par le trésorier réduisent ce risque. Le code SMS le supprimera à l'ouverture au public.

## 4. Tours et cagnotte

Uniquement pour le type `tontine` ; masqué pour les autres types.

- **Ordre** : `memberships.position`. Réglage manuel (monter/descendre) ou `tirer_au_sort` (tirage côté serveur, horodaté, auteur et résultat au journal, visible des membres). `order_locked` passe à vrai à l'ouverture du premier cycle du tour ; ensuite l'ordre ne change que par `echanger_tours` (inscrit au journal).
- **Bénéficiaires** : à l'ouverture d'un cycle, les `beneficiaries_per_cycle` membres suivants dans l'ordre, sans remise dans le tour courant, reçoivent une ligne `payouts` `prevu`. `remplacer_beneficiaire` = échange de tour, inscrit au journal.
- **Montants** : attendu par bénéficiaire = `amount_expected × membres actifs ÷ k` ; collecté = somme des paiements `valide` du cycle. `enregistrer_remise` propose `collecté ÷ k`, accepte un autre montant et affiche l'écart.
- **Tour complet** : quand chaque membre actif a reçu sa remise, le tour est terminé ; `nouveau_tour` incrémente `current_round`, déverrouille l'ordre pour un nouveau réglage ou tirage.
- **Retrait d'un membre déjà servi** : avertissement « il reste N cycles à payer dans ce tour » ; le montant dû reste visible dans sa fiche.
- **Clôture avec retardataires** : autorisée ; chaque impayé crée une ligne `debts`, visible du trésorier et du membre concerné. Une dette se règle par un paiement portant son `debt_id` : le membre le déclare (`declarer_paiement` avec `debt_id`) ou le trésorier le saisit en espèces, puis la validation renseigne `debts.settled_at`. Ce paiement reste rattaché au cycle d'origine sans le rouvrir et n'entre pas dans le « collecté » du cycle en cours ; il n'est compté que dans le recouvrement des dettes.
- **Date estimée du tour** : à partir de la fréquence et de la date du cycle courant.

## 5. Écrans

Identité visuelle de la v1 : fond papier `#F6F4EC`, vert `#0F5C4E`, or `#C89B3C`, titres en serif, panneaux montant du bas. Conçu pour le téléphone, lisible sur ordinateur.

1. **Connexion** — numéro + PIN. Ouvert depuis un lien : écran **Invitation** ou **Nouveau PIN**.
2. **Mes groupes** — une carte par groupe et rôle. Membre : « À payer : 5 000 FCFA avant le 30/10 » / « Payé ✓ » / « En attente de validation », « Ton tour : cycle 7 (≈ avril 2027) ». Trésorier : taux de recouvrement, nombre de paiements à valider.
3. **Groupe — membre** — carte « Cycle en cours » avec **Déclarer mon paiement**, bénéficiaires du cycle, ordre des tours (sa ligne en évidence), son historique et ses dettes, remises de cagnotte.
4. **Groupe — trésorier**, onglets :
   - **Cycle** : membres et statut (payé / déclaré / en retard), valider ou contester en un geste, saisir des espèces, relancer par WhatsApp un par un, export CSV, ouvrir/clore le cycle.
   - **Membres** : ajouter + inviter, renvoyer l'invitation, lien PIN oublié, nommer/retirer un trésorier, retirer un membre.
   - **Tours** : ordre, tirage, échange, bénéficiaires, remise de la cagnotte, nouveau tour.
   - **Journal**.
5. **Déclarer un paiement** — moyen, montant pré-rempli, référence (obligatoire pour MoMo/OM), date. Même formulaire pour la saisie d'espèces par le trésorier (validé d'office).
6. **Profil** — nom, changer de PIN, quitter.
7. **Administration** (admins plateforme) — « Nouveau groupe » : nom, type, montant, fréquence, `k`, premier trésorier (nom, numéro) → lien d'invitation.

### Temps réel

Abonnement Supabase Realtime aux tables `payments`, `cycles`, `payouts`, `memberships` filtrées sur les groupes de la personne ; une validation apparaît aussitôt chez le membre.

### Hors ligne et réseau faible

- **Lecture** : dernier état de chaque groupe conservé dans IndexedDB (Dexie) ; hors ligne, bandeau « Données du 16/10 à 14:32 ».
- **Écritures en file d'attente** : `declarer_paiement` et `saisir_especes`, avec `id` généré sur le téléphone, envoyées automatiquement au retour du réseau sans doublon.
- **Réservé au réseau** : valider, contester, ouvrir/clore un cycle, tours, invitations — boutons grisés « Nécessite le réseau ».
- **Service worker** : réseau d'abord, cache en secours (comme la v1 corrigée).

### Mode démo

Sans configuration Supabase (`.env` vide) : données fictives (une tontine de 12 membres, une cotisation), bascule entre profil trésorier et profil membre, synchronisation entre onglets par `BroadcastChannel`. Même contrat d'API que la version Supabase.

## 6. Architecture de l'application

Comme KoliTrack, un contrat d'API unique (`Api`) implémenté deux fois : `supabaseApi` (production) et `demoApi`. Les écrans ne dépendent que du contrat.

| Module | Rôle |
|---|---|
| `lib/types.ts` | Types et contrat `Api` |
| `lib/phone.ts` | Normalisation des numéros (partagée avec les Edge Functions) |
| `lib/money.ts` | Cagnotte attendue, collectée, écarts |
| `lib/tours.ts` | Bénéficiaires suivants, date estimée du tour, fin de tour |
| `lib/offline.ts` | Cache IndexedDB et file d'attente des écritures |
| `lib/supabaseApi.ts`, `lib/demoApi.ts` | Implémentations du contrat |
| `screens/…` | Un fichier par écran ou onglet |

## 7. Tests

- **Base** (`supabase/tests/*.sql`) : scénarios par rôle (trésorier, membre, membre d'un autre groupe, anonyme) avec connexion simulée (`request.jwt.claims`), assertions sur ce qui passe et ce qui est refusé, chaque scénario dans une transaction annulée. Cas obligatoires : un membre ne voit pas les paiements des autres ; un autre groupe ne voit rien ; dernier trésorier non retirable ; double paiement impossible ; cycle clos figé ; idempotence des déclarations ; désignation des bénéficiaires et fin de tour.
- **Application** (Vitest) : `phone`, `money`, `tours`, file d'attente hors ligne, et mêmes scénarios rejoués sur `demoApi`.
- **Edge Functions** : `deno check` et tests du jeton (empreinte, expiration, usage unique) et du blocage après 5 PIN faux.
- **Parcours** : joué dans Chrome en mode démo. Sur le vrai projet, Olivier ouvre les liens d'invitation et choisit les PIN ; la base est ensuite vérifiée par SQL.

## 8. Déploiement

- **Supabase** : création du projet `njangi237` après accord explicite d'Olivier, en vérifiant d'abord la limite de projets actifs de l'offre gratuite (DCFMInternalMailManagement est en pause).
- **Cloudflare Pages** : projet `njangi237` existant. Développement publié sur `v2.njangi237.pages.dev` (`--branch v2`) ; la v1 reste sur `njangi237.pages.dev` jusqu'à la bascule.
- **Dépôt** `D:\njangi237` (GitHub `oamougou/Njangi237`) : `app/`, `supabase/migrations/`, `supabase/functions/`, `supabase/tests/`, `docs/`. La v1 reste à la racine jusqu'à la bascule, puis est retirée ; étiquette git `v1` posée avant.

## 9. Lots

1. **Base** : schéma, RLS, RPC, tests SQL.
2. **Comptes** : Edge Functions `inviter`, `accepter_invitation`, `connexion`, `reinitialiser_pin` ; écrans Connexion, Invitation, Nouveau PIN, Profil, Administration.
3. **Trésorier** : cycles, validation/contestation, espèces, membres, relances WhatsApp, export CSV.
4. **Membre** : écran membre, déclaration de paiement, hors ligne, temps réel.
5. **Tours** : ordre, tirage, échanges, bénéficiaires, remise, nouveau tour, journal.
6. **Démo et pilote** : mode démo, publication `v2.njangi237.pages.dev`, premier vrai groupe, puis bascule.

Chaque lot est livré testé avant le suivant.
