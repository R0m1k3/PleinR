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

## Installation sur un VPS sans reverse proxy

Le `docker-compose.yml` suppose un Nginx Proxy Manager déjà en place (réseau
externe `nginx_default`). Sur un serveur nu, `docker-compose.caddy.yml` ajoute
**Caddy** devant l'application, sans modifier le fichier de base.

Caddy sert deux entrées à la fois (voir `Caddyfile`) :

| Adresse | Sert | Certificat |
|---|---|---|
| `http://IP_DU_SERVEUR` | tout de suite | aucun (impossible sur une IP nue) |
| `https://votre-domaine.fr` | dès que le DNS pointe sur le serveur | Let's Encrypt, automatique |

On installe donc **tout d'un coup**, on valide par l'IP, et la bascule en HTTPS
se fait ensuite d'elle-même : il n'y a **rien à relancer** au moment de
configurer le DNS. Tant que le domaine ne résout pas, Caddy réessaie la demande
de certificat en arrière-plan avec un délai croissant.

1. Installer Docker : `curl -fsSL https://get.docker.com | sh`
2. Ouvrir les ports : `sudo ufw allow 80,443/tcp`
3. Cloner le dépôt, copier `.env.example` en `.env` et renseigner au minimum
   `POSTGRES_PASSWORD`, `DATABASE_URL`, `SEED_ADMIN_EMAIL`, puis :

   ```dotenv
   COMPOSE_FILE=docker-compose.yml:docker-compose.caddy.yml
   SITE_DOMAIN=votre-domaine.fr
   CADDY_EMAIL=vous@example.fr
   ```

   Renseigner `SITE_DOMAIN` **même si le DNS n'est pas encore en place** : c'est
   ce qui rend la bascule automatique. Laisser `AUTH_URL` **vide** : Auth.js
   déduit alors l'URL des en-têtes de la requête, et suit donc l'IP puis le
   domaine sans reconfiguration.
4. Lancer : `docker compose up -d --build`
5. Relever le mot de passe administrateur, affiché une seule fois :
   `docker logs pleinr-app 2>&1 | grep -i -A2 "mot de passe"`

Aucun port applicatif n'est publié : tout passe par Caddy. Les certificats
vivent dans le volume `caddy_data` et se renouvellent seuls. Une fois le DNS
posé, vérifier la délivrance avec
`docker logs pleinr-caddy 2>&1 | grep -i "certificate obtained"`.

> **Vérification par l'IP** : en HTTP sur une adresse IP, la directive
> `upgrade-insecure-requests` de la CSP (`src/middleware.ts`) peut empêcher le
> navigateur de charger styles et scripts. Pour un test fidèle avant le DNS,
> passer par un tunnel SSH — `ssh -L 8080:localhost:80 utilisateur@IP` — puis
> ouvrir `http://localhost:8080` : `localhost` est une origine de confiance, la
> directive ne s'y applique pas.

Mise à jour : `git pull && docker compose up -d --build`.

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

La diffusion est **pilotée par la validation**, jamais déclenchée à la main :

1. L'adhérent coche Facebook et/ou LinkedIn en soumettant sa promotion. Rien
   n'est publié à ce stade ; il peut modifier son choix tant que la promo est
   `pending`.
2. Le modérateur voit ces cases pré-cochées sur la carte en attente et peut les
   ajuster — c'est le dernier moment où le choix est modifiable.
3. **Valider** met la promo en ligne *et* publie sur les réseaux retenus (image +
   texte + lien vers la fiche adhérent). Après validation, le choix est figé.

Chaque tentative est tracée dans `social_posts` : succès avec le lien du post, ou
échec avec le message d'erreur affiché sur la carte. En cas d'échec, un bouton
**Réessayer** apparaît, limité aux réseaux déjà choisis — il ne permet pas
d'élargir la diffusion.

Une promotion n'est jamais publiée deux fois : un réseau ayant déjà une
publication réussie est systématiquement ignoré, y compris sur un cycle
suspension → remise en ligne.

### Connecter les comptes

Tout se passe dans **Backend › Réseaux sociaux** (administrateurs) : on colle les
identifiants de l'application, on clique **Connecter**, on choisit la page. Les
jetons sont récupérés par OAuth et stockés **chiffrés** (AES-256-GCM, clé
`SOCIAL_TOKEN_KEY` ou à défaut `AUTH_SECRET`) ; ils ne ressortent jamais vers le
navigateur. Un réseau non connecté voit simplement sa case disparaître du
formulaire de promotion.

Le même écran porte l'**URL publique du site**, pré-remplie avec l'adresse par
laquelle vous consultez le backoffice : elle sert à l'adresse de retour OAuth et
au lien inséré dans les publications. Seule l'origine est conservée (le schéma
est ajouté si vous l'omettez, un éventuel chemin est retiré).

L'écran affiche ensuite l'URL de redirection à déclarer sur le portail
développeur — c'est l'erreur de configuration la plus fréquente.

**Facebook.** Créez une application « Business » sur
[developers.facebook.com](https://developers.facebook.com/apps), ajoutez le
produit Connexion Facebook, déclarez l'URL de redirection. Gardez l'application
en **mode développement** avec le compte de l'association comme administrateur :
publier sur votre propre page ne demande alors aucune revue Meta. Le jeton de
page obtenu **n'expire pas** — une connexion suffit, définitivement.

**LinkedIn.** Créez une application sur
[linkedin.com/developers](https://www.linkedin.com/developers/apps) rattachée à
la page de l'association, puis demandez le produit **Community Management API**.
Deux limites à connaître avant de vous lancer :

- l'accès est soumis à une revue (page vérifiée, nom légal, adresse, politique
  de confidentialité) ; ce n'est pas garanti ni immédiat ;
- les jetons LinkedIn durent **60 jours** et le rafraîchissement programmatique
  est réservé à certains partenaires. En pratique il faut donc recliquer sur
  **Reconnecter** environ tous les deux mois. Le backoffice affiche la date
  d'expiration et un bandeau d'alerte 7 jours avant.

Les variables d'environnement (`FACEBOOK_PAGE_ACCESS_TOKEN`, etc.) restent lues
en **repli** si aucun compte n'est connecté, pour ne pas casser une installation
antérieure.

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
| `npm test` | Tests de sécurité (filtre XSS, limitation de connexion, chiffrement) |

## Variables d'environnement

Voir [`.env.example`](./.env.example). Les principales :

- `DATABASE_URL` — chaîne de connexion Postgres
- `AUTH_SECRET` — secret de signature des sessions (**obligatoire**)
- `AUTH_URL` — URL publique de l'application
- `SEED_ON_START` — `true` pour seeder au démarrage du conteneur
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` — premier admin
- `NEXT_PUBLIC_SITE_URL` — repli pour l'URL publique du site ; elle se règle
  normalement dans **Backend › Réseaux sociaux**, aucune variable n'est requise.
- `SOCIAL_TOKEN_KEY` — clé de chiffrement des jetons réseaux (défaut : `AUTH_SECRET`)
- `FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_ACCESS_TOKEN`, `LINKEDIN_ORGANIZATION_URN` /
  `LINKEDIN_ACCESS_TOKEN` — repli si aucun compte n'est connecté via le backoffice

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
