import type { Metadata } from "next";
import { CreateWorkspaceForm } from "@/components/workspace/CreateWorkspaceForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Nouvel espace" };

export default function NewWorkspacePage() {
  return (
    <div>
      <PageHeader
        title="Nouvel espace de travail"
        description="Pour une agence ou un client : ses licences et projets restent séparés de vos autres espaces. Vous pourrez ensuite y inviter vos collaborateurs."
      />
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <CreateWorkspaceForm />
      </div>
    </div>
  );
}
