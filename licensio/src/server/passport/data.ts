import "server-only";
import { randomBytes } from "node:crypto";
import type { AssetType, ComplianceStatus, FindingSeverity, LicenseType, ProjectUsage } from "@prisma/client";
import { serverEnv } from "@/lib/env";
import { PLATFORM_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { auditIsStale, checkCompliance } from "@/server/services/compliance";

// Jeton du lien public : 192 bits aléatoires, impossible à deviner. Il est conservé en
// clair (contrairement aux invitations) pour que l'équipe puisse recopier le lien.
export function newPassportToken() {
  return randomBytes(24).toString("base64url");
}

export function passportUrl(token: string) {
  return `${serverEnv().NEXT_PUBLIC_APP_URL}/passport/${token}`;
}

export type PassportAsset = {
  name: string;
  author: string | null;
  assetType: AssetType;
  platform: string | null;
  licenseType: LicenseType | null;
  licenseKey: string | null;
  purchaseDate: Date | null;
  expiresAt: Date | null;
  severity: FindingSeverity;
  // Constats non bloquants ou bloquants, affichés tels quels (jamais les notes internes).
  notes: string[];
};

export type Passport = {
  token: string;
  url: string;
  projectName: string;
  clientName: string | null;
  issuer: string;
  usage: ProjectUsage;
  publishedAt: Date | null;
  status: ComplianceStatus;
  verifiedAt: Date | null;
  verificationId: string | null;
  score: number | null;
  assets: PassportAsset[];
};

const SEVERITY_ORDER: Record<FindingSeverity, number> = { ERROR: 0, WARNING: 1, OK: 2 };

// Données publiques d'un passeport, ou null si le lien est inconnu ou désactivé.
// N'expose ni les preuves (factures), ni les notes internes, ni les liens sources.
export async function loadPassport(token: string): Promise<Passport | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const head = await prisma.project.findUnique({
    where: { passportToken: token },
    select: { id: true, workspaceId: true, passportEnabled: true, lastAuditAt: true },
  });
  if (!head?.passportEnabled) return null;

  // Un passeport ne doit jamais présenter une licence expirée depuis comme valide.
  if (auditIsStale(head.lastAuditAt)) await checkCompliance(head.id, head.workspaceId);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: head.id },
    include: {
      workspace: { select: { name: true } },
      assets: {
        orderBy: { createdAt: "asc" },
        include: {
          license: {
            select: {
              platform: true,
              platformOther: true,
              licenseType: true,
              licenseKey: true,
              purchaseDate: true,
              expiresAt: true,
            },
          },
        },
      },
      audits: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, score: true, finishedAt: true, findings: { select: { projectAssetId: true, severity: true, message: true, code: true } } },
      },
    },
  });

  const audit = project.audits[0];
  const assets = project.assets.map((a): PassportAsset => {
    const findings = audit?.findings.filter((f) => f.projectAssetId === a.id) ?? [];
    const severity = findings.reduce<FindingSeverity>(
      (acc, f) => (SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[acc] ? f.severity : acc),
      "OK",
    );
    const l = a.license;
    return {
      name: a.assetName,
      author: a.author,
      assetType: a.assetType,
      platform: l ? (l.platform === "OTHER" ? l.platformOther || "Autre" : PLATFORM_LABELS[l.platform]) : a.platform ? PLATFORM_LABELS[a.platform] : null,
      licenseType: l?.licenseType ?? null,
      licenseKey: l?.licenseKey ?? null,
      purchaseDate: l?.purchaseDate ?? null,
      expiresAt: l?.expiresAt ?? null,
      severity,
      notes: findings.filter((f) => f.severity !== "OK").map((f) => f.message),
    };
  });
  assets.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);

  return {
    token,
    url: passportUrl(token),
    projectName: project.name,
    clientName: project.clientName,
    issuer: project.workspace.name,
    usage: project.usage,
    publishedAt: project.publishedAt,
    status: project.complianceStatus,
    verifiedAt: audit?.finishedAt ?? project.lastAuditAt,
    verificationId: audit ? audit.id.slice(-10).toUpperCase() : null,
    score: audit?.score ?? null,
    assets,
  };
}

// Titre et badge selon le statut : le badge « vérifié & conforme » n'apparaît que si
// toutes les ressources sont couvertes sans réserve.
export const PASSPORT_VERDICT: Record<ComplianceStatus, { title: string; subtitle: string }> = {
  COMPLIANT: {
    title: "Vérifié & conforme",
    subtitle: "Chaque ressource utilisée est couverte par une licence valide et adaptée à l'usage du projet.",
  },
  WARNING: {
    title: "Conforme, avec réserves",
    subtitle: "Toutes les ressources sont couvertes ; certains points sont signalés ci-dessous.",
  },
  NON_COMPLIANT: {
    title: "Non conforme",
    subtitle: "Au moins une ressource n'est pas couverte par une licence valide. Ce document ne certifie pas le projet.",
  },
  PENDING: {
    title: "Vérification en attente",
    subtitle: "Aucune ressource n'a encore été déclarée pour ce projet.",
  },
};

export function passportFileName(projectName: string) {
  const slug = projectName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `passeport-de-droits-${slug || "projet"}.pdf`;
}
