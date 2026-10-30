import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasRole, requireWorkspace } from "@/server/auth";
import { LicenseForm } from "@/components/vault/LicenseForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Modifier la licence" };

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditLicensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, workspace } = await requireWorkspace();
  if (!hasRole(role, "MEMBER")) redirect("/vault");
  const l = await prisma.license.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!l) notFound();

  const initial = {
    assetName: l.assetName,
    author: l.author ?? "",
    assetType: l.assetType,
    platform: l.platform,
    platformOther: l.platformOther ?? "",
    sourceUrl: l.sourceUrl ?? "",
    licenseType: l.licenseType,
    purchaseDate: isoDay(l.purchaseDate),
    expiresAt: isoDay(l.expiresAt),
    licenseKey: l.licenseKey ?? "",
    notes: l.notes ?? "",
    mustStayActive: l.mustStayActive ? "on" : "",
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Modifier la licence"
        description="Les preuves se gèrent depuis le coffre-fort. Les projets sont ré-audités à l'enregistrement."
      />
      <LicenseForm initial={initial} licenseId={l.id} />
    </div>
  );
}
