# Njangi237 - App de recouvrement communautaire (tontines / cotisations)

MVP fonctionnel, 100% hors ligne, inspiré du même principe que ta PWA NetPartage.

## Contenu du dossier
- `index.html` — l'application complète (interface + logique). C'est le seul fichier indispensable.
- `manifest.json` — permet l'installation "Ajouter à l'écran d'accueil" avec icône et nom.
- `sw.js` — service worker : cache les fichiers pour un fonctionnement 100% hors ligne une fois installée.
- `icon-192.png`, `icon-512.png` — icônes de l'app.

## Ce que fait l'app (v1)
- Créer plusieurs groupes (tontines, cotisations de quartier, associations)
- Ajouter des membres (nom + numéro de téléphone)
- Créer des cycles (ex. "Septembre 2026") et suivre qui a payé / qui est en retard
- Enregistrer un paiement (MTN MoMo, Orange Money, Espèces, montant, référence de transaction optionnelle, date)
- Consulter le suivi de contribution d'un membre (historique cycle par cycle, total versé) en touchant son nom, et le lui envoyer par WhatsApp
- Générer un rappel WhatsApp pré-rempli pour un membre en retard (ou "Relancer tous les retardataires" en un clic)
- Importer des membres directement depuis les contacts du téléphone (nom + numéro pré-remplis)
- Exporter le suivi d'un cycle en CSV
- Sauvegarder / restaurer toutes les données en JSON (backup manuel)
- Toutes les données restent sur l'appareil (`localStorage`) - aucun serveur, aucune donnée envoyée en ligne

## Utilisation immédiate (sans hébergement)
Tu peux ouvrir `index.html` directement dans le navigateur du téléphone (double-clic ou via une appli de gestion de fichiers) : l'app fonctionne intégralement. Seule limite : l'installation "Ajouter à l'écran d'accueil" avec icône dédiée et le cache hors-ligne du service worker demandent que les fichiers soient servis en `http(s)://`, pas en `file://` (limitation standard des navigateurs Android/iOS).

## Pour une vraie installation "PWA" (icône + hors-ligne natif)
Il faut héberger le dossier sur une URL https, même gratuite. Options les plus simples :

1. **GitHub Pages** (gratuit, recommandé)
   - Crée un dépôt GitHub, dépose les 5 fichiers de ce dossier à la racine
   - Active GitHub Pages dans Settings → Pages → branche `main`
   - Ouvre l'URL fournie sur le téléphone → menu du navigateur → "Ajouter à l'écran d'accueil"

2. **Netlify / Vercel (glisser-déposer)**
   - Dépose le dossier `njangi237` sur netlify.com (drag & drop, sans compte requis pour un déploiement rapide)
   - Récupère l'URL, ouvre-la sur le téléphone, installe

3. **Hébergement mutualisé existant** (si tu en as un pour TECHNOVA)
   - Upload du dossier tel quel via FTP dans un sous-dossier, ex. `tonsite.com/njangi237/`

## Pistes d'évolution (v2, si tu veux monétiser à plusieurs groupes/utilisateurs)
- Multi-appareil en temps réel : un membre ouvre l'app sur *son propre* téléphone et voit son statut se mettre à jour en direct (nécessite un backend — Supabase serait un bon choix, déjà dans tes outils). La v1 ne propose que le relevé "à la demande" envoyé par WhatsApp, décrit plus haut.
- Rôle "trésorier" avec plusieurs comptes par groupe
- Génération automatique de reçus PDF par cotisation
- Rappels programmés automatiquement (pas seulement à la demande) via notification WhatsApp Business API
- Statistiques multi-cycles (historique de régularité par membre, utile pour arbitrer les tours de tontine)

---
*Remarque méthodologique : les numéros de téléphone camerounais sont normalisés en préfixe 237 pour les liens WhatsApp (wa.me) ; si un membre a un numéro international, il faudra l'ajuster manuellement dans son profil.*

*Remarque méthodologique sur l'import de contacts : cette fonctionnalité repose sur la Contact Picker API du navigateur (`navigator.contacts.select`). Elle n'est disponible que sur Chrome/Edge pour Android, servi en `https://` (le fichier hébergé, pas ouvert en `file://`). Elle est absente sur iOS Safari et sur tous les navigateurs de bureau — sur ces plateformes, le bouton "Importer depuis les contacts" reste automatiquement masqué et l'ajout manuel (nom + numéro) reste la seule option. Cette limite vient du navigateur, pas de l'app.*


*Remarque méthodologique sur le nom de stockage interne : le renommage en "Njangi237" n'a touché que l'affichage (titre, en-tête, manifest, README). La clé technique `applica_data_v1` utilisée par `localStorage` n'a volontairement pas été changée, pour ne pas effacer des données déjà enregistrées si l'app avait déjà été utilisée sous son ancien nom.*
