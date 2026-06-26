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
# éditez .env : au minimum, définissez AUTH_SECRET
#   openssl rand -base64 32

docker compose up --build
```

Au démarrage, le conteneur applique les migrations puis (si `SEED_ON_START=true`)
charge des données de démonstration. Ensuite :

- Site public : http://localhost:3000
- Espace adhérent / admin : http://localhost:3000/backend
- Connexion admin par défaut : `admin@plein-r.fr` / `changeme123`

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
| Administrateurs | ✅ | — | — | — |
| Mon espace (publier une promo) | — | — | — | ✅ |

`/backend` est protégé par le middleware ; chaque vue affine l'accès selon le rôle.

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
