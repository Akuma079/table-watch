"use client";

import { startTransition, useActionState, useCallback, useEffect, useState } from "react";
import type { ParsedAsset } from "@/lib/asset-parse";
import { addProjectAssets } from "@/server/actions/projects";
import { initialFormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { AssetEditor } from "./AssetEditor";

export function AddAssetsForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addProjectAssets, initialFormState);
  const [assets, setAssets] = useState<ParsedAsset[]>([]);
  const onAssets = useCallback((a: ParsedAsset[]) => setAssets(a), []);
  // Nouvelle clé après un ajout réussi : l'éditeur repart d'une liste vide.
  const [editorKey, setEditorKey] = useState(0);
  useEffect(() => {
    if (state.success) setEditorKey((k) => k + 1);
  }, [state]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="assets" value={JSON.stringify(assets)} />
      <AssetEditor key={editorKey} onChange={onAssets} />
      <button type="submit" disabled={pending || assets.length === 0} className={buttonClass("primary")}>
        {pending ? "Audit en cours…" : "Ajouter et relancer l'audit"}
      </button>
    </form>
  );
}
