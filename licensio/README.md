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
npm run db:migrate -- --name init
npm run dev                   # http://localhost:3000
npm run worker                # dans un 2e terminal : traitement média / OCR (simulé)
```

Dans Supabase, créer deux buckets **privés** : `license-documents` et `project-media`.

## Modèle de données (`prisma/schema.prisma`)

```
User ─┬─ Membership ─── Team ─┬─ License ── LicenseDocument (PDF / facture, OCR)
      │                       │     ▲
      │                       └─ Project ─┬─ MediaFile (upload ou lien YouTube/Drive)
      │                                   ├─ ProjectAsset ──┘ (licence retenue)
      │                                   └─ AuditRun ── AuditFinding
```

- Tout appartient à une **Team** ; chaque utilisateur a une équipe personnelle.
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
│  └─ seed.ts                          ⏳ données de démo
├─ src/
│  ├─ middleware.ts                    ✅ session Supabase + protection des routes
│  ├─ app/
│  │  ├─ layout.tsx, page.tsx          ✅
│  │  ├─ (auth)/login/page.tsx         ⏳
│  │  ├─ auth/callback/route.ts        ⏳ retour OAuth / lien magique
│  │  ├─ (app)/layout.tsx              ⏳ barre latérale, sélecteur d'équipe
│  │  ├─ (app)/dashboard/page.tsx      ⏳ projets + statut de conformité
│  │  ├─ (app)/projects/new/page.tsx   ⏳ création + import média / lien
│  │  ├─ (app)/projects/[id]/page.tsx  ⏳ ressources, alertes d'audit
│  │  ├─ (app)/vault/page.tsx          ⏳ coffre-fort des licences
│  │  ├─ (app)/vault/new/page.tsx      ⏳ formulaire licence + PDF
│  │  ├─ passport/[token]/page.tsx     ⏳ Passeport de Droits public
│  │  └─ passport/[token]/pdf/route.ts ⏳ export PDF
│  ├─ components/                      ⏳ ui/ (Button, Badge, Input…), StatusBadge…
│  ├─ lib/
│  │  ├─ env.ts                        ✅ validation des variables (zod)
│  │  ├─ prisma.ts                     ✅
│  │  └─ supabase/{client,server,middleware}.ts ✅
│  └─ server/
│     ├─ auth.ts                       ⏳ utilisateur courant + équipe active
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
