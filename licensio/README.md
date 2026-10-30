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
SEED_EMAIL=vous@exemple.com npm run db:seed   # après inscription : espace « Studio Démo »
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
  renomment l'espace, invitent et retirent des membres ; seul le propriétaire nomme un
  administrateur, change les rôles, **transfère la propriété** ou **supprime l'espace**
  (page « Paramètres »). Tout membre voit l'équipe (page « Membres ») et peut quitter
  l'espace ; le propriétaire ne le peut pas (il transfère d'abord la propriété).
- **Un seul espace gratuit possédé par compte** : sinon la limite du plan Gratuit se
  contournerait en multipliant les espaces. Les espaces payants et ceux où l'on est invité
  ne comptent pas. Vérifié côté serveur (`createWorkspace`).
- **Invitations** : lien valable 7 jours, jeton stocké haché (SHA-256). Envoyé par email
  via [Resend](https://resend.com) si `RESEND_API_KEY` et `EMAIL_FROM` sont renseignés
  (domaine d'envoi à vérifier dans Resend) ; le lien reste aussi affiché une fois pour être
  copié. Sans Resend, ou si l'envoi échoue, l'invitation est créée et le lien est à
  transmettre à la main. La liste des invitations indique « email envoyé » ou « lien à transmettre ».

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

- **Modification** : `/vault/<id>/edit` (titre, type, dates, case « Doit rester active
  pendant l'exploitation »…) ; les projets de l'espace sont ré-audités à l'enregistrement.
  Les preuves s'ajoutent depuis le coffre-fort.
- **Fichiers orphelins** (envoyés puis formulaire abandonné) : supprimés après 24 h par
  `GET /api/cron/storage-cleanup` (protégée par `Authorization: Bearer $CRON_SECRET`),
  planifiée chaque nuit dans `vercel.json`. Hors Vercel : appeler cette route depuis un cron,
  ou lancer `npm run storage:cleanup` (`-- --dry-run` pour lister sans supprimer).
- L'OCR reste désactivé (simulé, seulement si `PROCESSING_QUEUE_ENABLED="true"`).

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
| Licence expirée (à la date de diffusion si renseignée, sinon aujourd'hui — toujours aujourd'hui si « doit rester active pendant l'exploitation ») ou révoquée | 🔴 |
| Expire dans les 30 jours, projet pas encore diffusé | 🟡 |
| Utilité restreinte, tant qu'un membre n'a pas cliqué « Conditions vérifiées pour ce projet » | 🟡 |
| Aucune preuve jointe, plateforme différente | 🟡 |

Statut du projet : rouge si une ressource est rouge, sinon orange si une est orange, sinon
vert. Score = part des ressources couvertes (une ressource orange compte pour moitié).

Recalcul : à chaque modification du projet ; à chaque ajout, modification ou suppression
de licence ou de preuve, **seulement pour les projets concernés** (ressources associées à la
licence, ou de même titre ou même lien : `projectsAffectedBy`), trois à la fois ; et à
l'ouverture d'un projet audité un jour précédent (les expirations dépendent de la date).
Mesuré sur un espace de 300 projets × 5 ressources : 4,7 s → 0,04 s par licence modifiée.

**Expiration** : par défaut, une licence valable à la date de diffusion couvre la vidéo même
si elle expire ensuite (Envato Elements, Artlist…). Pour une licence qui doit rester active
pendant toute l'exploitation, cocher la case correspondante sur la licence : l'expiration
est alors toujours vérifiée à la date du jour.

**Utilité restreinte** : la validation « Conditions vérifiées pour ce projet » est tracée
(qui, quand) et ne vaut que pour la licence associée à ce moment-là ; si une autre licence
est retenue, la ressource repasse en orange. Elle est annulable.

**Titres proches** : pour une ressource sans licence, des licences au titre voisin
(« Golden Hour (Extended Mix) » ↔ « Golden Hour », fautes de frappe) sont proposées ;
« Associer » les rattache en un clic. Rien n'est associé automatiquement.

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
  Le titre affiché est celui déclaré dans le projet, suivi de « Licence : <titre> » quand
  la licence porte un autre titre.
  Jamais exposés : factures, notes internes, liens sources.
- **Intégrité** : le badge « Vérifié & conforme » n'apparaît que si le projet est vert ;
  sinon « Conforme, avec réserves » ou « Non conforme », avec les constats. Un audit d'un
  jour précédent est recalculé à l'ouverture du passeport (une licence expirée depuis ne
  peut pas rester affichée comme valide).
- **Confidentialité** : `noindex`, `no-referrer` (le jeton ne fuit pas vers d'autres sites).

## Abonnements (Stripe)

| | Gratuit | Creator | Agence |
|---|---|---|---|
| Prix TTC | 0 € | 19 €/mois | 79 €/mois |
| Projets / licences | 1 / 10 | 5 / 50 | illimités |
| Utilisateurs | 1 | 1 | illimités, avec rôles |
| Passeport de Droits | — | ✓ (marque Licensio) | ✓, en marque blanche |

Forfaits définis dans `src/lib/plans.ts` (source unique : limites, fonctionnalités, page
`/pricing`). L'abonnement est porté par l'**espace de travail**, pas par l'utilisateur.
Tout nouvel espace démarre en plan Gratuit (un seul espace gratuit possédé par compte).

**Mise en place**
1. Dans Stripe, créer deux produits avec un prix mensuel **TTC** : « Licensio Creator »
   (19 €) et « Licensio Agence » (79 €), chacun avec `tax_behavior = inclusive`
   (« Le prix inclut les taxes »). Mettre leurs ID dans `STRIPE_PRICE_CREATOR` et
   `STRIPE_PRICE_AGENCY`, et la clé secrète dans `STRIPE_SECRET_KEY`.
2. TVA : activer Stripe Tax (adresse de l'entreprise, enregistrements TVA), puis
   `STRIPE_TAX_ENABLED="true"`. Checkout collecte alors l'adresse de facturation et le
   n° de TVA intracommunautaire ; le montant payé reste 19 € / 79 €, Stripe en extrait la TVA.
3. Créer un webhook vers `https://<app>/api/stripe/webhook` avec les événements
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` ; mettre son secret
   dans `STRIPE_WEBHOOK_SECRET`. En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Activer le portail client (Stripe → Paramètres → Billing → Customer portal) :
   moyen de paiement, factures, résiliation.

Sans variables Stripe, l'app fonctionne entièrement en plan Gratuit.

**Fonctionnement**
- `/pricing` (public) → Checkout → retour par `/api/billing/return`, qui synchronise
  l'abonnement avant l'affichage. Le webhook reste la source de vérité.
- Changement de forfait (Creator ↔ Agence) : le prix de l'abonnement existant est remplacé,
  au prorata, sans nouveau Checkout.
- Chaque événement relit l'abonnement chez Stripe (jamais le contenu de l'événement, qui
  peut arriver dans le désordre). Statuts donnant droit au forfait payé : `active`,
  `trialing`, `past_due` (délai de relance de Stripe). Un événement tardif d'un ancien
  abonnement ne rétrograde pas l'espace.
- Limites appliquées **côté serveur** dans chaque action (création de projet, de licence,
  invitation, acceptation d'invitation, activation du passeport) ; l'interface ne fait
  qu'informer.
- Passage à un forfait sans Passeport (résiliation, paiement définitivement échoué) : rien
  n'est supprimé ; les liens de passeport déjà partagés restent consultables **30 jours**
  (`passportGraceUntil`, affiché sur « Mon abonnement »), puis cessent de répondre. Aucun
  nouveau lien ne peut être créé pendant ce délai. Reprendre Creator ou Agence lève le délai.

## Variables d'environnement facultatives

| Variable | Rôle |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Emails d'invitation (ex. `Licensio <invitations@votre-domaine.com>`) |
| `CRON_SECRET` | Protège `/api/cron/storage-cleanup` (Vercel l'envoie automatiquement) |
| `STRIPE_*` | Abonnements, voir ci-dessus |
| `PROCESSING_QUEUE_ENABLED` | File BullMQ (traitement média / OCR simulés) |

## RGPD

- **Suppression d'un espace** (propriétaire, confirmée en recopiant son nom) : abonnement
  Stripe résilié immédiatement, licences, preuves (base et stockage), projets, audits et
  invitations effacés ; les liens de passeport cessent de fonctionner. Le client Stripe et
  ses factures restent chez Stripe (obligations comptables).
- **Transfert de propriété** : le propriétaire cède l'espace à un membre et en reste
  administrateur.
- **Suppression du compte** (« Mon compte », confirmée en recopiant son email) : refusée tant
  que l'utilisateur possède un espace partagé avec d'autres membres (transfert ou suppression
  d'abord). Les espaces où il est seul sont supprimés comme ci-dessus ; le compte Supabase
  puis le profil sont effacés. Ce qu'il a créé dans les espaces partagés reste à l'équipe,
  sans lien vers lui (`SetNull`).
- **Rectification** : nom modifiable dans « Mon compte ».

## Production

- **En-têtes de sécurité** (`next.config.ts`) : HSTS, `X-Frame-Options: SAMEORIGIN` (l'aperçu
  des preuves PDF utilise un iframe de l'application), `nosniff`, `Referrer-Policy`
  (`no-referrer` sur les passeports), `Permissions-Policy` ; en-tête `X-Powered-By` retiré.
- **Erreurs** : `error.tsx` (dans l'application, la barre latérale reste affichée),
  `global-error.tsx` et une page 404. En production, le message technique est masqué ;
  la référence affichée (digest) se retrouve dans les journaux du serveur.
- **Isolation des espaces** : chaque page et action filtre sur l'espace actif
  (`requireWorkspace`), dont l'appartenance est revérifiée à chaque requête ; un élément
  d'un autre espace renvoie « Page introuvable ». Les preuves passent par
  `/api/documents/<id>` (contrôle d'appartenance, puis URL signée de 60 s).
- **Formulaires** : boutons désactivés pendant l'envoi (pas de double soumission),
  confirmation avant toute suppression, message de confirmation après.
- Pas de `loading.tsx` global : avec Next 15, il rendait aléatoire le rafraîchissement de
  la page après une action serveur (constaté en test), et masquait le statut HTTP 404.

## Vérification

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

## Données de démonstration

Après inscription, `SEED_EMAIL=vous@exemple.com npm run db:seed` crée l'espace « Studio Démo »
(plan Creator) : 5 licences et 2 projets audités montrant les cas vert, orange (licence
restreinte, expiration proche) et rouge (licence manquante, licence personnelle, titre proche
à associer). Relancer le script remplace cet espace.

## Arborescence

✅ = en place

```
licensio/
├─ prisma/
│  ├─ schema.prisma                    ✅
│  ├─ migrations/                      ✅ migration initiale (+ RLS)
│  └─ seed.ts                          ✅ données de démo (npm run db:seed)
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
│  │  ├─ (app)/vault/[id]/edit         ✅ modification d'une licence
│  │  ├─ api/cron/storage-cleanup      ✅ suppression des fichiers orphelins (> 24 h)
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
│     ├─ storage-cleanup.ts            ✅ nettoyage des fichiers orphelins
│     ├─ email.ts                      ✅ emails d'invitation (Resend)
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
├─ scripts/cleanup-storage.ts         ✅ nettoyage manuel (npm run storage:cleanup)
├─ vercel.json                        ✅ tâche planifiée quotidienne
├─ docker-compose.yml                  ✅
└─ .env.example                        ✅
```
