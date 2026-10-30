import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasRole, requireWorkspace } from "@/server/auth";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function NewProjectPage() {
  const { role } = await requireWorkspace();
  if (!hasRole(role, "MEMBER")) redirect("/projects");
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
