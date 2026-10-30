"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-400",
  secondary: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100",
  ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  danger: "text-red-600 hover:bg-red-50",
};

export function buttonClass(variant: Variant = "primary", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
    "disabled:cursor-not-allowed",
    variants[variant],
    extra,
  );
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pendingLabel?: string };

// Bouton d'envoi : se désactive pendant l'exécution de la Server Action du formulaire.
export function SubmitButton({ variant = "primary", pendingLabel, className, children, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={buttonClass(variant, className)} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
