import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasRole, requireWorkspace } from "@/server/auth";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Modifier le projet" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, workspace } = await requireWorkspace();
  if (!hasRole(role, "MEMBER")) redirect(`/projects/${id}`);
  const p = await prisma.project.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { media: { where: { source: { not: "UPLOAD" } }, select: { externalUrl: true }, take: 1 } },
  });
  if (!p) notFound();

  const initial = {
    name: p.name,
    clientName: p.clientName ?? "",
    usage: p.usage,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString().slice(0, 10) : "",
    mediaUrl: p.media[0]?.externalUrl ?? "",
    description: p.description ?? "",
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Modifier le projet"
        description="Les ressources se gèrent depuis la page du projet. L'audit est relancé à l'enregistrement."
      />
      <ProjectForm projectId={p.id} initial={initial} />
    </div>
  );
}
