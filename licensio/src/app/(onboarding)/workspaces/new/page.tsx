import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ownedFreeWorkspace } from "@/server/workspaces";
import { CreateWorkspaceForm } from "@/components/workspace/CreateWorkspaceForm";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Nouvel espace" };

export default async function NewWorkspacePage() {
  const user = await requireUser();
  const free = await ownedFreeWorkspace(user.id);
  return (
    <div>
      <PageHeader
        title="Nouvel espace de travail"
        description="Pour une agence ou un client : ses licences et projets restent séparés de vos autres espaces. Vous pourrez ensuite y inviter vos collaborateurs."
      />
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        {free ? (
          <div className="space-y-4">
            <Alert tone="info">
              Vous avez déjà un espace gratuit, « {free.name} ». Un compte ne peut posséder qu&apos;un seul espace gratuit :
              passez-le au forfait Creator ou Agence pour créer d&apos;autres espaces, ou supprimez-le.
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Link href="/pricing" className={buttonClass("primary")}>
                Voir les forfaits
              </Link>
              <Link href="/dashboard" className={buttonClass("secondary")}>
                Retour
              </Link>
            </div>
          </div>
        ) : (
          <CreateWorkspaceForm />
        )}
      </div>
    </div>
  );
}
