import { cn } from "@/lib/cn";

// Module sans "use client" : utilisable par les composants serveur (liens stylés en bouton)
// comme par les composants client.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-400",
  secondary: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100",
  ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  danger: "text-red-600 hover:bg-red-50",
};

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
    "disabled:cursor-not-allowed",
    variants[variant],
    extra,
  );
}
