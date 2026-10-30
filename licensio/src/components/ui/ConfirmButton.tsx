"use client";

import { SubmitButton } from "./Button";

// Bouton d'envoi qui demande confirmation avant d'exécuter l'action du formulaire.
export function ConfirmButton({
  action,
  fields,
  message,
  className,
  pendingLabel,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  message: string;
  className?: string;
  pendingLabel?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={null} className={className} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
    </form>
  );
}
