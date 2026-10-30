"use client";

import type { DocumentKind } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MAX_FILES,
  formatBytes,
  isAllowedDocumentType,
} from "@/lib/documents";
import { DOCUMENT_KIND_LABELS } from "@/lib/labels";
import { discardDocumentUpload, prepareDocumentUpload } from "@/server/actions/licenses";

export type UploadedDocument = { storagePath: string; fileName: string; kind: DocumentKind };

type Item = {
  id: string;
  name: string;
  size: number;
  kind: DocumentKind;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  storagePath?: string;
};

type Props = {
  onChange: (state: { documents: UploadedDocument[]; uploading: boolean }) => void;
};

// Devine la nature du document d'après son nom ; l'utilisateur peut corriger.
function guessKind(name: string): DocumentKind {
  const n = name.toLowerCase();
  if (/(invoice|facture|factuur)/.test(n)) return "INVOICE";
  if (/(receipt|recu|reçu)/.test(n)) return "RECEIPT";
  return "LICENSE_CERTIFICATE";
}

// Envoi direct vers Supabase Storage par l'URL signée (PUT), avec suivi de progression.
function putFile(signedUrl: string, file: File, onProgress: (pct: number) => void) {
  const xhr = new XMLHttpRequest();
  const done = new Promise<void>((resolve, reject) => {
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("abort"));
  });
  xhr.open("PUT", signedUrl);
  xhr.setRequestHeader("content-type", file.type);
  xhr.setRequestHeader("cache-control", "max-age=3600");
  xhr.setRequestHeader("x-upsert", "false");
  xhr.send(file);
  return { xhr, done };
}

export function DocumentDropzone({ onChange }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requests = useRef(new Map<string, XMLHttpRequest>());

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  useEffect(() => {
    onChange({
      documents: items
        .filter((it) => it.status === "done" && it.storagePath)
        .map((it) => ({ storagePath: it.storagePath!, fileName: it.name, kind: it.kind })),
      uploading: items.some((it) => it.status === "uploading"),
    });
  }, [items, onChange]);

  async function upload(item: Item, file: File) {
    let prepared: Awaited<ReturnType<typeof prepareDocumentUpload>>;
    try {
      prepared = await prepareDocumentUpload({ fileName: file.name, mimeType: file.type, size: file.size });
    } catch {
      // Réseau coupé ou session expirée : le fichier ne doit pas rester « en cours » indéfiniment.
      return update(item.id, { status: "error", error: "Connexion au serveur impossible. Retirez le fichier et réessayez." });
    }
    if ("error" in prepared) return update(item.id, { status: "error", error: prepared.error });

    const { xhr, done } = putFile(prepared.signedUrl, file, (progress) => update(item.id, { progress }));
    requests.current.set(item.id, xhr);
    try {
      await done;
      update(item.id, { status: "done", progress: 100, storagePath: prepared.path });
    } catch (e) {
      if ((e as Error).message !== "abort") {
        update(item.id, { status: "error", error: "L'envoi a échoué. Retirez le fichier et réessayez." });
      }
    } finally {
      requests.current.delete(item.id);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = DOCUMENT_MAX_FILES - items.filter((it) => it.status !== "error").length;
    Array.from(list).forEach((file, i) => {
      const item: Item = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        kind: guessKind(file.name),
        status: "uploading",
        progress: 0,
      };
      let error: string | undefined;
      if (i >= room) error = `${DOCUMENT_MAX_FILES} fichiers maximum par licence.`;
      else if (!isAllowedDocumentType(file.type)) error = "Format non accepté (PDF, PNG, JPEG ou WebP).";
      else if (file.size > DOCUMENT_MAX_BYTES) error = "Fichier trop lourd (15 Mo max).";

      if (error) {
        setItems((prev) => [...prev, { ...item, status: "error", error }]);
      } else {
        setItems((prev) => [...prev, item]);
        void upload(item, file);
      }
    });
  }

  function remove(item: Item) {
    requests.current.get(item.id)?.abort();
    if (item.storagePath) void discardDocumentUpload(item.storagePath);
    setItems((prev) => prev.filter((it) => it.id !== item.id));
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Ajouter des fichiers de preuve"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
          dragging ? "border-neutral-900 bg-neutral-100" : "border-neutral-300 bg-neutral-50 hover:border-neutral-400",
        )}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="mb-3 h-8 w-8 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <p className="text-sm font-medium">Glissez vos fichiers ici ou cliquez pour parcourir</p>
        <p className="mt-1 text-xs text-neutral-500">
          Certificat de licence, facture ou reçu · PDF, PNG, JPEG, WebP · 15 Mo max · {DOCUMENT_MAX_FILES} fichiers max
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {items.map((it) => (
            <li key={it.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-[10px] font-semibold uppercase text-neutral-500"
                >
                  {it.name.split(".").pop()?.slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.name}</p>
                  <p className={cn("text-xs", it.status === "error" ? "text-red-600" : "text-neutral-500")}>
                    {it.status === "error"
                      ? it.error
                      : it.status === "uploading"
                        ? `Envoi… ${it.progress} %`
                        : `${formatBytes(it.size)} · envoyé`}
                  </p>
                </div>
                {it.status === "done" && (
                  <select
                    aria-label={`Type de document pour ${it.name}`}
                    value={it.kind}
                    onChange={(e) => update(it.id, { kind: e.target.value as DocumentKind })}
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs"
                  >
                    {Object.entries(DOCUMENT_KIND_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => remove(it)}
                  className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label={`Retirer ${it.name}`}
                >
                  Retirer
                </button>
              </div>
              {it.status === "uploading" && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full bg-neutral-900 transition-[width]" style={{ width: `${it.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
