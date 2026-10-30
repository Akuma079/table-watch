"use client";

import type { ProjectUsage } from "@prisma/client";
import Link from "next/link";
import { startTransition, useActionState, useCallback, useState } from "react";
import type { ParsedAsset } from "@/lib/asset-parse";
import { PROJECT_USAGE_HINTS, PROJECT_USAGE_LABELS } from "@/lib/labels";
import { createProject, updateProject } from "@/server/actions/projects";
import { initialFormState } from "@/server/actions/types";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { Field, inputClass } from "@/components/ui/Field";
import { AssetEditor } from "./AssetEditor";

const USAGES: ProjectUsage[] = ["COMMERCIAL", "BROADCAST", "PERSONAL"];

// Sans `projectId` : création (avec les ressources) ; avec : modification des
// informations générales, pré-remplies par `initial`.
export function ProjectForm({ projectId, initial = {} }: { projectId?: string; initial?: Record<string, string> }) {
  const [state, action, pending] = useActionState(projectId ? updateProject : createProject, initialFormState);
  const [assets, setAssets] = useState<ParsedAsset[]>([]);
  const onAssets = useCallback((a: ParsedAsset[]) => setAssets(a), []);
  const v = state.values ?? initial;
  const err = state.fieldErrors ?? {};

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {projectId ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : (
        <input type="hidden" name="assets" value={JSON.stringify(assets)} />
      )}

      <section className="space-y-4">
        <h2 className="font-medium">Projet</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nom du projet"
            name="name"
            required
            placeholder="Ex. Vidéo Pub Client X - YouTube"
            defaultValue={v.name}
            error={err.name}
          />
          <Field label="Client (facultatif)" name="clientName" placeholder="Ex. Client X" defaultValue={v.clientName} error={err.clientName} />
          <Field
            label="Date de diffusion (facultatif)"
            name="publishedAt"
            type="date"
            hint="Sert à vérifier que les licences sont valables à cette date."
            defaultValue={v.publishedAt}
            error={err.publishedAt}
          />
          <Field
            label="Lien de la vidéo (facultatif)"
            name="mediaUrl"
            type="url"
            placeholder="https://youtube.com/… ou Google Drive"
            defaultValue={v.mediaUrl}
            error={err.mediaUrl}
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-neutral-700">Usage de la vidéo</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {USAGES.map((u) => (
              <label
                key={u}
                className="flex cursor-pointer gap-3 rounded-xl border border-neutral-200 bg-white p-4 has-[:checked]:border-neutral-900 has-[:checked]:ring-1 has-[:checked]:ring-neutral-900"
              >
                <input type="radio" name="usage" value={u} defaultChecked={(v.usage || "COMMERCIAL") === u} className="mt-0.5 accent-neutral-900" />
                <span>
                  <span className="block text-sm font-medium">{PROJECT_USAGE_LABELS[u]}</span>
                  <span className="block text-xs text-neutral-500">{PROJECT_USAGE_HINTS[u]}</span>
                </span>
              </label>
            ))}
          </div>
          {err.usage && <p className="mt-2 text-xs text-red-600">{err.usage}</p>}
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor="description" className="block text-sm font-medium text-neutral-700">
            Notes (facultatif)
          </label>
          <textarea id="description" name="description" rows={2} defaultValue={v.description} className={inputClass} />
        </div>
      </section>

      {!projectId && (
      <section className="space-y-4">
        <div>
          <h2 className="font-medium">Ressources utilisées dans le montage</h2>
          <p className="text-sm text-neutral-500">
            Musiques, effets sonores, plans vidéo, images. Chacune sera comparée à votre coffre-fort.
          </p>
        </div>
        <AssetEditor onChange={onAssets} />
      </section>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-6">
        <Link href={projectId ? `/projects/${projectId}` : "/projects"} className={buttonClass("ghost")}>
          Annuler
        </Link>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending
            ? "Audit en cours…"
            : projectId
              ? "Enregistrer et ré-auditer"
              : `Créer et auditer${assets.length ? ` (${assets.length} ressource${assets.length > 1 ? "s" : ""})` : ""}`}
        </button>
      </div>
    </form>
  );
}
