import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { FindingSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/cn";
import {
  ASSET_TYPE_LABELS,
  dateFormat,
  dayFormat,
  FINDING_LABELS,
  LICENSE_TYPE_LABELS,
  PLATFORM_LABELS,
  PROJECT_USAGE_LABELS,
} from "@/lib/labels";
import { hasRole, requireWorkspace } from "@/server/auth";
import { deleteProject, removeProjectAsset, runProjectAudit } from "@/server/actions/projects";
import { auditIsStale, checkCompliance } from "@/server/services/compliance";
import { passportUrl } from "@/server/passport/data";
import { AddAssetsForm } from "@/components/projects/AddAssetsForm";
import { LinkLicenseSelect } from "@/components/projects/LinkLicenseSelect";
import { PassportPanel } from "@/components/projects/PassportPanel";
import { UpgradeNotice } from "@/components/billing/UpgradeNotice";
import { hasFeature } from "@/lib/plans";
import { recommendationFor } from "@/components/projects/recommendations";
import { ComplianceBadge, SEVERITY_STATUS } from "@/components/projects/StatusBadges";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Projet" };

const SEVERITY_ORDER: Record<FindingSeverity, number> = { ERROR: 0, WARNING: 1, OK: 2 };
const STRIPE: Record<FindingSeverity, string> = { ERROR: "border-l-risk", WARNING: "border-l-warning", OK: "border-l-compliant" };
const FINDING_PILL: Record<FindingSeverity, string> = {
  ERROR: "bg-risk-soft text-red-800",
  WARNING: "bg-warning-soft text-amber-900",
  OK: "bg-compliant-soft text-green-800",
};

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ licenseAdded?: string }>;
}) {
  const { id } = await params;
  const { workspace, role } = await requireWorkspace();
  const canEdit = hasRole(role, "MEMBER");

  const head = await prisma.project.findFirst({ where: { id, workspaceId: workspace.id }, select: { lastAuditAt: true } });
  if (!head) notFound();
  // Les expirations dépendent de la date : un audit d'un jour précédent est recalculé.
  if (auditIsStale(head.lastAuditAt)) await checkCompliance(id, workspace.id);

  const [project, licenses] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        media: { select: { id: true, source: true, externalUrl: true, processingStatus: true } },
        assets: {
          orderBy: { createdAt: "asc" },
          include: { license: { select: { id: true, assetName: true, platform: true, licenseType: true, licenseKey: true } } },
        },
        audits: { orderBy: { startedAt: "desc" }, take: 1, include: { findings: true } },
      },
    }),
    prisma.license.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { assetName: "asc" },
      select: { id: true, assetName: true, author: true, platform: true, licenseType: true },
    }),
  ]);

  const audit = project.audits[0];
  const findingsByAsset = new Map<string, NonNullable<typeof audit>["findings"]>();
  for (const f of audit?.findings ?? []) {
    findingsByAsset.set(f.projectAssetId, [...(findingsByAsset.get(f.projectAssetId) ?? []), f]);
  }
  const severityOf = (assetId: string): FindingSeverity =>
    (findingsByAsset.get(assetId) ?? []).reduce<FindingSeverity>(
      (acc, f) => (SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[acc] ? f.severity : acc),
      "OK",
    );
  const assets = [...project.assets].sort((a, b) => SEVERITY_ORDER[severityOf(a.id)] - SEVERITY_ORDER[severityOf(b.id)]);
  const okCount = assets.length - (audit?.errorCount ?? 0) - (audit?.warningCount ?? 0);
  const licenseOptions = licenses.map((l) => ({
    id: l.id,
    label: `${l.assetName}${l.author ? ` — ${l.author}` : ""} · ${PLATFORM_LABELS[l.platform]} · ${LICENSE_TYPE_LABELS[l.licenseType]}`,
  }));
  const media = project.media[0];

  return (
    <>
      <Link href="/projects" className="mb-6 inline-block text-sm text-neutral-500 hover:text-neutral-900">
        ← Projets
      </Link>

      {(await searchParams).licenseAdded && (
        <div className="mb-6">
          <Alert tone="success">Licence ajoutée au coffre-fort : l&apos;audit a été relancé.</Alert>
        </div>
      )}

      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {[
              project.clientName,
              `Usage ${PROJECT_USAGE_LABELS[project.usage].toLowerCase()}`,
              project.publishedAt && `Diffusion le ${dayFormat.format(project.publishedAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {media?.externalUrl && (
            <a href={media.externalUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-neutral-500 underline hover:text-neutral-900">
              {media.externalUrl}
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-3">
            {audit?.score != null && <span className="text-2xl font-semibold tabular-nums">{audit.score}%</span>}
            <ComplianceBadge status={project.complianceStatus} size="lg" />
          </div>
          {project.lastAuditAt && (
            <p className="text-xs text-neutral-500">Dernier audit : {dateFormat.format(project.lastAuditAt)}, {project.lastAuditAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}</p>
          )}
          <form action={runProjectAudit}>
            <input type="hidden" name="projectId" value={project.id} />
            <button type="submit" className={buttonClass("secondary", "py-1.5 text-xs")}>
              Relancer l&apos;audit
            </button>
          </form>
        </div>
      </header>

      {assets.length > 0 && (
        <section aria-label="Résumé de l'audit" className="mb-8 grid grid-cols-3 gap-3">
          {[
            { label: "Conformes", value: okCount, cls: "text-green-700" },
            { label: "À vérifier", value: audit?.warningCount ?? 0, cls: "text-amber-700" },
            { label: "Non conformes", value: audit?.errorCount ?? 0, cls: "text-red-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-xs text-neutral-500">{s.label}</p>
              <p className={cn("text-2xl font-semibold tabular-nums", s.value > 0 && s.cls)}>{s.value}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-3 font-medium">Rapport par ressource ({assets.length})</h2>
        {assets.length === 0 ? (
          <EmptyState title="Aucune ressource déclarée">Ajoutez les musiques, plans et images utilisés dans ce montage.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {assets.map((asset) => {
              const severity = severityOf(asset.id);
              const findings = [...(findingsByAsset.get(asset.id) ?? [])].sort(
                (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
              );
              const recos = findings
                .map((f) => recommendationFor(f.code, { projectId: project.id, usage: project.usage, asset, license: asset.license }))
                .filter((r) => r !== null);
              return (
                <li key={asset.id} className={cn("rounded-xl border border-l-4 border-neutral-200 bg-white p-5", STRIPE[severity])}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{asset.assetName}</h3>
                      <p className="text-sm text-neutral-500">
                        {[asset.author, asset.platform && PLATFORM_LABELS[asset.platform], ASSET_TYPE_LABELS[asset.assetType]]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <ComplianceBadge status={SEVERITY_STATUS[severity]} />
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {findings.map((f) => (
                      <li key={f.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:gap-2">
                        <span className={cn("w-fit shrink-0 rounded px-1.5 py-0.5 text-xs font-medium", FINDING_PILL[f.severity])}>
                          {FINDING_LABELS[f.code]}
                        </span>
                        <span className="text-neutral-700">{f.message}</span>
                      </li>
                    ))}
                  </ul>

                  {recos.length > 0 && (
                    <div className="mt-3 rounded-lg bg-neutral-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Recommandation</p>
                      {recos.map((r, i) => (
                        <div key={i} className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-neutral-700">{r.text}</p>
                          {r.action && canEdit && (
                            <Link href={r.action.href} className={buttonClass("primary", "shrink-0 py-1.5 text-xs")}>
                              {r.action.label}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    {canEdit ? (
                      <LinkLicenseSelect
                        key={`${asset.id}-${asset.licenseId}-${asset.matchMethod}`}
                        assetId={asset.id}
                        assetName={asset.assetName}
                        value={asset.licenseId}
                        manual={asset.matchMethod === "MANUAL"}
                        options={licenseOptions}
                      />
                    ) : (
                      <span className="text-xs text-neutral-500">
                        {asset.license ? `Licence : ${asset.license.assetName}` : "Aucune licence associée"}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      {asset.license && (
                        <Link href={`/vault?q=${encodeURIComponent(asset.license.assetName)}`} className="text-xs text-neutral-500 hover:text-neutral-900">
                          Voir la licence{asset.matchMethod === "MANUAL" ? " (associée à la main)" : ""}
                        </Link>
                      )}
                      {canEdit && (
                        <ConfirmButton
                          action={removeProjectAsset}
                          fields={{ assetId: asset.id }}
                          message={`Retirer « ${asset.assetName} » du projet ?`}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Retirer
                        </ConfirmButton>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-2 font-medium">Passeport de Droits</h2>
        {hasFeature(workspace.plan, "passport") ? (
          <PassportPanel
            projectId={project.id}
            url={project.passportEnabled && project.passportToken ? passportUrl(project.passportToken) : null}
            status={project.complianceStatus}
            canEdit={canEdit}
          />
        ) : (
          <UpgradeNotice title="Remettez un Passeport de Droits à votre client" canManage={hasRole(role, "ADMIN")}>
            Un certificat public et un PDF, à votre marque, qui listent chaque ressource et son identifiant de licence. Inclus dans
            le plan Agence.
          </UpgradeNotice>
        )}
      </section>

      {canEdit && (
        <section className="mb-10">
          <h2 className="mb-3 font-medium">Ajouter des ressources</h2>
          <AddAssetsForm projectId={project.id} />
        </section>
      )}

      {canEdit && (
        <div className="flex justify-end border-t border-neutral-200 pt-6">
          <ConfirmButton
            action={deleteProject}
            fields={{ projectId: project.id }}
            message={`Supprimer le projet « ${project.name} » et son historique d'audit ?`}
            className={buttonClass("danger", "py-1.5 text-xs")}
          >
            Supprimer le projet
          </ConfirmButton>
        </div>
      )}
    </>
  );
}
