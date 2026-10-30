"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/server/actions/workspaces";
import { initialFormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/Button";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, initialFormState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full" pendingLabel="Un instant…">
        Rejoindre l&apos;espace
      </SubmitButton>
    </form>
  );
}
