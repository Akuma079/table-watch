"use client";

import { useActionState } from "react";
import { createWorkspace } from "@/server/actions/workspaces";
import { initialFormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function CreateWorkspaceForm() {
  const [state, action] = useActionState(createWorkspace, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Nom de l'espace"
        name="name"
        placeholder="Ex. Agence Nord Studio"
        required
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <SubmitButton pendingLabel="Création…">Créer l&apos;espace</SubmitButton>
    </form>
  );
}
