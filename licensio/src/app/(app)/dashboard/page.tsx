import type { Metadata } from "next";
import Link from "next/link";
import { dayFormat, PLATFORM_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { EXPIRY_WARNING_DAYS } from "@/server/services/compliance-rules";
import { hasRole, requireWorkspace } from "@/server/auth";
import { ComplianceBadge, statusDotClass } from "@/components/projects/StatusBadges";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Tableau de bord" };

const AT_RISK_SHOWN = 8;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { workspace, role } = await requireWorkspace();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const atRiskSelect = { id: true, name: true, clientName: true, complianceStatus: true } as const;
  const [byStatus, licenseCount, nonCompliant, warnings, expiring] = await Promise.all([
    prisma.project.groupBy({ by: ["complianceStatus"], where: { workspaceId: workspace.id }, _count: true }),
    prisma.license.count({ where: { workspaceId: workspace.id } }),
    // Non conformes d'abord, puis à vérifier : deux requêtes plutôt qu'un tri sur l'enum.
    prisma.project.findMany({
      where: { workspaceId: workspace.id, complianceStatus: "NON_COMPLIANT" },
      orderBy: { updatedAt: "desc" },
      take: AT_RISK_SHOWN,
      select: atRiskSelect,
    }),
    prisma.project.findMany({
      where: { workspaceId: workspace.id, complianceStatus: "WARNING" },
      orderBy: { updatedAt: "desc" },
      take: AT_RISK_SHOWN,
      select: atRiskSelect,
    }),
    prisma.license.findMany({
      where: {
        workspaceId: workspace.id,
        revokedAt: null,
        expiresAt: { gte: today, lte: new Date(today.getTime() + EXPIRY_WARNING_DAYS * 86_400_000) },
      },
      orderBy: { expiresAt: "asc" },
      take: 6,
      select: { id: true, assetName: true, author: true, platform: true, expiresAt: true },
    }),
  ]);
  const count = (s: string) => byStatus.find((r) => r.complianceStatus === s)?._count ?? 0;
  const atRisk = [...nonCompliant, ...warnings].slice(0, AT_RISK_SHOWN);
  const atRiskTotal = count("NON_COMPLIANT") + count("WARNING");
  const projectCount = byStatus.reduce((n, r) => n + r._count, 0);
  const canEdit = hasRole(role, "MEMBER");

  const stats = [
    { label: "Conformes", value: count("COMPLIANT"), dot: statusDotClass("COMPLIANT") },
    { label: "À vérifier", value: count("WARNING"), dot: statusDotClass("WARNING") },
    { label: "Non conformes", value: count("NON_COMPLIANT"), dot: statusDotClass("NON_COMPLIANT") },
    { label: "Licences au coffre-fort", value: licenseCount, dot: "bg-neutral-400" },
  ];

  return (
    <>
      {(await searchParams).password === "updated" && (
        <div className="mb-6">
          <Alert tone="success">Votre mot de passe a été modifié.</Alert>
        </div>
      )}
      <PageHeader
        title="Tableau de bord"
        description={workspace.name}
        actions={
          canEdit && (
            <Link href="/projects/new" className={buttonClass("primary")}>
              Nouveau projet
            </Link>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span aria-hidden className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.label}
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {canEdit && (licenseCount === 0 || projectCount === 0) && (
        <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-medium">Bien démarrer</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { done: licenseCount > 0, title: "Ajoutez vos licences", text: "Avec leurs certificats et factures.", href: "/vault/new", cta: "Ajouter une licence" },
              { done: projectCount > 0, title: "Créez un projet", text: "Listez les musiques et plans du montage : l'audit est immédiat.", href: "/projects/new", cta: "Nouveau projet" },
              { done: false, title: "Partagez le Passeport", text: "Un certificat public et un PDF pour votre client.", href: "/projects", cta: "Voir les projets" },
            ].map((step, i) => (
              <li key={step.title} className="flex flex-col rounded-lg border border-neutral-200 p-4">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${step.done ? "bg-compliant text-white" : "bg-neutral-100 text-neutral-600"}`}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <p className="mt-3 text-sm font-medium">{step.title}</p>
                <p className="mt-1 flex-1 text-xs text-neutral-500">{step.text}</p>
                {!step.done && (
                  <Link href={step.href} className="mt-3 text-sm font-medium underline hover:text-neutral-600">
                    {step.cta}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {expiring.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-medium">Licences qui expirent dans les {EXPIRY_WARNING_DAYS} jours</h2>
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {expiring.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/vault?q=${encodeURIComponent(l.assetName)}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50"
                >
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-medium">{l.assetName}</span>
                    <span className="text-neutral-500">
                      {l.author ? ` · ${l.author}` : ""} · {PLATFORM_LABELS[l.platform]}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-amber-900">
                    {dayFormat.format(l.expiresAt!)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-medium">Projets à traiter</h2>
          {atRiskTotal > AT_RISK_SHOWN && (
            <Link href="/projects" className="text-sm text-neutral-500 hover:text-neutral-900">
              Voir les {atRiskTotal} →
            </Link>
          )}
        </div>
        {atRisk.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
            {projectCount === 0 ? "Aucun projet pour l'instant." : "Aucun projet en alerte : tout est conforme."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {atRisk.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50">
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-medium">{p.name}</span>
                    {p.clientName && <span className="text-neutral-500"> · {p.clientName}</span>}
                  </span>
                  <ComplianceBadge status={p.complianceStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
