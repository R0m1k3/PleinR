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

Statuts : `pending` → (`scheduled` →) `live` → `suspended` ⇄ `live`
(+ `rejected` / `expired`).
`promotions.suspended_by` retient qui a suspendu (`member` ou `staff`) : une
suspension par le staff ne peut être levée que par le staff. Les lectures
publiques filtrent sur le statut `live`, donc une promo suspendue — ou encore
programmée — disparaît du site sans traitement supplémentaire.

**Période de validité** : `promotions.starts_on` / `ends_on` (colonnes `date`,
les deux facultatives et indépendantes). `src/lib/promo-validity.ts` est **pur**
et verrouillé par `tests/promo-validity.test.ts` : `formatValidity()` rend
« Valable du 1er au 15 mars 2027 » / « Valable jusqu'au … » / « Valable à partir
du … », `formatValidityShort()` la variante sans « Valable » pour les lignes de
méta, `isRangeInvalid()` garde le formulaire et l'action. Sans date, rien n'est
affiché ; l'ancien texte libre `valid_until` (jamais écrit par l'application)
ne sert plus que de repli d'affichage. La même phrase part dans le message
Facebook / LinkedIn (`buildPromoMessage`) : un seul formateur pour le site,
le backoffice et les réseaux.

La liste publique vit sur **`/promotions`** (toutes les offres en cours) ;
l'accueil n'en montre que les six dernières et renvoie vers elle. Les deux
listes partagent `src/components/PromoCard.tsx` : un seul rendu, pas deux
cartes à maintenir. `getLivePromotions(limit)` accepte `null` pour « tout »,
la limite restant appliquée en SQL. Les liens « Promotions » de l'en-tête, du
pied de page et des publications réseaux pointent sur cette page, plus sur
l'ancre `/#promotions`.

Une promotion n'est **affichée que pendant sa période** : les lectures de
`src/lib/queries.ts` passent par `VISIBLE_PROMO` (statut `live` **et** fenêtre
de dates, journée calculée en `Europe/Paris` — un conteneur en UTC retirerait
sinon une offre deux heures trop tôt). Le statut n'est pas modifié : hors
période, le backoffice affiche `visibilityNote()` (« pas encore affichée » /
« période terminée »), et l'offre revient d'elle-même si les dates changent.

**Publication programmée** : `promotions.publish_at` (`timestamptz`, vide =
mise en ligne immédiate). L'adhérent propose une date dans son formulaire, le
modérateur la garde, la déplace ou la vide dans « Valider » — comme les cases
réseaux, c'est le dernier moment où elle est ajustable. Une promotion validée
avec une échéance future passe au statut `scheduled` : invisible du site et
**rien n'est diffusé**. `releaseDuePromotions()` (`src/lib/promo-publish.ts`)
fait la bascule `scheduled → live` par un `UPDATE … RETURNING` filtré sur le
statut — atomique, donc sans double publication même à plusieurs instances —
puis appelle `publishPromoShares()`. Le bouton « Publier maintenant » de la
modération court-circuite l'attente.

