"use client";

import type { ComplianceStatus } from "@prisma/client";
import { useState, useTransition } from "react";
import { disablePassport, enablePassport, regeneratePassport } from "@/server/actions/projects";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { inputClass } from "@/components/ui/Field";

const STATUS_NOTE: Partial<Record<ComplianceStatus, string>> = {
  WARNING: "Le passeport affichera « Conforme, avec réserves » et listera les points à vérifier.",
  NON_COMPLIANT: "Le projet n'est pas conforme : le passeport l'indiquera clairement à votre client, sans badge « Vérifié ».",
  PENDING: "Aucune ressource déclarée : le passeport indiquera « Vérification en attente ».",
};

export function PassportPanel({
  projectId,
  url,
  status,
  canEdit,
}: {
  projectId: string;
  url: string | null; // URL publique si le lien est actif
  status: ComplianceStatus;
  canEdit: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function copy() {
    setError(null);
    startTransition(async () => {
      let link = url;
      if (!link) {
        try {
          const res = await enablePassport(projectId);
          if ("error" in res) return setError(res.error);
          link = res.url;
        } catch {
          return setError("Le lien n'a pas pu être créé. Vérifiez votre connexion et réessayez.");
        }
      }
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        setError("Copie impossible dans ce navigateur : sélectionnez le lien ci-dessous et copiez-le.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        Un certificat public, sans connexion, qui liste les ressources du projet et leurs identifiants de licence.
        Les factures et notes internes ne sont jamais affichées.
      </p>
      {STATUS_NOTE[status] && <Alert tone="info">{STATUS_NOTE[status]}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {(url || canEdit) && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} disabled={pending} className={buttonClass("primary")}>
            {copied ? "Lien copié ✓" : pending ? "Création du lien…" : "Copier le lien public client"}
          </button>
          {url && (
            <>
              <a href={url} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
                Ouvrir
              </a>
              <a href={`${url}/pdf`} className={buttonClass("secondary")}>
                Télécharger le PDF
              </a>
            </>
          )}
        </div>
      )}

      {url ? (
        <>
          <input readOnly value={url} aria-label="Lien public du passeport" onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-xs`} />
          {canEdit && (
            <div className="flex flex-wrap gap-4 text-xs">
              <ConfirmButton
                action={regeneratePassport}
                fields={{ projectId }}
                message="Générer un nouveau lien ? L'ancien cessera immédiatement de fonctionner."
                className="text-neutral-500 hover:text-neutral-900"
              >
                Générer un nouveau lien
              </ConfirmButton>
              <ConfirmButton
                action={disablePassport}
                fields={{ projectId }}
                message="Désactiver le lien public ? Les personnes qui l'ont reçu ne pourront plus consulter le passeport."
                className="text-red-600 hover:underline"
              >
                Désactiver le lien
              </ConfirmButton>
            </div>
          )}
        </>
      ) : (
        !canEdit && <p className="text-sm text-neutral-500">Le lien public n&apos;est pas activé pour ce projet.</p>
      )}
    </div>
  );
}
