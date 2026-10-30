import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PROJECT_USAGE_LABELS } from "@/lib/labels";
import { PLANS } from "@/lib/plans";
import { hasRole, requireWorkspace } from "@/server/auth";
import { ComplianceBadge } from "@/components/projects/StatusBadges";
import { buttonClass } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Projets" };

// Rouge d'abord : ce qui demande une action remonte en tête.
const STATUS_ORDER = { NON_COMPLIANT: 0, WARNING: 1, PENDING: 2, COMPLIANT: 3 } as const;

export default async function ProjectsPage() {
  const { workspace, role } = await requireWorkspace();
  const canEdit = hasRole(role, "MEMBER");
  const projects = await prisma.project.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      clientName: true,
      usage: true,
      complianceStatus: true,
      lastAuditAt: true,
      _count: { select: { assets: true } },
      audits: { orderBy: { startedAt: "desc" }, take: 1, select: { score: true, errorCount: true, warningCount: true } },
    },
  });
  projects.sort((a, b) => STATUS_ORDER[a.complianceStatus] - STATUS_ORDER[b.complianceStatus]);

  return (
    <>
      <PageHeader
        title="Projets"
        description={
          PLANS[workspace.plan].limits.projects
            ? `${projects.length} / ${PLANS[workspace.plan].limits.projects} projets (plan ${PLANS[workspace.plan].name})`
            : "Vidéos et podcasts audités dans cet espace."
        }
        actions={
          canEdit && (
            <Link href="/projects/new" className={buttonClass("primary")}>
              Nouveau projet
            </Link>
          )
        }
      />
      {projects.length === 0 ? (
        <EmptyState title="Aucun projet pour l'instant">
          Créez un projet, listez les ressources du montage : l&apos;audit vous dit lesquelles sont couvertes.
          {canEdit && (
            <div className="mt-4">
              <Link href="/projects/new" className={buttonClass("primary")}>
                Créer un premier projet
              </Link>
            </div>
          )}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {projects.map((p) => {
            const audit = p.audits[0];
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-sm text-neutral-500">
                      {[p.clientName, PROJECT_USAGE_LABELS[p.usage], `${p._count.assets} ressource${p._count.assets > 1 ? "s" : ""}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {audit && (audit.errorCount > 0 || audit.warningCount > 0) && (
                      <span className="text-xs text-neutral-500">
                        {[
                          audit.errorCount > 0 && `${audit.errorCount} bloquant${audit.errorCount > 1 ? "s" : ""}`,
                          audit.warningCount > 0 && `${audit.warningCount} à vérifier`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    {audit?.score != null && <span className="w-10 text-right text-sm font-medium tabular-nums">{audit.score}%</span>}
                    <ComplianceBadge status={p.complianceStatus} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
