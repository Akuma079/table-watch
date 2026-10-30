import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hasRole, requireWorkspace } from "@/server/auth";
import { ComplianceBadge, statusDotClass } from "@/components/projects/StatusBadges";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { workspace, role } = await requireWorkspace();
  const [byStatus, licenseCount, atRisk] = await Promise.all([
    prisma.project.groupBy({ by: ["complianceStatus"], where: { workspaceId: workspace.id }, _count: true }),
    prisma.license.count({ where: { workspaceId: workspace.id } }),
    prisma.project.findMany({
      where: { workspaceId: workspace.id, complianceStatus: { in: ["NON_COMPLIANT", "WARNING"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, name: true, clientName: true, complianceStatus: true },
    }),
  ]);
  // Tri en JS : l'ordre des valeurs d'enum en base dépend de l'ordre des migrations.
  atRisk.sort((a, b) => Number(b.complianceStatus === "NON_COMPLIANT") - Number(a.complianceStatus === "NON_COMPLIANT"));
  const count = (s: string) => byStatus.find((r) => r.complianceStatus === s)?._count ?? 0;

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
          hasRole(role, "MEMBER") && (
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

      <section className="mt-10">
        <h2 className="mb-3 font-medium">Projets à traiter</h2>
        {atRisk.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
            Aucun projet en alerte.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {atRisk.slice(0, 8).map((p) => (
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
