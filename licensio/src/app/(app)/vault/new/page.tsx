import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasRole, requireWorkspace } from "@/server/auth";
import { LicenseForm } from "@/components/vault/LicenseForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Ajouter une licence" };

export default async function NewLicensePage() {
  const { role, workspace } = await requireWorkspace();
  if (!hasRole(role, "MEMBER")) redirect("/vault");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Ajouter une licence" description={`Coffre-fort de « ${workspace.name} ».`} />
      <LicenseForm />
    </div>
  );
}
