# Plein R

Site de l'association **Plein R** — les commerçants et entreprises du Bassin de Pompey.
*Réseau · Rencontre · Réussite.*

Deux surfaces, **une seule application** :

- **Accueil** (`/`) — vitrine publique : héro + recherche, métiers, promotions des adhérents, mises à l'honneur.
- **Backend** (`/backend`) — back-office authentifié avec rôles : tableau de bord, adhérents, modération des promotions, administrateurs, et l'espace adhérent.

## Stack

| Couche | Choix |
|---|---|
| Framework | **Next.js 15** (App Router, TypeScript, sortie `standalone`) |
| Base de données | **PostgreSQL 16** (conteneur externe) |
| Accès données | **Drizzle ORM** + `drizzle-kit` (migrations versionnées) sur le driver `pg` |
| Authentification | **Auth.js v5** (NextAuth) — provider *credentials*, sessions JWT, RBAC |
| Conteneurisation | **1 conteneur applicatif** + **1 conteneur Postgres** (docker-compose) |

L'application tourne dans **un seul conteneur Docker**. Postgres est un **conteneur séparé** (externe).

## Démarrage rapide (Docker)

```bash
cp .env.example .env
# AUTH_SECRET est optionnel : s'il est vide, le conteneur en génère un et le
# persiste automatiquement. Pour le fixer vous-même : openssl rand -base64 32

docker compose up --build
```

Au démarrage, le conteneur applique les migrations puis (si `SEED_ON_START=true`)
charge des données de démonstration. Ensuite :

- Site public : http://localhost:8413
- Espace adhérent / admin : http://localhost:8413/backend
- Connexion admin par défaut : `admin@plein-r.fr` / `changeme123`

> **Ports (volontairement peu courants pour éviter les conflits)** : l'app est
> publiée sur l'hôte en **8413** (→ 3000 dans le conteneur) et Postgres en
> **54329** (→ 5432). Modifiez la partie gauche des `ports:` dans
> `docker-compose.yml` si besoin. En dev local (`npm run dev`), l'app reste sur 3000.

> **Postgres déjà existant ?** Supprimez le service `postgres` de `docker-compose.yml`
> et pointez `DATABASE_URL` vers votre instance.

## Comptes de démonstration (seed)

| E-mail | Mot de passe | Rôle |
|---|---|---|
| admin@plein-r.fr | changeme123 | Administrateur |
| claire@plein-r.fr | changeme123 | Administrateur |
| thomas@plein-r.fr | changeme123 | Modérateur |
| sophie@plein-r.fr | changeme123 | Éditeur |
| contact@aubonpain.fr | changeme123 | Adhérent (Au Bon Pain) |

## Rôles & permissions

| Capacité | admin | moderator | editor | member |
|---|:--:|:--:|:--:|:--:|
| Tableau de bord | ✅ | ✅ | ✅ | — |
| Adhérents (CRUD) | ✅ | ✅ | ✅ | — |
| Modération des promotions | ✅ | ✅ | — | — |
| Publication réseaux sociaux | ✅ | ✅ | — | — |
| Administrateurs | ✅ | — | — | — |
| Mon espace (publier une promo) | — | — | — | ✅ |

`/backend` est protégé par le middleware ; chaque vue affine l'accès selon le rôle.

## Cycle de vie d'une promotion

`pending` → `live` → `suspended` ⇄ `live`, ou suppression.

- L'adhérent soumet la promotion depuis **Mon espace** : elle part en `pending`.
- L'association la valide dans **Backend › Promotions** : elle passe `live` et
  s'affiche sur l'accueil, l'annuaire et la fiche de l'adhérent.
- **Suspension** : l'adhérent peut suspendre *ses* promotions depuis Mon espace,
  l'association peut suspendre n'importe laquelle. Une promotion suspendue sort
  immédiatement du site public et peut être remise en ligne à tout moment.
  Nuance importante : une suspension décidée par l'association ne peut pas être
  levée par l'adhérent (`promotions.suspended_by` mémorise l'auteur).

## Publication sur Facebook / LinkedIn

Depuis **Backend › Promotions**, une promotion `live` peut être publiée sur la
page Facebook et/ou la page LinkedIn de l'association (image + texte + lien vers
la fiche adhérent). Chaque tentative est tracée dans la table `social_posts`
(succès avec le lien du post, ou échec avec le message d'erreur affiché sur la
carte).

Les jetons d'accès sont des **secrets** : ils se configurent uniquement par
variables d'environnement (`FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`,
`LINKEDIN_ORGANIZATION_URN` ou `LINKEDIN_ORGANIZATION_ID`,
`LINKEDIN_ACCESS_TOKEN`), jamais depuis le backoffice. Voir
[`.env.example`](./.env.example) pour la marche à suivre côté Meta et LinkedIn.
Si un réseau n'est pas configuré, son bouton n'apparaît simplement pas.

Les **liens publics** vers les deux pages (affichés sur l'accueil et dans le pied
de page) se règlent, eux, dans **Backend › Paramètres**.

## Développement local (sans Docker)

```bash
npm install
# Postgres accessible via DATABASE_URL (voir .env.example)
npm run db:generate   # (re)génère le SQL de migration depuis le schéma
npm run db:migrate    # applique les migrations
npm run db:seed       # données de démonstration
npm run dev           # http://localhost:3000
```

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (standalone) |
| `npm run build:scripts` | Bundle des scripts migrate/seed (utilisé par Docker) |
| `npm run db:generate` | Génère les migrations Drizzle |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:seed` | Insère les données de démonstration |

## Variables d'environnement

Voir [`.env.example`](./.env.example). Les principales :

- `DATABASE_URL` — chaîne de connexion Postgres
- `AUTH_SECRET` — secret de signature des sessions (**obligatoire**)
- `AUTH_URL` — URL publique de l'application
- `SEED_ON_START` — `true` pour seeder au démarrage du conteneur
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` — premier admin
- `NEXT_PUBLIC_SITE_URL` — URL publique reprise dans les posts réseaux sociaux
- `FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_ACCESS_TOKEN` — publication Facebook (optionnel)
- `LINKEDIN_ORGANIZATION_URN` / `LINKEDIN_ACCESS_TOKEN` — publication LinkedIn (optionnel)

## Note sur le logo

Le logo (`public/assets/logo.svg`) est une recréation vectorielle aux couleurs de
la marque. Remplacez ce fichier par le logo officiel quand vous le souhaitez
(les pages le référencent via `/assets/logo.svg`).

## Architecture du dépôt

```
src/
├── app/
│   ├── page.tsx                  # Accueil (public)
│   ├── login/                    # connexion
│   ├── api/auth/[...nextauth]/   # routes Auth.js
│   └── backend/                  # back-office
│       ├── layout.tsx            # garde d'auth + shell
│       ├── page.tsx              # tableau de bord
│       ├── adherents/            # adhérents (liste, ajout, édition)
│       ├── promotions/           # modération
│       ├── administrateurs/      # gestion des accès
│       ├── espace/               # espace adhérent (publication)
│       └── actions.ts            # server actions (mutations)
├── db/                           # schéma Drizzle, client, migrate, seed
├── lib/                          # requêtes, RBAC
└── types/                        # augmentation des types Auth.js
```
