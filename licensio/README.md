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
npm run dev                   # http://localhost:3000
npm run worker                # dans un 2e terminal : traitement média / OCR (simulé)
```

Dans Supabase, créer deux buckets **privés** : `license-documents` et `project-media`.

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
│  │  ├─ (app)/projects/page.tsx       ✅ liste simple · ⏳ création, détail, audit
│  │  ├─ (app)/vault/page.tsx          ✅ liste simple · ⏳ formulaire licence + PDF
│  │  ├─ passport/[token]/page.tsx     ⏳ Passeport de Droits public
│  │  └─ passport/[token]/pdf/route.ts ⏳ export PDF
│  ├─ components/                      ✅ ui/, auth/, app/, workspace/
│  ├─ lib/
│  │  ├─ env.ts, prisma.ts, redirect.ts, slug.ts, labels.ts, cn.ts ✅
│  │  └─ supabase/{client,server,middleware}.ts ✅
│  └─ server/
│     ├─ auth.ts                       ✅ utilisateur, espace actif, rôles
│     ├─ invitations.ts                ✅ jetons d'invitation
│     ├─ actions/auth.ts               ✅ connexion, inscription, mot de passe
│     ├─ actions/workspaces.ts         ✅ espaces, invitations, membres
│     ├─ actions/licenses.ts           ⏳ ajout licence + upload Storage
│     ├─ actions/projects.ts           ⏳ projet, médias, ressources déclarées
│     ├─ services/normalize.ts         ⏳ normalisation des noms
│     ├─ services/compliance.ts        ⏳ correspondance + contrôle de conformité
│     ├─ processing/fingerprint.ts     ✅ placeholder empreinte audio
│     ├─ processing/ocr.ts             ✅ placeholder OCR
│     └─ queue/{connection,queues,worker}.ts ✅ BullMQ
├─ docker-compose.yml                  ✅
└─ .env.example                        ✅
```
