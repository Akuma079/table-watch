"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./button-styles";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  // null : `className` est utilisé tel quel (liens d'action discrets, boutons déjà stylés).
  variant?: ButtonVariant | null;
  pendingLabel?: React.ReactNode;
};

// Bouton d'envoi : se désactive pendant l'exécution de la Server Action du formulaire
// (pas de double envoi), avec un libellé de progression facultatif.
export function SubmitButton({ variant = "primary", pendingLabel, className, disabled, children, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...props}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={variant === null ? className : buttonClass(variant, className)}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
