"use client";

import { useActionState, useState } from "react";
import { inviteMember, type InviteState } from "@/server/actions/workspaces";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

export function InviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteMember, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && state.inviteUrl && (
        <Alert tone="success">
          <p>{state.success}</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={state.inviteUrl} className={`${inputClass} font-mono text-xs`} aria-label="Lien d'invitation" />
            <button
              type="button"
              className="shrink-0 rounded-lg border border-green-300 bg-white px-3 text-xs font-medium"
              onClick={async () => {
                await navigator.clipboard.writeText(state.inviteUrl!);
                setCopied(true);
              }}
            >
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </Alert>
      )}
      <form action={action} onSubmit={() => setCopied(false)} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <div className="flex-1">
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="collaborateur@agence.com"
            required
            defaultValue={state.success ? "" : state.values?.email}
            error={state.fieldErrors?.email}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="role" className="block text-sm font-medium text-neutral-700">
            Rôle
          </label>
          <select id="role" name="role" defaultValue={state.values?.role || "MEMBER"} className={inputClass}>
            <option value="MEMBER">Membre</option>
            <option value="VIEWER">Lecture seule</option>
            {canInviteAdmin && <option value="ADMIN">Administrateur</option>}
          </select>
        </div>
        <SubmitButton pendingLabel="Envoi…">Inviter</SubmitButton>
      </form>
    </div>
  );
}
