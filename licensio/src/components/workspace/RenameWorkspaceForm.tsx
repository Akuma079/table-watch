"use client";

import { useActionState } from "react";
import { renameWorkspace } from "@/server/actions/workspaces";
import { initialFormState } from "@/server/actions/types";
import { buttonClass } from "@/components/ui/button-styles";
import { Field } from "@/components/ui/Field";

export function RenameWorkspaceForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(renameWorkspace, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex-1">
        <Field
          label="Nom de l'espace"
          name="name"
          required
          defaultValue={state.values?.name ?? name}
          error={state.fieldErrors?.name ?? state.error}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass("secondary", "shrink-0")}>
        {pending ? "Enregistrement…" : "Renommer"}
      </button>
      {state.success && (
        <p role="status" className="basis-full text-sm text-green-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