`src/lib/promo-schedule.ts` est **pur** (`tests/promo-schedule.test.ts`) :
il convertit la saisie `datetime-local` depuis/vers l'heure de l'association
(`Europe/Paris`, changements d'heure compris) et refuse une saisie illisible
plutôt que de la transformer en publication immédiate.

Le déclencheur est `src/instrumentation.ts` : une boucle d'une minute démarrée
avec le serveur, avec un premier passage au démarrage pour rattraper les
échéances tombées pendant un redéploiement. `PROMO_SCHEDULER=off` la désactive.
Le travail vit dans `src/instrumentation-node.ts` parce que Next compile aussi
`instrumentation.ts` pour le runtime edge du middleware : `next.config.mjs`
l'écarte de ce bundle (`IgnorePlugin`), sans quoi webpack tente d'y embarquer
`pg` et ses dépendances Node.

`src/lib/promo-publish.ts` porte `publishPromoShares()` — et non plus
`backend/actions.ts` — parce qu'il a deux appelants : une action serveur et la
boucle de libération, qui n'a pas de requête et ne peut donc pas appeler
`revalidatePath()`. `src/lib/activity-log.ts` porte `logActivity()` pour la
même raison.

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
- « N'expire pas » ≠ « ne meurt jamais » : `checkTokenHealth()` interroge la
  plateforme et persiste le verdict dans `social_accounts.last_check_*`.
  L'écran Réseaux contrôle à chaque affichage ; le tableau de bord passe par
  `tokenHealthCached()` (6 h) et croise le résultat avec la dernière tentative
  de publication en échec. Une date d'expiration seule ne suffit pas à alerter.
- Les images de promo sont stockées en data-URI : l'upload se fait donc en
  binaire (multipart pour Facebook, Images API en 3 étapes pour LinkedIn), pas
  par URL.
- L'image part **telle quelle** : aucun recadrage ni redimensionnement côté
  application. Un visuel non carré est donc recadré — ou entouré de bandes de
  couleur — par la plateforme. `src/lib/image-info.ts` (pur, verrouillé par
  `tests/image-info.test.ts`) décrit le fichier déposé (dimensions, format,
  poids) et `MemberSpaceForm` l'affiche sous l'aperçu : on informe, on ne
  bloque pas.
- La diffusion est déclenchée **par la validation** (ou par l'échéance d'une
  publication programmée), pas par un bouton :
  `promotions.share_facebook` / `share_linkedin` sont choisis par l'adhérent,
  ajustables par le modérateur dans le formulaire « Valider », puis figés
  (`status !== 'pending'`).
- `publishPromoShares()` dans `src/lib/promo-publish.ts` est le seul point de
  publication. Elle ne lève jamais et ignore tout réseau ayant déjà une ligne
  `social_posts` en `posted` : c'est la garde anti-republication, qui couvre
  aussi le cycle suspension → remise en ligne.
- `retryPromoShare` ne sert qu'au rattrapage d'un échec sur un réseau déjà
  choisi ; il ne peut pas élargir la diffusion.
- L'URL publique du site : `siteUrl()` lit le réglage `site_public_url` puis
  `NEXT_PUBLIC_SITE_URL` / `AUTH_URL` ; `publicBaseUrl()` y ajoute un repli sur
  l'origine de la requête (`src/lib/site-url.ts`, en-têtes `X-Forwarded-*`).
  L'adresse de retour OAuth et les liens des publications passent par
  `publicBaseUrl()` : la connexion marche sans réglage tant que l'admin passe
  par l'adresse publique.
- La CSP (`src/middleware.ts`) ne pose `upgrade-insecure-requests` qu'en HTTPS,
  sinon un test en HTTP par IP voit toutes ses navigations basculer vers un
  `https://` inexistant.
- Les URLs publiques des pages FB/LinkedIn sont des `site_settings`
  (`association_facebook`, `association_linkedin`), éditables dans Paramètres.

## Sécurité

- **Erreurs des server actions** : un `throw` dans une action est masqué par
  Next en production (message remplacé par un digest) et fait tomber la page
  sur « Application error ». Les échecs **attendus** — e-mail déjà pris, champ
  manquant — sont donc **renvoyés** (`ActionError = { error: string }`) et
  affichés par le formulaire, qui conserve la saisie. Le `throw` reste réservé
  aux violations d'accès, qui n'ont pas à s'expliquer à l'utilisateur.
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
- `npm test` verrouille ces protections (`tests/security.test.ts`) : XSS du
  journal, limitation des connexions, chiffrement des secrets, coordonnées du
  référent, **mots de passe temporaires jamais mis en file**, secrets de
  messagerie jamais renvoyés au navigateur, aucune copie cachée dans la chaîne
  d'envoi, rien rendu en HTML brut côté informations, et **le HTML de l'éditeur
  visuel qui ne quitte jamais la page** (formulaire à champ caché, collage passé
  par `DOMParser`, réinjection limitée à `richTextToEditorHtml`).

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
- **Mesure d'audience** : `src/lib/analytics.ts` est **pur**
  (`tests/analytics.test.ts`). `normalizeMeasurementId()` n'accepte qu'un
  identifiant GA4 (`G-…`, ni `UA-…` ni texte libre) : c'est la garde qui interdit
  d'injecter une chaîne arbitraire dans le script en ligne. Le réglage
  `google_analytics_id` (Paramètres) vide = **aucune balise posée**.
  `<Analytics>` (`src/components/Analytics.tsx`) rend les deux `<script>` avec le
  nonce de la CSP et n'agit que sur les pages publiques : `isTrackedPath()`
  écarte `PRIVATE_PATHS`, le chemin venant de l'en-tête `x-pathname` posé par le
  middleware (un layout ne connaît pas l'URL demandée). La CSP liste les hôtes
  `*.google-analytics.com` / `*.analytics.google.com` / `*.googletagmanager.com`
  en `connect-src` sans condition : elle est posée sur le runtime Edge, qui ne
  peut pas interroger la base. `script-src` n'a pas besoin d'eux —
  `'strict-dynamic'` couvre les scripts que gtag.js charge ensuite.
- **Search Console** : le réglage `google_site_verification` alimente
  `verification.google` dans `app/layout.tsx` (balise `<meta>`).
  `normalizeSiteVerification()` refuse la balise `<meta>` complète collée telle
  quelle. Le plan du site est déjà servi sur `/sitemap.xml` et annoncé dans
  `/robots.txt` : il n'y a aucun fichier à déposer, seulement l'URL à déclarer.
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

- **Référent** : `members.contact_first_name` / `contact_last_name` /
  `contact_phone` portent la personne à joindre et sa ligne directe. Ils sont
  **réservés aux visiteurs connectés** : aucune requête publique ne les lit
  (`tests/security.test.ts` le verrouille), seules `getMemberContacts()` /
  `getMemberContact()` les rapatrient, et uniquement après un `getSession()`
  positif. L'annuaire, les pages métier et la fiche affichent alors un bloc
  « Contact adhérent » ; hors session la requête n'est pas faite, donc rien
  n'est masqué en CSS, rien ne part dans le HTML ni dans le JSON-LD.
  `src/lib/member-contact.ts` est **pur** (`tests/member-contact.test.ts`) :
  `memberContact()` compose « Prénom Nom » et renvoie `null` s'il n'y a rien à
  montrer, `telHref()` fabrique le lien `tel:`. Les deux formulaires de fiche
  (espace adhérent et écran staff) partagent `MemberContactFields`.
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

`manageInformations` (admin + modérateur) ouvre la rédaction des informations ;
écrire à tous les adhérents reste sous `manageEmails` (admin seul), et la
configuration de la boîte mail sous `manageSettings`. Un modérateur publie donc
une information sans pouvoir la diffuser.

## Informations adhérents

Le fil de l'espace adhérent (`/backend/espace/informations`, onglet en tête)
porte ce que publie le bureau depuis `/backend/informations`. Deux tables :
`informations` (brouillon → publiée, `pinned`, `email_sent_at`) et
`information_reads`.

- **Texte riche** : `src/lib/rich-text.ts` est **pur** (`tests/rich-text.test.ts`)
  et analyse un sous-ensemble de Markdown — `**gras**`, `_italique_`, `- puce`,
  `1. numéro`, `[texte](https://…)`, `## sous-titre`. Trois rendus, un seul
  analyseur : `richTextNodes()` pour l'écran (des éléments React, jamais
  `dangerouslySetInnerHTML`), `richTextToEmailHtml()` pour le message,
  `richTextToEditorHtml()` pour remplir l'éditeur. Un lien hors `http`/`https`
  perd sa cible et ne garde que son libellé (`safeHttpUrl`, partagé avec
  `email-templates.ts`). L'italique s'écrit avec des tirets bas : `***x***`
  serait ambigu pour l'analyseur, `**_x_**` ne l'est pas ; `*étoiles*` reste
  accepté en lecture, et un tiret bas au milieu d'un mot
  (`fichier_de_sauvegarde`) n'ouvre rien.
- **La syntaxe ne se montre jamais** : `RichTextEditor` est un
  `contentEditable` avec une barre d'outils (G, I, Sous-titre, listes, lien).
  L'adhérent qui rédige voit du gras, pas des étoiles. Le balisage voyage dans
  un `<input type="hidden">`.
- **Le WYSIWYG porte sur la saisie, pas sur le stockage.** C'est l'invariant à
  ne pas casser : à chaque frappe, `src/lib/rich-text-dom.ts`
  (`serializeToRichText`, **pur**, `tests/rich-text-dom.test.ts`) retraverse le
  contenu édité et n'en garde que le gras, l'italique, les listes, les
  sous-titres et les liens. Le HTML de l'éditeur ne quitte jamais la page : la
  base ne reçoit que le format balisé, que le serveur ré-analyse avec le même
  analyseur qu'avant. Aucun assainisseur HTML n'est donc nécessaire.
  Le module lit aussi le gras/italique **codés en style CSS**
  (`<span style="font-weight:700">` de Google Docs), le style explicite
  l'emportant sur la balise — sans quoi le `<b style="font-weight:normal">` dont
  Docs enveloppe tout document mettrait le texte entier en gras.
- **Un collage est analysé par `DOMParser`**, jamais par une affectation
  d'`innerHTML` : le document produit est inerte, donc un `<img onerror>` collé
  ne s'exécute pas. Ce qui est réinjecté dans l'éditeur est du HTML **produit
  par nous** (`richTextToEditorHtml`), jamais celui du presse-papier.
- **Les sauts de ligne sont normalisés à l'enregistrement** : l'encodage des
  formulaires HTML convertit tout `\n` en `\r\n`, et le balisage stocké
  différerait sinon de celui que l'éditeur a produit (`saveInformation`).
- **Une seule image**, en couverture, jamais dans le corps : une data-URI
  recopiée dans chaque ligne de la file pèserait 3 Mo par destinataire. Elle est
  servie aux clients mail par `/api/informations/[id]/image`, qui ne répond que
  pour une information publiée — Gmail et Outlook suppriment les
  `<img src="data:">`.
- **Non-lues** : une ligne par lecture (`information_reads`) plutôt qu'une date
  « vu jusqu'ici ». C'est ce qui permet à la fois la pastille « Nouveau » par
  information et le « lue par 12 / 40 » du back-office. Le marquage passe par
  l'action `markInformationsRead`, appelée **après** affichage par
  `MarkInformationsRead` : la pastille de l'onglet et celle de la barre latérale
  sont calculées par deux composants serveur distincts, dont l'ordre de rendu
  n'est pas garanti, et se contrediraient sur la même page.
- **Une seule épinglée** : appliqué dans l'action (`unpinOthers`), pas par un
  index conditionnel que drizzle-kit ne génère pas.
- Les trois pages de l'espace passent `infoBadge` : sans cela le compteur
  disparaîtrait en changeant d'onglet.

## Envoi d'e-mails

`/backend/boite-mail` est le décalque de `/backend/reseaux` : mêmes règles,
mêmes garanties. Trois transports dans `mail_accounts`, un seul `is_active` —
pas de cascade automatique, la bascule est un choix visible.

- **Google → API Gmail** (`gmail.send`) et non SMTP+XOAUTH2 : celui-ci exigerait
  `https://mail.google.com/`, portée *restreinte* donc audit de sécurité.
  **Microsoft → API Graph** (`/me/sendMail`) : l'authentification basique SMTP
  est désactivée depuis 2024, y compris sur outlook.com et hotmail.com.
  **SMTP générique** via `nodemailer`, seule dépendance d'envoi.
- `mail_accounts.from_address` est **lu chez le fournisseur** au retour OAuth,
  jamais saisi : Gmail expédie comme l'utilisateur authentifié, Graph comme la
  boîte, et une adresse d'un autre domaine ferait tomber SPF/DKIM.
- Microsoft fait **tourner** le jeton de rafraîchissement à chaque
  renouvellement : `ensureAccessToken` réenregistre celui qui revient, sinon
  l'envoi meurt au bout d'une heure.
- `src/lib/mime.ts` est **pur** (`tests/mime.test.ts`) : extrait de
  `downloadOutlookDraft`, il sert le brouillon `.eml` **et** le champ `raw` de
  l'API Gmail. CRLF stricts, mots encodés RFC 2047 repliés sans couper une
  séquence UTF-8, CR/LF neutralisés dans les valeurs d'en-tête — un retour à la
  ligne dans un objet permettrait sinon d'injecter un `Bcc:`.
- `src/lib/mailer.ts` porte `sendNow()`, qui **ne lève jamais** : un envoi raté
  est un verdict, pas une exception.
- `src/lib/mail-outbox.ts` porte la file. Réclamation en
  `UPDATE … FOR UPDATE SKIP LOCKED` — `releaseDuePromotions` s'en passe parce
  que la transition de statut y fait office de verrou, pas ici. Faucheur des
  verrous laissés par un conteneur arrêté en plein envoi, donc livraison **au
  moins une fois**. ⚠ `db.execute` rend les colonnes **brutes** : il faut
  reconvertir `to_address` en `toAddress`, le constructeur de requêtes le fait,
  pas lui.
- **Les mots de passe temporaires ne passent jamais par la file** :
  `mail_messages.html` est stocké en base. Les cinq actions à identifiants
  appellent `sendNow` en ligne directe et journalisent une trace sans contenu
  (`logSentMail`). `tests/security.test.ts` le verrouille. L'envoi est un plus,
  jamais un point de rupture : `OneTimeCredentials` affiche le mot de passe quoi
  qu'il arrive.
- **Une ligne `mail_messages` par destinataire** : `to_address` est un `varchar`
  unique, la confidentialité d'une diffusion est structurelle.
- La configuration mail ne passe **surtout pas** par `site_settings` :
  `saveSiteSettings` boucle sur toutes les clés de `SITE_SETTING_DEFAULTS` et
  écrase d'une chaîne vide celles qu'aucun champ ne porte.
- La boucle d'envoi vit dans `src/instrumentation-node.ts`, à côté du libérateur
  de promotions, et `next.config.mjs` déclare `serverExternalPackages:
  ["nodemailer"]`. **Chaque boucle a son propre interrupteur** (`MAIL_WORKER`,
  `PROMO_SCHEDULER`) : couper l'un dans `instrumentation.ts` couperait l'autre,
  puisque le module entier ne serait plus chargé.
- `emailBrand(settings)` (`src/lib/site-settings.ts`) compose l'identité en pied
  de tous les messages : un seul endroit à changer.

## Docker notes

- Migrations + optional seed run on container start via `docker-entrypoint.sh`.
- `npm run build:scripts` bundles `migrate`/`seed` into `dist/*.cjs` so the runtime
  image needs no dev dependencies.
- The standalone server binds `HOSTNAME=0.0.0.0`, `PORT=3000`.

## Logo

`public/assets/logo.svg` is a brand-colour recreation; swap in the official asset
when available (referenced as `/assets/logo.svg`).
