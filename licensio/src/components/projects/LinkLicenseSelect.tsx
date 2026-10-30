"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { linkAssetLicense } from "@/server/actions/projects";

type Option = { id: string; label: string };

// Associer à la main une licence du coffre-fort à une ressource ; « automatique » rend la
// main à la correspondance par nom.
export function LinkLicenseSelect({
  assetId,
  assetName,
  value,
  manual,
  options,
}: {
  assetId: string;
  assetName: string;
  value: string | null;
  manual: boolean;
  options: Option[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={linkAssetLicense} className="flex items-center gap-2">
      <input type="hidden" name="assetId" value={assetId} />
      <label htmlFor={`link-${assetId}`} className="shrink-0 text-xs text-neutral-500">
        Licence :
      </label>
      <LicenseSelect
        id={`link-${assetId}`}
        name="licenseId"
        defaultValue={manual && value ? value : ""}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label={`Licence associée à ${assetName}`}
        className="min-w-0 max-w-full flex-1 truncate rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs disabled:opacity-60 sm:max-w-xs"
      >
        <option value="">Automatique (par titre)</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </LicenseSelect>
    </form>
  );
}

// Liste désactivée pendant l'enregistrement et le ré-audit.
function LicenseSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { pending } = useFormStatus();
  return <select {...props} disabled={pending} aria-busy={pending || undefined} />;
}
