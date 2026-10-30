import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/server/auth";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { workspace } = await requireWorkspace();
  const [byStatus, licenseCount] = await Promise.all([
    prisma.project.groupBy({ by: ["complianceStatus"], where: { workspaceId: workspace.id }, _count: true }),
    prisma.license.count({ where: { workspaceId: workspace.id } }),
  ]);
  const count = (s: string) => byStatus.find((r) => r.complianceStatus === s)?._count ?? 0;

  const stats = [
    { label: "Projets conformes", value: count("COMPLIANT"), dot: "bg-compliant" },
    { label: "Projets à risque", value: count("NON_COMPLIANT"), dot: "bg-risk" },
    { label: "En attente d'audit", value: count("PENDING"), dot: "bg-pending" },
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
          <Link href="/vault" className={buttonClass("secondary")}>
            Coffre-fort
          </Link>
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
    </>
  );
}
