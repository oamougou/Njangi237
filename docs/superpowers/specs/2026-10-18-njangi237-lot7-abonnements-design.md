# Njangi237 — Lot 7 : offres et abonnements — conception

Date : 2026-10-18. Validée en conversation par Olivier (blocage doux, abonnement rattaché au groupe, offre Pilote pour les groupes existants jusqu'au 31 janvier 2027).
Source : plan marketing « Rendre Njangi237 rentable » (offres et prix), validé le 2026-10-18.

## 1. But

Faire payer les trésoriers et les associations, jamais les membres, avec un paiement manuel (numéro marchand MTN MoMo ou Orange Money) et une activation par l'administrateur de la plateforme. Un trésorier doit savoir à tout moment quelle offre a son groupe, jusqu'à quand, combien de membres il peut avoir et comment payer. L'administrateur doit traiter une demande en quelques secondes.

## 2. Offres

| Offre | Code | Limite de membres comptés par groupe | Prix mensuel | Prix annuel | Attribution |
|---|---|---|---|---|---|
| Découverte | `decouverte` | 10 | gratuit | gratuit | par défaut, sans abonnement |
| Essai | `essai` | 50 | gratuit | — | automatique : 30 jours après la création du groupe |
| Groupe | `groupe` | 50 | 2 000 FCFA | 20 000 FCFA | demande du trésorier acceptée |
| Association | `association` | 50 (jusqu'à 5 groupes par abonnement) | 7 500 FCFA | 75 000 FCFA | demande acceptée, l'administrateur choisit les groupes couverts |
| Diaspora | `diaspora` | 50 | 5 € | 50 € | demande acceptée |
| Pilote | `pilote` | 50 | gratuit | — | attribuée par l'administrateur, avec une date de fin |

- « Membres comptés » : adhésions invitées ou actives (`status <> 'retire'`), comme pour les cycles.
- **Prix de lancement** : moitié prix à vie, coché par l'administrateur sur un groupe ; 50 groupes au plus (la base refuse le 51e). Les prix affichés au trésorier tiennent compte de la case.
- L'offre Association regroupe jusqu'à 5 groupes, de 50 membres chacun (écart assumé avec les « 200 membres au total » du plan marketing : plus simple à comprendre et à vérifier).
- L'offre Partenaires reste sur devis, gérée à la main (hors application).

## 3. Offre en vigueur

À un instant donné, l'offre en vigueur d'un groupe est, dans cet ordre :

1. un abonnement payant (`groupe`, `association`, `diaspora`) dont la période couvre maintenant ;
2. sinon un abonnement `pilote` dont la période couvre maintenant ;
3. sinon l'essai, si le groupe a été créé il y a moins de 30 jours ;
4. sinon Découverte.

La limite de membres est celle de l'offre en vigueur. La date de fin affichée est celle de l'abonnement ou de l'essai en vigueur (aucune pour Découverte).

## 4. Blocage doux

- **Ajouter un membre** est refusé quand le groupe a déjà autant de membres comptés que la limite : « Limite de l'offre Découverte atteinte (10 membres) : passez à l'offre Groupe dans l'onglet Abonnement ». Le retour d'un membre retiré compte comme un ajout.
- **Ouvrir un cycle** est refusé quand le groupe a plus de membres comptés que la limite (cas typique : fin d'essai à 25 membres) : « Votre groupe compte 25 membres, l'offre Découverte en permet 10 : choisissez une offre dans l'onglet Abonnement ».
- Tout le reste reste permis, quel que soit l'état de l'abonnement : déclarer, valider, contester, saisir des espèces, clôturer, rouvrir, remettre la cagnotte, ordre et échanges, consulter, inviter un membre déjà ajouté.
- Un groupe de 10 membres au plus dont l'essai se termine passe en Découverte sans aucune perte.
- Les vérifications sont faites dans les fonctions SQL `ajouter_membre` et `ouvrir_cycle` (impossible à contourner par l'API). L'application affiche en plus les limites pour éviter l'erreur.

## 5. Paiement et activation

1. Dans l'onglet **Abonnement** de son groupe, le trésorier choisit une offre payante (Groupe ou Diaspora ; Association aussi, en précisant dans un champ libre les autres groupes concernés) et une durée (1 mois ou 12 mois). Il voit le montant à payer et les numéros marchands, paie, puis saisit le moyen (MTN MoMo, Orange Money, autre) et la référence de la transaction (obligatoire pour MoMo et Orange Money).
2. La demande est enregistrée « en attente ». Une seule demande en attente par groupe ; le trésorier peut l'annuler.
3. Dans l'administration, l'administrateur voit les demandes en attente (groupe, offre, durée, montant attendu, moyen, référence, date). Il **accepte** (l'abonnement est créé ou prolongé) ou **refuse** avec un motif, visible du trésorier.
4. Prolongation : la nouvelle période commence à la fin de l'abonnement payant en cours de même offre s'il y en a un, sinon maintenant ; durée 1 mois ou 12 mois calendaires.
5. Toutes les actions sont inscrites au journal du groupe, réservées au trésorier (`visible_to_members = false`) : demande, annulation, acceptation, refus, attribution.

## 6. Administration

Nouvelle section **Abonnements** de l'écran Administration (administrateurs de la plateforme seulement) :

- demandes en attente, avec Accepter / Refuser ;
- liste des groupes : nom, offre en vigueur, date de fin, membres comptés / limite, prix de lancement ;
- attribuer l'offre Pilote à un groupe avec une date de fin ;
- créer un abonnement Association : durée, puis choix de 1 à 5 groupes ;
- cocher ou décocher le prix de lancement (compteur « n / 50 ») ;
- numéros marchands MTN MoMo et Orange Money, et nom du bénéficiaire, affichés aux trésoriers.

## 7. Données

Migration `0009_abonnements.sql` :

- `abonnements` : `id`, `offre` (`groupe` | `association` | `diaspora` | `pilote`), `debut`, `fin` (timestamptz), `cree_par`, `created_at`. Un abonnement couvre un ou plusieurs groupes.
- `abonnements_groupes` : (`abonnement_id`, `group_id`) ; au plus 5 groupes pour une Association, exactement 1 pour les autres offres.
- `demandes_abonnement` : `id`, `group_id`, `offre`, `duree_mois` (1 | 12), `montant`, `devise` (`XAF` | `EUR`), `moyen`, `reference`, `precisions`, `statut` (`en_attente` | `acceptee` | `refusee` | `annulee`), `motif`, `demande_par`, `traitee_par`, `created_at`, `traitee_le`.
- `groups.prix_lancement` (booléen, faux par défaut) ; la colonne inutilisée `groups.plan` est retirée.
- `parametres_plateforme` : clé / valeur pour les numéros marchands et le bénéficiaire.
- Fonctions : `offre_en_vigueur(groupe)` (offre, limite, fin), `demander_abonnement`, `annuler_demande`, `accepter_demande`, `refuser_demande`, `attribuer_pilote`, `creer_association`, `changer_prix_lancement`, `regler_parametres`, et lectures pour l'onglet Abonnement et l'administration. `ajouter_membre` et `ouvrir_cycle` appellent `offre_en_vigueur`.
- Droits : RLS comme le reste (trésorier du groupe pour sa demande et son abonnement ; administrateur pour tout) ; fonctions d'administration refusées à quiconque n'est pas administrateur.
- Reprise : à l'application de la migration, chaque groupe existant reçoit un abonnement `pilote` jusqu'au 2027-01-31 23:59 (heure de Douala).

## 8. Écrans

- **Onglet Abonnement** (trésorier) : offre en vigueur et date de fin, barre « membres / limite », tableau des offres et de leurs prix (prix de lancement appliqué), numéros marchands à copier, formulaire « J'ai payé », état de la demande en cours (en attente, refusée avec le motif), historique des abonnements.
- **Bandeau** dans le groupe pour le trésorier : 7 jours avant la fin de l'essai ou de l'abonnement, et quand l'ajout de membres ou l'ouverture de cycle est bloqué ; lien vers l'onglet Abonnement.
- **Membres** : aucun changement.
- **Démo** : aucune limite dans le moteur de démo ; l'onglet Abonnement affiche « Offre Groupe (démo) » en lecture seule, sans formulaire.

## 9. Tests

- Base (PGlite) : offre en vigueur dans chaque cas (payant, Pilote, essai, Découverte, périodes passées), refus d'ajout et d'ouverture aux bonnes limites, actions toujours permises en blocage doux, demande / annulation / acceptation / refus, prolongation, Association à 5 groupes, prix de lancement limité à 50, droits (membre, trésorier d'un autre groupe, administrateur), reprise Pilote des groupes existants, liste blanche des fonctions.
- Application (Vitest) : onglet Abonnement (affichage, formulaire, référence obligatoire, demande en attente), bandeau, section Administration, démo inchangée.

## 10. Hors périmètre

Paiement automatique (Campay, Notch Pay…), factures PDF, rappels WhatsApp automatiques de fin d'abonnement, offre Partenaires dans l'application, limite « 1 groupe » de l'offre Découverte.

## 11. Publication

Lot sur la branche `v2-lot7`. L'aperçu `v2.njangi237.pages.dev` et la production partagent la même base Supabase : la migration ne s'applique donc qu'après le feu vert d'Olivier. Elle est sans effet visible pour les groupes existants, qui reçoivent tous l'offre Pilote. Ensuite : aperçu, vérification, puis production.
