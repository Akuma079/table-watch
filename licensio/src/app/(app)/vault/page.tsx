import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/server/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Coffre-fort" };

export default async function VaultPage() {
  const { workspace } = await requireWorkspace();
  const licenses = await prisma.license.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { purchaseDate: "desc" },
    select: { id: true, assetName: true, platform: true, licenseType: true },
  });

  return (
    <>
      <PageHeader title="Coffre-fort" description="Licences et preuves d'achat de cet espace." />
      {licenses.length === 0 ? (
        <EmptyState title="Votre coffre-fort est vide">
          L&apos;ajout de licences arrive à l&apos;étape suivante.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {licenses.map((l) => (
            <li key={l.id} className="px-5 py-4">
              <p className="font-medium">{l.assetName}</p>
              <p className="text-sm text-neutral-500">
                {l.platform} · {l.licenseType}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
