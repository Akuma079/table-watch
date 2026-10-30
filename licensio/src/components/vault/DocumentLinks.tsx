"use client";

import { useRef, useState } from "react";
import { formatBytes } from "@/lib/documents";

type Doc = { id: string; fileName: string; mimeType: string; sizeBytes: number; kindLabel: string };

// Aperçu dans une fenêtre (PDF dans un iframe, image en <img>) ou téléchargement direct.
// Les deux passent par /api/documents/<id>, qui vérifie l'accès puis redirige vers une
// URL signée de courte durée.
export function DocumentLinks({ documents }: { documents: Doc[] }) {
  const [open, setOpen] = useState<Doc | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function preview(doc: Doc) {
    setOpen(doc);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <ul className="space-y-1.5">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              <span className="text-neutral-900">{doc.fileName}</span>
              <span className="text-neutral-400">
                {" "}
                · {doc.kindLabel} · {formatBytes(doc.sizeBytes)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => preview(doc)}
              className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              Aperçu
            </button>
            <a
              href={`/api/documents/${doc.id}?download=1`}
              className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              Télécharger
            </a>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="h-[90vh] w-[min(960px,95vw)] max-w-none rounded-2xl p-0 backdrop:bg-neutral-900/60"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{open.fileName}</p>
              <a href={`/api/documents/${open.id}`} target="_blank" rel="noreferrer" className="text-xs text-neutral-500 hover:text-neutral-900">
                Nouvel onglet
              </a>
              <a href={`/api/documents/${open.id}?download=1`} className="text-xs text-neutral-500 hover:text-neutral-900">
                Télécharger
              </a>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
                aria-label="Fermer l'aperçu"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 bg-neutral-100">
              {open.mimeType === "application/pdf" ? (
                <iframe src={`/api/documents/${open.id}`} title={open.fileName} className="h-full w-full" />
              ) : (
                <div className="grid h-full place-items-center overflow-auto p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL signée externe, pas d'optimisation */}
                  <img src={`/api/documents/${open.id}`} alt={open.fileName} className="max-h-full max-w-full object-contain" />
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
