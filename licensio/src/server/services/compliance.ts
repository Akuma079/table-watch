import "server-only";
import { prisma } from "@/lib/prisma";
import { auditProject, startOfUtcDay, type AuditLicense, type ProjectResult } from "./compliance-rules";

async function loadLicenses(workspaceId: string): Promise<AuditLicense[]> {
  const rows = await prisma.license.findMany({
    where: { workspaceId },
    select: {
      id: true,
      assetName: true,
      normalizedName: true,
      author: true,
      platform: true,
      platformOther: true,
      sourceUrl: true,
      licenseType: true,
      licenseKey: true,
      expiresAt: true,
      revokedAt: true,
      mustStayActive: true,
      _count: { select: { documents: true } },
    },
  });
  return rows.map(({ _count, ...l }) => ({ ...l, documentCount: _count.documents }));
}

// Audite un projet contre le coffre-fort de son espace et enregistre le résultat :
// un AuditRun (historique) avec ses constats, la licence retenue pour chaque ressource,
// et le statut global du projet (vert / orange / rouge).
export async function checkCompliance(
  projectId: string,
  workspaceId: string,
  licenses?: AuditLicense[],
): Promise<ProjectResult> {
  const project = await prisma.project.findFirstOrThrow({
    where: { id: projectId, workspaceId },
    select: {
      usage: true,
      publishedAt: true,
      assets: {
        select: {
          id: true,
          normalizedName: true,
          platform: true,
          sourceUrl: true,
          licenseId: true,
          matchMethod: true,
          restrictedApprovedLicenseId: true,
          restrictedApprovedAt: true,
          restrictedApprovedBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  const assets = project.assets.map(({ restrictedApprovedLicenseId, restrictedApprovedAt, restrictedApprovedBy, ...a }) => ({
    ...a,
    restrictedApproval:
      restrictedApprovedLicenseId && restrictedApprovedAt
        ? {
            licenseId: restrictedApprovedLicenseId,
            at: restrictedApprovedAt,
            by: restrictedApprovedBy ? restrictedApprovedBy.name || restrictedApprovedBy.email : null,
          }
        : null,
  }));
  const result = auditProject(project, assets, licenses ?? (await loadLicenses(workspaceId)));
  const now = new Date();

  await prisma.$transaction([
    prisma.auditRun.create({
      data: {
        projectId,
        status: "COMPLETED",
        result: result.status,
        assetCount: result.assets.length,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        score: result.score,
        finishedAt: now,
        findings: {
          create: result.assets.flatMap((a) =>
            a.findings.map((f) => ({ projectAssetId: a.assetId, licenseId: a.licenseId, ...f })),
          ),
        },
      },
    }),
    ...result.assets.map((a) =>
      prisma.projectAsset.update({
        where: { id: a.assetId },
        data: { licenseId: a.licenseId, matchMethod: a.matchMethod },
      }),
    ),
    prisma.project.update({
      where: { id: projectId },
      data: { complianceStatus: result.status, lastAuditAt: now },
    }),
  ]);
  return result;
}

// Après un changement dans le coffre-fort (ajout, suppression, preuve jointe), tous les
// projets de l'espace peuvent changer de statut : on les ré-audite.
export async function auditWorkspaceProjects(workspaceId: string) {
  const [projects, licenses] = await Promise.all([
    prisma.project.findMany({ where: { workspaceId }, select: { id: true } }),
    loadLicenses(workspaceId),
  ]);
  for (const p of projects) await checkCompliance(p.id, workspaceId, licenses);
}

// Les expirations dépendent de la date du jour : un audit d'hier peut être périmé.
export function auditIsStale(lastAuditAt: Date | null, now = new Date()) {
  return !lastAuditAt || lastAuditAt < startOfUtcDay(now);
}
