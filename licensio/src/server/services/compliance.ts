import "server-only";
import { prisma } from "@/lib/prisma";
import { auditProject, couldMatch, licenseKeys, startOfUtcDay, type AuditLicense, type ProjectResult } from "./compliance-rules";

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

export type LicenseRef = { id: string; assetName: string; normalizedName: string; author: string | null; sourceUrl: string | null };

// Projets dont le statut peut changer avec ces licences : ressources qui y sont déjà
// associées, ou qu'elles peuvent couvrir (même titre, même lien). À appeler avant une
// suppression, tant que les associations existent encore.
export async function projectsAffectedBy(workspaceId: string, refs: LicenseRef[]) {
  if (refs.length === 0) return [];
  const keys = refs.flatMap((r) => [...licenseKeys(r)]);
  const assets = await prisma.projectAsset.findMany({
    where: {
      project: { workspaceId },
      OR: [
        { licenseId: { in: refs.map((r) => r.id) } },
        { normalizedName: { in: keys } },
        ...(refs.some((r) => r.sourceUrl) ? [{ sourceUrl: { not: null } }] : []),
      ],
    },
    select: { projectId: true, licenseId: true, normalizedName: true, sourceUrl: true },
  });
  const ids = new Set(refs.map((r) => r.id));
  return [
    ...new Set(
      assets.filter((a) => (a.licenseId && ids.has(a.licenseId)) || refs.some((r) => couldMatch(a, r))).map((a) => a.projectId),
    ),
  ];
}

const AUDIT_CONCURRENCY = 3;

// Ré-audite ces projets, quelques-uns à la fois, avec une seule lecture du coffre-fort.
export async function auditProjects(workspaceId: string, projectIds: string[]) {
  if (projectIds.length === 0) return;
  const licenses = await loadLicenses(workspaceId);
  const queue = [...projectIds];
  await Promise.all(
    Array.from({ length: Math.min(AUDIT_CONCURRENCY, queue.length) }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) await checkCompliance(id, workspaceId, licenses);
    }),
  );
}

// Après un ajout ou une modification dans le coffre-fort : seuls les projets concernés
// sont ré-audités (les autres sont recalculés à leur prochaine ouverture s'ils datent d'hier).
export async function auditAfterLicenseChange(workspaceId: string, refs: LicenseRef[]) {
  await auditProjects(workspaceId, await projectsAffectedBy(workspaceId, refs));
}

// Les expirations dépendent de la date du jour : un audit d'hier peut être périmé.
export function auditIsStale(lastAuditAt: Date | null, now = new Date()) {
  return !lastAuditAt || lastAuditAt < startOfUtcDay(now);
}
