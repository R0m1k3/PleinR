# CLAUDE.md

Guidance for working in this repository.

## What this is

**Plein R** — website for an association of merchants/businesses in the Bassin de
Pompey. A single Next.js application serving a public **Accueil** page and an
authenticated, role-based **Backend** (admin + member space). Postgres is an
external container.

## Stack

- Next.js 15 (App Router, TypeScript, `output: "standalone"`)
- PostgreSQL 16 + Drizzle ORM (`src/db/schema.ts`) with `drizzle-kit` migrations
- Auth.js v5 (credentials provider, JWT sessions) — RBAC in `src/lib/rbac.ts`
- One app container + one Postgres container (`docker-compose.yml`)

## Commands

```bash
npm run dev            # dev server
npm run build          # production build
npm run db:generate    # regenerate SQL after editing src/db/schema.ts
npm run db:migrate     # apply migrations
npm run db:seed        # seed demo data
docker compose up --build   # full stack
```

## Conventions

- **Styling**: faithful port of the original design as inline styles + a small
  design-system in `src/app/globals.css` (palette as CSS vars, fonts, twinkle/float
  animations, hover lifts, responsive grid helpers). No Tailwind.
- **Mutations**: server actions in `src/app/backend/actions.ts`. Each action
  re-checks auth + capability via `auth()` and `can()` before writing, then
  `revalidatePath()`.
- **Access control**: `src/middleware.ts` gates `/backend/*`; each page further
  guards by role (`isStaff`, `can`) and redirects.
- **Data reads** for the public site live in `src/lib/queries.ts`.
- After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new
  file under `drizzle/`.

## Promotions

Statuts : `pending` → `live` → `suspended` ⇄ `live` (+ `rejected` / `expired`).
`promotions.suspended_by` retient qui a suspendu (`member` ou `staff`) : une
suspension par le staff ne peut être levée que par le staff. Les lectures
publiques filtrent sur `status = 'live'`, donc une promo suspendue disparaît du
site sans traitement supplémentaire.

## Réseaux sociaux

- `src/lib/social.ts` publie une promo sur la page Facebook (Graph API) ou
  LinkedIn (Posts API). Jetons **uniquement** en variables d'environnement, jamais
  en base ni dans le backoffice. Réseau non configuré = case masquée.
- Les images de promo sont stockées en data-URI : l'upload se fait donc en
  binaire (multipart pour Facebook, Images API en 3 étapes pour LinkedIn), pas
  par URL.
- La diffusion est déclenchée **par la validation**, pas par un bouton :
  `promotions.share_facebook` / `share_linkedin` sont choisis par l'adhérent,
  ajustables par le modérateur dans le formulaire « Valider », puis figés
  (`status !== 'pending'`).
- `publishPromoShares()` dans `backend/actions.ts` est le seul point de
  publication. Elle ne lève jamais et ignore tout réseau ayant déjà une ligne
  `social_posts` en `posted` : c'est la garde anti-republication, qui couvre
  aussi le cycle suspension → remise en ligne.
- `retryPromoShare` ne sert qu'au rattrapage d'un échec sur un réseau déjà
  choisi ; il ne peut pas élargir la diffusion.
- Les URLs publiques des pages FB/LinkedIn sont des `site_settings`
  (`association_facebook`, `association_linkedin`), éditables dans Paramètres.

## Roles

`admin` > `moderator` > `editor` are staff; `member` is an adhérent linked to a
`members` row via `users.memberId`. Capability matrix is in `src/lib/rbac.ts`.

## Docker notes

- Migrations + optional seed run on container start via `docker-entrypoint.sh`.
- `npm run build:scripts` bundles `migrate`/`seed` into `dist/*.cjs` so the runtime
  image needs no dev dependencies.
- The standalone server binds `HOSTNAME=0.0.0.0`, `PORT=3000`.

## Logo

`public/assets/logo.svg` is a brand-colour recreation; swap in the official asset
when available (referenced as `/assets/logo.svg`).
