"use client";

import { deleteLicense } from "@/server/actions/licenses";

export function DeleteLicenseButton({ licenseId, assetName }: { licenseId: string; assetName: string }) {
  return (
    <form
      action={deleteLicense}
      onSubmit={(e) => {
        if (!confirm(`Supprimer la licence « ${assetName} » et ses fichiers ? Cette action est définitive.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="licenseId" value={licenseId} />
      <button type="submit" className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">
        Supprimer
      </button>
    </form>
  );
}
