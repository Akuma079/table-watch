"use client";

import { startTransition, useActionState, useCallback, useEffect, useState } from "react";
import { attachLicenseDocuments } from "@/server/actions/licenses";
import { initialFormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { DocumentDropzone, type UploadedDocument } from "./DocumentDropzone";

// Joindre une preuve à une licence déjà enregistrée.
export function AttachDocumentsForm({ licenseId, defaultOpen = false }: { licenseId: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, action, pending] = useActionState(attachLicenseDocuments, initialFormState);
  const [upload, setUpload] = useState<{ documents: UploadedDocument[]; uploading: boolean }>({ documents: [], uploading: false });
  const onChange = useCallback((s: typeof upload) => setUpload(s), []);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setKey((k) => k + 1);
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
          + Joindre une preuve
        </button>
        {state.success && <span className="text-xs text-green-700" role="status">{state.success}</span>}
      </div>
    );
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="licenseId" value={licenseId} />
      <input type="hidden" name="documents" value={JSON.stringify(upload.documents)} />
      <DocumentDropzone key={key} onChange={onChange} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "py-1.5 text-xs")}>
          Annuler
        </button>
        <button type="submit" disabled={pending || upload.uploading || upload.documents.length === 0} className={buttonClass("primary", "py-1.5 text-xs")}>
          {upload.uploading ? "Envoi…" : pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
