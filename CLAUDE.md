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
npm run db:seed        # catégories + admin initial ; données de démo si SEED_DEMO=true
npm run db:purge-demo  # retire les données de démo d'une base qui les a reçues
docker compose up --build   # full stack
```

## Conventions

- **Styling**: faithful port of the original design as inline styles + a small
  design-system in `src/app/globals.css` (palette as CSS vars, fonts, twinkle/float
  animations, hover lifts, responsive grid helpers). No Tailwind.
- **Mutations**: server actions in `src/app/backend/actions.ts`. Each action
  re-checks auth + capability via `getSession()` and `can()` before writing, then
  `revalidatePath()`.
- **Access control**: `src/middleware.ts` gates `/backend/*`; each page further
  guards by role (`isStaff`, `can`) and redirects.
- **Data reads** for the public site live in `src/lib/queries.ts`.
- After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new
  file under `drizzle/`.
- **Catégories** : le référentiel vit dans `src/db/categories.ts` (slugs stables,
  jamais renommés). Il est inséré par la migration `0012_referentiel_categories`
  (`ON CONFLICT (slug)` : seul `sort` est réaligné, un libellé renommé depuis le
  backend est conservé) et rejoué par le seed. Pour ajouter une catégorie, on
  l'ajoute au référentiel **et** on génère une nouvelle migration `--custom`
  du même modèle ; `tests/categories.test.ts` vérifie la cohérence.

## Promotions

Statuts : `pending` → `live` → `suspended` ⇄ `live` (+ `rejected` / `expired`).
`promotions.suspended_by` retient qui a suspendu (`member` ou `staff`) : une
suspension par le staff ne peut être levée que par le staff. Les lectures
publiques filtrent sur `status = 'live'`, donc une promo suspendue disparaît du
site sans traitement supplémentaire.

## Réseaux sociaux

- `src/lib/social.ts` publie une promo sur la page Facebook (Graph API) ou
  LinkedIn (Posts API). `src/lib/social-accounts.ts` gère la configuration : OAuth,
  jetons, cibles. Réseau non configuré = case masquée.
- Les identifiants et jetons vivent en base (`social_accounts`), **chiffrés** via
  `src/lib/crypto.ts` (AES-256-GCM, clé `SOCIAL_TOKEN_KEY` ou `AUTH_SECRET`), posés
  depuis `/backend/reseaux`. Les variables d'environnement restent lues en repli.
  Aucun secret ne doit jamais repartir vers le navigateur.
- `isNetworkConfigured()` / `configuredNetworks()` / `siteUrl()` / `redirectUri()`
  sont **asynchrones** (accès base).
- L'URL publique est le réglage `site_public_url`, édité sur `/backend/reseaux`
  (pré-rempli depuis les en-têtes de la requête). `saveSiteSettings` **saute**
  cette clé : le formulaire Paramètres ne la contient pas et l'écraserait.
- Routes OAuth : `src/app/api/social/[network]/{connect,callback}`. Le `state`
  anti-CSRF passe par un cookie httpOnly ; aucun jeton ne transite par une URL.
- Facebook : le jeton de page n'expire pas. LinkedIn : 60 jours, rafraîchissement
  programmatique réservé à certains partenaires, d'où le bandeau de reconnexion.
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

## Sécurité

- Le journal d'activité agrège des saisies de tiers, dont le formulaire de
  contact **public** : il est filtré à l'écriture (`sanitizeActivityMessage`) et
  rendu en éléments React (`activityNodes`), jamais en HTML brut.
- `getSession()` (`src/lib/session.ts`) remplace `auth()` partout : le rôle et le
  rattachement adhérent sont relus en base à chaque requête, et
  `users.session_version` invalide les jetons émis avant un changement de mot de
  passe. N'appelez plus `auth()` directement depuis une page ou une action.
- Les images ne sont acceptées qu'en data-URI (`asImageDataUri`) : une URL ferait
  appeler par le serveur une cible choisie par l'utilisateur (SSRF).
- La CSP à nonce est posée par `src/middleware.ts`. Elle impose un rendu
  dynamique : `export const dynamic = "force-dynamic"` est dans `app/layout.tsx`,
  un HTML pré-généré ne pouvant pas porter de nonce.
- Les mots de passe temporaires (création d'adhérent, réinitialisation,
  invitation staff) ne sont **jamais stockés** : l'action les renvoie et le
  composant `OneTimeCredentials` les affiche une seule fois, sans redirection.
  `users.must_change_password` seul persiste.
- Le seed ne crée en production que le référentiel des catégories et
  l'administrateur initial, avec un mot de passe aléatoire affiché une fois
  dans les journaux (ou `SEED_ADMIN_PASSWORD`) et un changement obligatoire à
  la première connexion. Toutes les données de démonstration (adhérents,
  promotions, demandes, journal, comptes `changeme123`) vivent dans
  `src/db/demo-data.ts`, exigent `SEED_DEMO=true`, et `npm run db:purge-demo`
  les retire d'une base existante.
- Sessions JWT limitées à 7 jours (`auth.config.ts`), HSTS et suppression de
  `X-Powered-By` dans `next.config.mjs`. Le port Postgres de `docker-compose`
  n'est publié que sur `127.0.0.1`.
- `npm test` verrouille ces protections (`tests/security.test.ts`).

## Référencement (SEO)

- `src/lib/seo.ts` est **pur** (constantes, `pageMetadata()`, générateurs JSON-LD,
  `serializeJsonLd()` qui échappe `<>&`) et verrouillé par `tests/seo.test.ts`.
  `src/lib/seo-server.ts` fournit `publicBaseUrl()` : réglage `site_public_url`,
  puis variables d'environnement, puis en-têtes de la requête.
- `app/layout.tsx` pose `metadataBase`, le gabarit de titre `%s · Plein R`,
  Open Graph / Twitter, `robots`, le manifeste, et les JSON-LD `Organization` +
  `WebSite`. Chaque page publique appelle `pageMetadata({ title, description,
  path })` : le `path` sert de canonique (l'annuaire ignore ainsi `?q=`).
- Données structurées par page via `<JsonLd data={…} />` : `BreadcrumbList`
  partout, `ItemList` sur l'annuaire, `LocalBusiness` (+ horaires) sur la fiche
  adhérent, `BusinessEvent` pour chaque rencontre à venir.
- `app/robots.ts`, `app/sitemap.ts` (pages statiques + adhérents actifs),
  `app/manifest.ts` et `app/opengraph-image.tsx` (vignette 1200×630 générée).
- `/backend`, `/login`, `/inscription/*` et les fiches non actives sont en
  `NOINDEX` ; les pages publiques utilisent `<main>` et un seul `<h1>`.
- **Tags adhérents** : `src/lib/tags.ts` (pur) porte un vocabulaire par métier
  (`CATEGORY_TAGS`, un par slug du référentiel, vérifié par `tests/tags.test.ts`)
  et un vocabulaire transversal détecté dans la description. `autoTags()` ne
  remplit le champ qu'à vide : à l'enregistrement (`resolveMemberTags` dans
  `backend/actions.ts`) et à l'affichage de la fiche publique. Le composant
  `TagsField` propose les suggestions en pastilles cliquables dans les deux
  formulaires. Un nouveau métier dans `categories.ts` exige son entrée dans
  `CATEGORY_TAGS`.
- **URLs de fiche** : `memberPath({ id, name, city })` donne
  `/adherents/12-au-bon-pain-frouard`. L'identifiant en tête suffit
  (`parseMemberParam`), toute autre écriture est redirigée en 301 vers la forme
  canonique par la page : ne construisez jamais `/adherents/${id}` à la main.
- **Pages métier** : `/annuaire/[categorie]` (slug de `categories`) rend une page
  indexable par activité (titre, intro, grille `MemberCard`, `ItemList`) ;
  sans adhérent elle passe en `NOINDEX` et sort du sitemap. L'annuaire et ces
  pages listent les métiers via `CategoryLinks` pour le maillage interne.

## Adhérents

- L'espace adhérent est en deux pages : `/backend/espace` (profil, inscriptions,
  droit à l'image) et `/backend/espace/promotions` (dépôt et suivi des promos,
  les offres **en ligne** en tête). `EspaceHeader` porte le bandeau et les
  onglets ; toute action qui touche l'espace revalide les deux chemins.
- La catégorie d'une promotion est un **type de produit ou de service**
  (`src/lib/promo-categories.ts`, groupes pour `<optgroup>`), pas le métier de
  l'adhérent ; `defaultPromoCategory(slug)` pré-sélectionne depuis le métier.

- `members.email` est l'e-mail **administratif** (identifiant de connexion à la
  création, échanges avec l'association) ; `members.contact_email` est l'e-mail
  **public** de la fiche, saisi par l'adhérent ou le staff. La fiche et le
  JSON-LD affichent `contact_email || email` : ne montrez jamais `email` seul.
- `VitrineImage` rend la couverture en `cover`, sinon le logo en `contain`
  (~60 % d'un cadre à hauteur fixe) sur un fond du logo flouté, sinon un
  placeholder rayé. Ne pas l'entourer d'un conteneur sans hauteur : les
  `max-height` en % ne seraient plus résolus et le logo déborderait.

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
