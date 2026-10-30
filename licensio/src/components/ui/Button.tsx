"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./button-styles";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; pendingLabel?: string };

// Bouton d'envoi : se désactive pendant l'exécution de la Server Action du formulaire.
export function SubmitButton({ variant = "primary", pendingLabel, className, children, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={buttonClass(variant, className)} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
