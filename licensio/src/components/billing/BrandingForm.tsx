"use client";

import { useActionState, useState } from "react";
import { updateBranding } from "@/server/actions/billing";
import { initialFormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function BrandingForm({ brandName, brandColor, fallbackName }: { brandName: string; brandColor: string; fallbackName: string }) {
  const [state, action] = useActionState(updateBranding, initialFormState);
  const v = state.values ?? { brandName, brandColor };
  const [color, setColor] = useState(v.brandColor || "#171717");
  const [name, setName] = useState(v.brandName ?? "");
  const shown = name.trim() || fallbackName;

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field
          label="Nom affiché sur les passeports"
          name="brandName"
          placeholder={fallbackName}
          hint="Vide : le nom de l'espace."
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={state.fieldErrors?.brandName}
        />
        <div className="space-y-1.5">
          <label htmlFor="brandColor" className="block text-sm font-medium text-neutral-700">
            Couleur
          </label>
          <div className="flex items-center gap-2">
            <input
              id="brandColorPicker"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Choisir la couleur"
              className="h-9 w-12 cursor-pointer rounded border border-neutral-300 bg-white"
            />
            <input
              id="brandColor"
              name="brandColor"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-24 rounded-lg border border-neutral-300 px-2 py-2 font-mono text-sm"
            />
          </div>
          {state.fieldErrors?.brandColor && <p className="text-xs text-red-600">{state.fieldErrors.brandColor}</p>}
        </div>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4" aria-label="Aperçu">
        <p className="text-xs uppercase tracking-wide text-neutral-400">Aperçu de l&apos;en-tête</p>
        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="h-1.5" style={{ backgroundColor: color }} />
          <div className="flex items-center gap-2 p-3 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-sm text-white" style={{ backgroundColor: color }}>
              {shown.charAt(0).toUpperCase()}
            </span>
            {shown}
          </div>
        </div>
      </div>
      <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
    </form>
  );
}
