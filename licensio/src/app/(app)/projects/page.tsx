import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/server/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Projets" };

export default async function ProjectsPage() {
  const { workspace } = await requireWorkspace();
  const projects = await prisma.project.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, clientName: true, complianceStatus: true },
  });

  return (
    <>
      <PageHeader title="Projets" description="Vidéos et podcasts suivis dans cet espace." />
      {projects.length === 0 ? (
        <EmptyState title="Aucun projet pour l'instant">
          La création de projets arrive à l&apos;étape suivante.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {projects.map((p) => (
            <li key={p.id} className="px-5 py-4">
              <p className="font-medium">{p.name}</p>
              {p.clientName && <p className="text-sm text-neutral-500">{p.clientName}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
