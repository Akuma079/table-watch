"use client";

import type { LicenseType, Platform } from "@prisma/client";
import Link from "next/link";
import { useActionState, useCallback, useState, startTransition } from "react";
import { cn } from "@/lib/cn";
import {
  ASSET_TYPE_LABELS,
  LICENSE_TYPE_HINTS,
  LICENSE_TYPE_LABELS,
  PLATFORM_LABELS,
} from "@/lib/labels";
import { createLicense } from "@/server/actions/licenses";
import { initialFormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { Field, inputClass } from "@/components/ui/Field";
import { DocumentDropzone, type UploadedDocument } from "./DocumentDropzone";

const LICENSE_TYPES: LicenseType[] = ["COMMERCIAL", "PERSONAL", "EXTENDED", "RESTRICTED"];

function SelectField({
  label,
  name,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <select id={name} name={name} className={cn(inputClass, error && "border-red-500")} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function LicenseForm() {
  const [state, action, pending] = useActionState(createLicense, initialFormState);
  const [platform, setPlatform] = useState<Platform | "">("");
  const [upload, setUpload] = useState<{ documents: UploadedDocument[]; uploading: boolean }>({
    documents: [],
    uploading: false,
  });
  const onUploadChange = useCallback((s: typeof upload) => setUpload(s), []);
  const v = state.values ?? {};
  const err = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      noValidate
      className="space-y-8"
      // Soumission manuelle : React réinitialise un <form action> après chaque envoi, ce qui
      // viderait les champs en cas d'erreur de validation.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="documents" value={JSON.stringify(upload.documents)} />

      <section className="space-y-4">
        <h2 className="font-medium">Ressource</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Titre du média ou de la piste"
            name="assetName"
            required
            placeholder="Ex. Golden Hour"
            defaultValue={v.assetName}
            error={err.assetName}
          />
          <Field
            label="Auteur / artiste"
            name="author"
            placeholder="Ex. Ikson"
            defaultValue={v.author}
            error={err.author}
          />
          <SelectField label="Type de média" name="assetType" defaultValue={v.assetType || "MUSIC"} error={err.assetType}>
            {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Plateforme source"
            name="platform"
            value={platform || v.platform || ""}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            error={err.platform}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          {(platform || v.platform) === "OTHER" && (
            <Field
              label="Nom de la plateforme"
              name="platformOther"
              placeholder="Ex. Musicvine"
              defaultValue={v.platformOther}
              error={err.platformOther}
            />
          )}
          <Field
            label="Lien de la ressource (facultatif)"
            name="sourceUrl"
            type="url"
            placeholder="https://"
            defaultValue={v.sourceUrl}
            error={err.sourceUrl}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Licence</h2>
        <fieldset>
          <legend className="sr-only">Type de licence</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {LICENSE_TYPES.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer gap-3 rounded-xl border border-neutral-200 bg-white p-4 has-[:checked]:border-neutral-900 has-[:checked]:ring-1 has-[:checked]:ring-neutral-900"
              >
                <input
                  type="radio"
                  name="licenseType"
                  value={type}
                  defaultChecked={v.licenseType === type}
                  className="mt-0.5 accent-neutral-900"
                />
                <span>
                  <span className="block text-sm font-medium">{LICENSE_TYPE_LABELS[type]}</span>
                  <span className="block text-xs text-neutral-500">{LICENSE_TYPE_HINTS[type]}</span>
                </span>
              </label>
            ))}
          </div>
          {err.licenseType && <p className="mt-2 text-xs text-red-600">{err.licenseType}</p>}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Date d'achat"
            name="purchaseDate"
            type="date"
            required
            max={today}
            defaultValue={v.purchaseDate}
            error={err.purchaseDate}
          />
          <Field
            label="Date d'expiration"
            name="expiresAt"
            type="date"
            hint="Vide si la licence est perpétuelle."
            defaultValue={v.expiresAt}
            error={err.expiresAt}
          />
          <Field
            label="N° de licence / identifiant"
            name="licenseKey"
            placeholder="Ex. ART-2026-48213"
            defaultValue={v.licenseKey}
            error={err.licenseKey}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-medium text-neutral-700">
            Notes (facultatif)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={v.notes}
            placeholder="Conditions particulières, projet concerné, compte utilisé…"
            className={inputClass}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-medium">Preuves</h2>
          <p className="text-sm text-neutral-500">
            Joignez le certificat de licence et la facture : ce sont eux qui prouvent vos droits en cas de réclamation.
          </p>
        </div>
        <DocumentDropzone onChange={onUploadChange} />
        {err.documents && <p className="text-xs text-red-600">{err.documents}</p>}
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-6">
        <Link href="/vault" className={buttonClass("ghost")}>
          Annuler
        </Link>
        <button type="submit" disabled={pending || upload.uploading} className={buttonClass("primary")}>
          {upload.uploading ? "Envoi des fichiers…" : pending ? "Enregistrement…" : "Enregistrer la licence"}
        </button>
      </div>
    </form>
  );
}
