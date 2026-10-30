// Données de démonstration : un espace « Studio Démo » avec des licences et deux projets
// audités (vert, orange, rouge), rattaché à un compte existant.
// Usage : créez d'abord un compte sur /register, puis
//   SEED_EMAIL=vous@exemple.com npm run db:seed
// Relancer le script remplace l'espace de démo précédent de ce compte.
import { PrismaClient, type Prisma } from "@prisma/client";
import { uniqueSlug } from "../src/lib/slug";
import { checkCompliance } from "../src/server/services/compliance";
import { normalizeAssetName } from "../src/server/services/normalize";

const DEMO_NAME = "Studio Démo";
const prisma = new PrismaClient();
const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

type LicenseSeed = Omit<Prisma.LicenseCreateManyInput, "workspaceId" | "normalizedName">;
const LICENSES: LicenseSeed[] = [
  { assetName: "Golden Hour", author: "Ikson", assetType: "MUSIC", platform: "ARTLIST", licenseType: "COMMERCIAL", licenseKey: "ART-2026-48213", purchaseDate: day(-120) },
  { assetName: "Midnight City Drive", author: "Nomyn", assetType: "MUSIC", platform: "EPIDEMIC_SOUND", licenseType: "COMMERCIAL", licenseKey: "EPI-77120", purchaseDate: day(-60), expiresAt: day(20), mustStayActive: true },
  { assetName: "Aerial Coastline 4K", assetType: "STOCK_VIDEO", platform: "ARTGRID", licenseType: "EXTENDED", licenseKey: "AG-551902", purchaseDate: day(-200) },
  { assetName: "Whoosh Transition Pack", assetType: "SFX", platform: "ENVATO_ELEMENTS", licenseType: "RESTRICTED", licenseKey: "ENV-PRJ-3381", purchaseDate: day(-30), notes: "Licence projet unique (Envato)." },
  { assetName: "City Lights Timelapse", assetType: "STOCK_VIDEO", platform: "ADOBE_STOCK", licenseType: "PERSONAL", licenseKey: "AS-90012", purchaseDate: day(-400) },
];

async function main() {
  const email = (process.env.SEED_EMAIL || process.argv[2] || "").trim().toLowerCase();
  if (!email) throw new Error("Indiquez le compte : SEED_EMAIL=vous@exemple.com npm run db:seed");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Aucun compte « ${email} ». Inscrivez-vous d'abord sur /register.`);

  await prisma.workspace.deleteMany({ where: { name: DEMO_NAME, members: { some: { userId: user.id, role: "OWNER" } } } });
  const workspace = await prisma.workspace.create({
    data: {
      name: DEMO_NAME,
      slug: uniqueSlug(DEMO_NAME),
      // Plan Creator offert pour la démo, afin de montrer le Passeport de Droits.
      plan: "CREATOR",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  for (const l of LICENSES) {
    await prisma.license.create({
      data: {
        ...l,
        workspaceId: workspace.id,
        createdById: user.id,
        normalizedName: normalizeAssetName(l.assetName),
        // Une preuve fictive sur les licences « propres » (aucun fichier réel dans le bucket).
        documents:
          l.licenseType === "COMMERCIAL" || l.licenseType === "EXTENDED"
            ? {
                create: {
                  kind: "LICENSE_CERTIFICATE",
                  fileName: `certificat-${l.licenseKey}.pdf`,
                  storagePath: `${workspace.id}/demo-${l.licenseKey}/certificat.pdf`,
                  mimeType: "application/pdf",
                  sizeBytes: 48_000,
                  uploadedById: user.id,
                },
              }
            : undefined,
      },
    });
  }

  const asset = (assetName: string, extra: Partial<Prisma.ProjectAssetCreateWithoutProjectInput> = {}) => ({
    assetName,
    normalizedName: normalizeAssetName(assetName),
    ...extra,
  });
  const projects = [
    await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        createdById: user.id,
        name: "Spot Printemps — Maison Clémence",
        clientName: "Maison Clémence",
        usage: "COMMERCIAL",
        publishedAt: day(10),
        assets: {
          create: [
            asset("Golden Hour", { author: "Ikson", platform: "ARTLIST" }),
            asset("Aerial Coastline 4K", { assetType: "STOCK_VIDEO", platform: "ARTGRID" }),
            asset("Midnight City Drive", { author: "Nomyn", platform: "EPIDEMIC_SOUND" }),
            asset("Whoosh Transition Pack", { assetType: "SFX", platform: "ENVATO_ELEMENTS" }),
          ],
        },
      },
    }),
    await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        createdById: user.id,
        name: "Aftermovie Festival Lumen",
        clientName: "Festival Lumen",
        usage: "COMMERCIAL",
        publishedAt: day(-15),
        assets: {
          create: [
            asset("Golden Hour (Extended Mix)", { author: "Ikson", platform: "ARTLIST" }),
            asset("City Lights Timelapse", { assetType: "STOCK_VIDEO", platform: "ADOBE_STOCK" }),
            asset("Neon Pulse", { author: "Inconnu" }),
          ],
        },
      },
    }),
  ];

  for (const p of projects) {
    const r = await checkCompliance(p.id, workspace.id);
    console.log(`  ${p.name} : ${r.status} (${r.score ?? "—"} %)`);
  }
  console.log(`Espace « ${DEMO_NAME} » prêt pour ${email}. Choisissez-le dans le sélecteur d'espace.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
