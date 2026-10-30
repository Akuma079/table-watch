# Licensio — MVP

Suivi, audit et centralisation des licences (musiques, vidéos de stock, images) utilisées
dans les vidéos et podcasts, pour créateurs et agences.

**Stack** : Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS ·
PostgreSQL + Prisma 6 · Supabase Auth & Storage · BullMQ + Redis.

## Démarrage

```bash
cp .env.example .env          # renseigner Supabase
docker compose up -d          # PostgreSQL + Redis en local
npm install
npm run db:migrate            # applique prisma/migrations
npm run storage:setup         # crée le bucket privé des preuves de licence
npm run dev                   # http://localhost:3000
npm test                      # règles d'audit et d'abonnement
npm run worker                # dans un 2e terminal : traitement média / OCR (simulé)
```

`npm run storage:setup` crée le bucket privé `license-documents` (15 Mo max, PDF/PNG/JPEG/WebP).
Le bucket `project-media` (médias des projets) sera ajouté avec les projets.

### Configuration de Supabase Auth

Dans **Authentication → URL Configuration** :
- **Site URL** : l'URL de l'app (`http://localhost:3000` en local).
- **Redirect URLs** : ajouter `http://localhost:3000/auth/callback` (et l'URL de production).

La confirmation d'email est activée par défaut : le compte n'est utilisable qu'après le
clic sur le lien. Pour aller plus vite en développement, la désactiver dans
**Authentication → Providers → Email**.

> La migration initiale active la RLS sur toutes les tables, sans politique : l'API REST
> de Supabase (clé anon publique) n'y a donc aucun accès. L'app passe uniquement par
> Prisma côté serveur.

## Authentification & espaces de travail

| Route | Accès |
|---|---|
| `/login`, `/register`, `/forgot-password` | visiteurs (un utilisateur connecté est renvoyé au tableau de bord) |
| `/reset-password` | session de récupération ouverte par le lien reçu par email |
| `/auth/callback` | retour des liens Supabase (confirmation, réinitialisation) |
| `/invite/<jeton>` | public ; l'acceptation exige d'être connecté avec l'adresse invitée |
| `/dashboard`, `/projects`, `/vault`, `/settings/members`, `/workspaces/new` | connecté |

- **Double protection** : le middleware redirige vers `/login?next=…`, et chaque page
  appelle `requireWorkspace()` (`src/server/auth.ts`).
- **Première connexion** : création de la ligne `users` et d'un espace personnel
  (nom saisi à l'inscription, sinon « Espace de <nom> »).
- **Espace actif** : cookie `licensio_workspace`, vérifié contre les appartenances à chaque
  requête. Toute requête Prisma sur les données doit filtrer sur `workspace.id`.
- **Rôles** : Propriétaire > Administrateur > Membre > Lecture seule. Les administrateurs
  invitent et retirent des membres ; seul le propriétaire nomme un administrateur ou
  change les rôles.
- **Invitations** : lien valable 7 jours, jeton stocké haché (SHA-256). Aucun service
  d'email n'est branché pour l'instant : le lien s'affiche une fois pour être copié.

## Modèle de données (`prisma/schema.prisma`)

```
User ── Membership ── Workspace ─┬─ License ── LicenseDocument (PDF / facture, OCR)
              Invitation ────────┤     ▲
                                 └─ Project ─┬─ MediaFile (upload ou lien YouTube/Drive)
                                             ├─ ProjectAsset ──┘ (licence retenue)
                                             └─ AuditRun ── AuditFinding
```

- Tout appartient à un **Workspace** (espace de travail) ; chaque utilisateur a un espace personnel.
- **Project.usage** fixe le niveau exigé : `PERSONAL` → toute licence,
  `COMMERCIAL` → `COMMERCIAL` ou `EXTENDED`, `BROADCAST` → `EXTENDED`.
- Un **AuditRun** garde l'historique ; `Project.complianceStatus` porte le dernier
  résultat (vert / rouge / en attente) affiché au tableau de bord.
- Le **Passeport de Droits** est servi publiquement via `Project.passportToken`.

## Coffre-fort & stockage des preuves

1. Le navigateur demande une URL d'envoi signée (`prepareDocumentUpload`) : le serveur
   vérifie le rôle (Membre minimum), le type et la taille, et choisit le chemin
   `<workspaceId>/<uuid>/<fichier>`.
2. Le fichier part **directement** du navigateur vers Supabase Storage (PUT, barre de
   progression), sans passer par le serveur Next : aucune limite de taille de requête,
   y compris sur Vercel.
3. À l'enregistrement (`createLicense`), le serveur vérifie que chaque chemin appartient à
   l'espace actif et relit taille et type réels dans Storage avant d'écrire en base.
4. Aperçu et téléchargement passent par `/api/documents/<id>` : contrôle d'appartenance à
   l'espace, puis redirection vers une URL signée valable 60 secondes. Le bucket reste privé.

Limites actuelles :
- un fichier envoyé puis abandonné (formulaire jamais validé) reste dans le bucket ; un
  nettoyage périodique des fichiers non rattachés est à prévoir ;
- une licence ne peut pas encore être modifiée (seulement complétée par des preuves) ;
- l'OCR (simulé) n'est déclenché que si `PROCESSING_QUEUE_ENABLED="true"`.

## Moteur d'audit

`checkCompliance(projectId, workspaceId)` (`src/server/services/compliance.ts`) compare chaque
ressource déclarée du projet aux licences du coffre-fort du même espace, enregistre un
`AuditRun` (historique, score, constats) et met à jour le statut du projet. Les règles sont
des fonctions pures dans `compliance-rules.ts`, couvertes par `npm test`.

**Correspondance** (par ordre de priorité) : licence associée à la main → même lien de
ressource → même titre normalisé (accents, casse et ponctuation ignorés ; « titre artiste »
accepté). À plateforme égale de préférence ; parmi plusieurs licences, la meilleure est retenue.

| Constat | Gravité |
|---|---|
| Aucune licence trouvée | 🔴 |
| Licence personnelle sur projet commercial / diffusion | 🔴 |
| Licence commerciale sur projet diffusion (TV, cinéma, pub payante) | 🔴 |
| Licence expirée (à la date de diffusion si renseignée, sinon aujourd'hui) ou révoquée | 🔴 |
| Expire dans les 30 jours, projet pas encore diffusé | 🟡 |
| Utilité restreinte (conditions à relire), aucune preuve jointe, plateforme différente | 🟡 |

Statut du projet : rouge si une ressource est rouge, sinon orange si une est orange, sinon
vert. Score = part des ressources couvertes (une ressource orange compte pour moitié).

Recalcul : à chaque modification du projet, à chaque ajout/suppression de licence ou de
preuve (tous les projets de l'espace), et à l'ouverture d'un projet audité un jour précédent
(les expirations dépendent de la date).

Hypothèse à valider : une licence valable à la date de diffusion couvre la vidéo même si elle
expire ensuite (cas d'Envato Elements, Artlist…). Certaines licences exigent au contraire
d'être actives pendant toute l'exploitation : à affiner par plateforme.

## Passeport de Droits

Certificat public d'un projet, à transmettre au client final.

- **Lien** : `/passport/<jeton>` (192 bits aléatoires), sans connexion. Créé et copié en un
  clic depuis la page du projet (« Copier le lien public client »), désactivable, et
  régénérable (l'ancien lien cesse aussitôt de fonctionner). Jeton invalide ou lien
  désactivé : 404.
- **PDF** : `/passport/<jeton>/pdf`, généré par `@react-pdf/renderer` (A4, police
  Helvetica intégrée), avec un QR code vers la version en ligne.
- **Contenu** : projet, client, espace émetteur, usage, date de diffusion, date et n° de
  vérification, ressources avec plateforme, type et identifiant de licence, dates de validité.
  Jamais exposés : factures, notes internes, liens sources.
- **Intégrité** : le badge « Vérifié & conforme » n'apparaît que si le projet est vert ;
  sinon « Conforme, avec réserves » ou « Non conforme », avec les constats. Un audit d'un
  jour précédent est recalculé à l'ouverture du passeport (une licence expirée depuis ne
  peut pas rester affichée comme valide).
- **Confidentialité** : `noindex`, `no-referrer` (le jeton ne fuit pas vers d'autres sites).

## Abonnements (Stripe)

| | Creator | Agence |
|---|---|---|
| Prix | gratuit | 79 €/mois (Stripe) |
| Projets / licences | 5 / 50 | illimités |
| Utilisateurs | 1 | illimités |
| Passeport de Droits | — | ✓, en marque blanche |

Forfaits définis dans `src/lib/plans.ts` (source unique : limites, fonctionnalités, page
`/pricing`). L'abonnement est porté par l'**espace de travail**, pas par l'utilisateur.

**Mise en place**
1. Dans Stripe, créer un produit « Licensio Agence » avec un prix mensuel de 79 € ; mettre
   son ID dans `STRIPE_PRICE_AGENCY`, et la clé secrète dans `STRIPE_SECRET_KEY`.
2. Créer un webhook vers `https://<app>/api/stripe/webhook` avec les événements
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` ; mettre son secret
   dans `STRIPE_WEBHOOK_SECRET`. En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
3. Activer le portail client (Stripe → Paramètres → Billing → Customer portal) :
   moyen de paiement, factures, résiliation.

Sans variables Stripe, l'app fonctionne entièrement en plan Creator.

**Fonctionnement**
- `/pricing` (public) → Checkout → retour par `/api/billing/return`, qui synchronise
  l'abonnement avant l'affichage. Le webhook reste la source de vérité.
- Chaque événement relit l'abonnement chez Stripe (jamais le contenu de l'événement, qui
  peut arriver dans le désordre). Statuts donnant droit au plan Agence : `active`,
  `trialing`, `past_due` (délai de relance de Stripe). Un événement tardif d'un ancien
  abonnement ne rétrograde pas l'espace.
- Limites appliquées **côté serveur** dans chaque action (création de projet, de licence,
  invitation, acceptation d'invitation, activation du passeport) ; l'interface ne fait
  qu'informer.
- Retour au plan Creator : rien n'est supprimé ; création bloquée au-delà des limites,
  liens de passeport inactifs jusqu'au retour au plan Agence.

## Arborescence

✅ = en place · ⏳ = étape suivante

```
licensio/
├─ prisma/
│  ├─ schema.prisma                    ✅
│  ├─ migrations/                      ✅ migration initiale (+ RLS)
│  └─ seed.ts                          ⏳ données de démo
├─ src/
│  ├─ middleware.ts                    ✅ session Supabase + protection des routes
│  ├─ app/
│  │  ├─ layout.tsx, page.tsx          ✅
│  │  ├─ (auth)/login, register, forgot-password, reset-password ✅
│  │  ├─ auth/callback/route.ts        ✅ retour des liens email
│  │  ├─ invite/[token]/page.tsx       ✅ acceptation d'invitation
│  │  ├─ (onboarding)/workspaces/new   ✅ création d'espace
│  │  ├─ (app)/layout.tsx              ✅ barre latérale, sélecteur d'espace
│  │  ├─ (app)/dashboard/page.tsx      ✅ compteurs (version simple)
│  │  ├─ (app)/settings/members        ✅ membres, rôles, invitations
│  │  ├─ (app)/projects/page.tsx       ✅ liste triée par gravité, score
│  │  ├─ (app)/projects/new/page.tsx   ✅ création + ressources (saisie ou liste collée)
│  │  ├─ (app)/projects/[id]/page.tsx  ✅ rapport d'audit, recommandations, association manuelle
│  │  ├─ (app)/vault/page.tsx          ✅ liste, recherche, filtres, aperçu, téléchargement
│  │  ├─ (app)/vault/new/page.tsx      ✅ formulaire + glisser-déposer
│  │  ├─ api/documents/[id]/route.ts   ✅ aperçu / téléchargement (URL signée)
│  │  ├─ passport/[token]/page.tsx     ✅ Passeport de Droits public
│  │  ├─ passport/[token]/pdf/route.tsx ✅ export PDF
│  │  ├─ pricing/page.tsx              ✅ tarifs (public)
│  │  ├─ (app)/settings/billing        ✅ mon abonnement, usage, marque blanche
│  │  ├─ api/stripe/webhook/route.ts   ✅ webhook Stripe signé
│  │  └─ api/billing/return/route.ts   ✅ retour de Checkout
│  ├─ components/                      ✅ ui/, auth/, app/, workspace/, vault/, projects/, passport/
│  ├─ lib/
│  │  ├─ env.ts, prisma.ts, redirect.ts, slug.ts, labels.ts, cn.ts ✅
│  │  ├─ documents.ts                  ✅ types et tailles acceptés
│  │  ├─ plans.ts                      ✅ forfaits, limites, fonctionnalités
│  │  ├─ asset-parse.ts                ✅ analyse des listes collées (liens Artlist, Envato…)
│  │  └─ supabase/{client,server,middleware}.ts ✅
│  └─ server/
│     ├─ auth.ts                       ✅ utilisateur, espace actif, rôles
│     ├─ invitations.ts                ✅ jetons d'invitation
│     ├─ actions/auth.ts               ✅ connexion, inscription, mot de passe
│     ├─ actions/workspaces.ts         ✅ espaces, invitations, membres
│     ├─ storage.ts                    ✅ URLs signées, vérification, suppression
│     ├─ actions/licenses.ts           ✅ envoi, création, suppression de licences
│     ├─ actions/projects.ts           ✅ projet, ressources, association, audit
│     ├─ services/normalize.ts         ✅ normalisation des noms
│     ├─ services/compliance-rules.ts  ✅ règles d'audit (pures, testées)
│     ├─ services/compliance.ts        ✅ checkCompliance (chargement + enregistrement)
│     ├─ passport/data.ts              ✅ données publiques du passeport, jetons
│     ├─ billing/subscription.ts       ✅ abonnement Stripe → plan (pur, testé)
│     ├─ billing/stripe.ts             ✅ client Stripe, synchronisation
│     ├─ actions/billing.ts            ✅ Checkout, portail client, marque blanche
│     ├─ passport/PassportDocument.tsx ✅ mise en page du PDF
│     ├─ processing/fingerprint.ts     ✅ placeholder empreinte audio
│     ├─ processing/ocr.ts             ✅ placeholder OCR
│     └─ queue/{connection,queues,worker}.ts ✅ BullMQ
├─ scripts/setup-storage.ts           ✅ création du bucket
├─ docker-compose.yml                  ✅
└─ .env.example                        ✅
```
