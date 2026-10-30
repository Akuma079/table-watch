import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/redirect";
import { hasRole, requireWorkspace } from "@/server/auth";
import { LicenseForm } from "@/components/vault/LicenseForm";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Ajouter une licence" };

const PREFILL = ["assetName", "author", "platform", "assetType", "sourceUrl", "licenseType"] as const;

export default async function NewLicensePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { role, workspace } = await requireWorkspace();
  if (!hasRole(role, "MEMBER")) redirect("/vault");

  const params = await searchParams;
  const initial = Object.fromEntries(PREFILL.flatMap((k) => (params[k] ? [[k, params[k]!.slice(0, 500)]] : [])));
  const returnTo = safeNextPath(params.returnTo, "");
  const fromProject = returnTo.startsWith("/projects/") ? returnTo : undefined;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Ajouter une licence" description={`Coffre-fort de « ${workspace.name} ».`} />
      {fromProject && (
        <div className="mb-6">
          <Alert tone="info">Pré-rempli depuis l&apos;audit du projet. Vous y reviendrez après l&apos;enregistrement.</Alert>
        </div>
      )}
      <LicenseForm initial={initial} returnTo={fromProject} />
    </div>
  );
}
