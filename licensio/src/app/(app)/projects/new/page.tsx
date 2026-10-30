import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasRole, requireWorkspace } from "@/server/auth";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { UpgradeNotice } from "@/components/billing/UpgradeNotice";
import { limitMessage, limitReached } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function NewProjectPage() {
  const { role, workspace } = await requireWorkspace();
  if (!hasRole(role, "MEMBER")) redirect("/projects");
  const count = await prisma.project.count({ where: { workspaceId: workspace.id } });
  if (limitReached(workspace.plan, "projects", count)) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Nouveau projet" />
        <UpgradeNotice title="Limite de projets atteinte" canManage={hasRole(role, "ADMIN")}>
          {limitMessage(workspace.plan, "projects")} Vous pouvez aussi supprimer un projet terminé.
        </UpgradeNotice>
      </div>
    );
  }
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Nouveau projet"
        description="Déclarez les ressources du montage : l'audit les compare aussitôt à votre coffre-fort."
      />
      <ProjectForm />
    </div>
  );
}
