import { deleteLicense } from "@/server/actions/licenses";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

export function DeleteLicenseButton({ licenseId, assetName }: { licenseId: string; assetName: string }) {
  return (
    <ConfirmButton
      action={deleteLicense}
      fields={{ licenseId }}
      message={`Supprimer la licence « ${assetName} » et ses fichiers ? Les projets qui l'utilisent seront ré-audités.`}
      className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
    >
      Supprimer
    </ConfirmButton>
  );
}
