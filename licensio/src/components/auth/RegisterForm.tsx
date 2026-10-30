"use client";

import { useActionState } from "react";
import { register } from "@/server/actions/auth";
import { initialFormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(register, initialFormState);
  if (state.success) return <Alert tone="success">{state.success}</Alert>;

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field
        label="Nom complet"
        name="name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <Field
        label="Email professionnel"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="8 caractères minimum."
        error={state.fieldErrors?.password}
      />
      <Field
        label="Nom de votre espace (facultatif)"
        name="workspaceName"
        placeholder="Ex. Studio Lumière"
        hint="Votre agence ou votre chaîne. Modifiable plus tard."
        defaultValue={state.values?.workspaceName}
        error={state.fieldErrors?.workspaceName}
      />
      <SubmitButton className="w-full" pendingLabel="Création du compte…">
        Créer mon compte
      </SubmitButton>
    </form>
  );
}
