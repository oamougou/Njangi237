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
