"use client";

import { useActionState } from "react";
import { deleteAccount, updateProfile } from "@/server/actions/account";
import { deleteWorkspace, transferOwnership } from "@/server/actions/workspaces";
import { initialFormState, type FormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

// Suppression confirmée en recopiant une valeur (nom de l'espace, email du compte).
function TypedConfirmForm({
  action,
  expected,
  label,
  button,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  expected: string;
  label: string;
  button: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label={label} name="confirm" autoComplete="off" placeholder={expected} error={state.fieldErrors?.confirm} />
      <SubmitButton variant="danger" className="border border-red-200" pendingLabel="Suppression…">
        {button}
      </SubmitButton>
    </form>
  );
}

export function DeleteWorkspaceForm({ name }: { name: string }) {
  return (
    <TypedConfirmForm
      action={deleteWorkspace}
      expected={name}
      label={`Pour confirmer, recopiez le nom de l'espace : ${name}`}
      button="Supprimer définitivement l'espace"
    />
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  return (
    <TypedConfirmForm
      action={deleteAccount}
      expected={email}
      label={`Pour confirmer, recopiez votre adresse email : ${email}`}
      button="Supprimer mon compte"
    />
  );
}

export function TransferOwnershipForm({ members }: { members: { id: string; label: string }[] }) {
  return (
    <form
      action={transferOwnership}
      onSubmit={(e) => {
        const select = e.currentTarget.elements.namedItem("membershipId") as HTMLSelectElement;
        const who = select.selectedOptions[0]?.text ?? "ce membre";
        if (!confirm(`Transférer la propriété à ${who} ? Vous deviendrez administrateur et ne gérerez plus l'abonnement.`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-1.5">
        <label htmlFor="membershipId" className="block text-sm font-medium text-neutral-700">
          Nouveau propriétaire
        </label>
        <select id="membershipId" name="membershipId" className={inputClass} required>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton variant="secondary" className="shrink-0" pendingLabel="Transfert…">
        Transférer la propriété
      </SubmitButton>
    </form>
  );
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateProfile, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex-1">
        <Field label="Nom" name="name" required defaultValue={state.values?.name ?? name} error={state.fieldErrors?.name} />
      </div>
      <SubmitButton variant="secondary" className="shrink-0" pendingLabel="Enregistrement…">
        Enregistrer
      </SubmitButton>
      {state.success && (
        <p role="status" className="basis-full text-sm text-green-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
