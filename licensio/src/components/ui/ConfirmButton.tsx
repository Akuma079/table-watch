"use client";

// Bouton d'envoi qui demande confirmation avant d'exécuter l'action du formulaire.
export function ConfirmButton({
  action,
  fields,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  message: string;
  className?: string;
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
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
