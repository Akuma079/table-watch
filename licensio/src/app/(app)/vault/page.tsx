import type { Metadata } from "next";
import Link from "next/link";
import type { LicenseType, Platform, Prisma } from "@prisma/client";
import { DOCUMENT_MAX_FILES } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { dayFormat, DOCUMENT_KIND_LABELS, LICENSE_TYPE_LABELS, PLATFORM_LABELS, ASSET_TYPE_LABELS } from "@/lib/labels";
import { hasRole, requireWorkspace } from "@/server/auth";
import { AttachDocumentsForm } from "@/components/vault/AttachDocumentsForm";
import { DeleteLicenseButton } from "@/components/vault/DeleteLicenseButton";
import { DocumentLinks } from "@/components/vault/DocumentLinks";
import { ExpiryBadge, LicenseTypeBadge } from "@/components/vault/LicenseBadges";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Coffre-fort" };

type Search = { q?: string; platform?: string; type?: string; added?: string };

export default async function VaultPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { workspace, role } = await requireWorkspace();
  const { q = "", platform = "", type = "", added } = await searchParams;
  const canEdit = hasRole(role, "MEMBER");

  const where: Prisma.LicenseWhereInput = { workspaceId: workspace.id };
  if (q.trim()) {
    where.OR = [
      { assetName: { contains: q.trim(), mode: "insensitive" } },
      { author: { contains: q.trim(), mode: "insensitive" } },
      { licenseKey: { contains: q.trim(), mode: "insensitive" } },
    ];
  }
  if (platform in PLATFORM_LABELS) where.platform = platform as Platform;
  if (type in LICENSE_TYPE_LABELS) where.licenseType = type as LicenseType;
  const filtered = Boolean(q.trim() || where.platform || where.licenseType);

  const [licenses, total] = await Promise.all([
    prisma.license.findMany({
      where,
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
      include: {
        documents: {
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true, kind: true },
          orderBy: { createdAt: "asc" },
        },
      },
      take: 200,
    }),
    prisma.license.count({ where: { workspaceId: workspace.id } }),
  ]);
  const addedLicense = added ? licenses.find((l) => l.id === added) : undefined;

  return (
    <>
      <PageHeader
        title="Coffre-fort"
        description={`${total} licence${total > 1 ? "s" : ""} · ${workspace.name}`}
        actions={
          canEdit && (
            <Link href="/vault/new" className={buttonClass("primary")}>
              Ajouter une licence
            </Link>
          )
        }
      />

      {addedLicense && (
        <div className="mb-6">
          <Alert tone="success">Licence « {addedLicense.assetName} » ajoutée au coffre-fort.</Alert>
        </div>
      )}

      {total > 0 && (
        <form className="mb-6 flex flex-col gap-2 sm:flex-row" role="search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher un titre, un artiste, un n° de licence…"
            aria-label="Rechercher"
            className={`${inputClass} sm:flex-1`}
          />
          <select name="platform" defaultValue={platform} aria-label="Plateforme" className={`${inputClass} sm:w-44`}>
            <option value="">Toutes les plateformes</option>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={type} aria-label="Type de licence" className={`${inputClass} sm:w-44`}>
            <option value="">Tous les types</option>
            {Object.entries(LICENSE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass("secondary")}>
            Filtrer
          </button>
        </form>
      )}

      {licenses.length === 0 ? (
        filtered ? (
          <EmptyState title="Aucune licence ne correspond à ces filtres">
            <Link href="/vault" className="underline">
              Effacer les filtres
            </Link>
          </EmptyState>
        ) : (
          <EmptyState title="Votre coffre-fort est vide">
            Ajoutez vos licences Artlist, Envato, Epidemic Sound… avec leurs certificats et factures.
            {canEdit && (
              <div className="mt-4">
                <Link href="/vault/new" className={buttonClass("primary")}>
                  Ajouter une première licence
                </Link>
              </div>
            )}
          </EmptyState>
        )
      ) : (
        <ul className="space-y-3">
          {licenses.map((l) => (
            <li key={l.id} className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-medium">{l.assetName}</h2>
                    <LicenseTypeBadge type={l.licenseType} />
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    {[
                      l.author,
                      l.platform === "OTHER" ? l.platformOther : PLATFORM_LABELS[l.platform],
                      ASSET_TYPE_LABELS[l.assetType],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <span className="text-xs text-neutral-500">Achetée le {dayFormat.format(l.purchaseDate)}</span>
                  <ExpiryBadge expiresAt={l.expiresAt} revokedAt={l.revokedAt} />
                  {l.licenseKey && <span className="font-mono text-xs text-neutral-500">{l.licenseKey}</span>}
                </div>
              </div>

              <div className="mt-4 border-t border-neutral-100 pt-3">
                {l.documents.length > 0 ? (
                  <DocumentLinks
                    documents={l.documents.map((d) => ({
                      id: d.id,
                      fileName: d.fileName,
                      mimeType: d.mimeType,
                      sizeBytes: d.sizeBytes,
                      kindLabel: DOCUMENT_KIND_LABELS[d.kind],
                    }))}
                  />
                ) : (
                  <p className="text-sm text-amber-700">Aucune preuve jointe à cette licence.</p>
                )}
              </div>

              {canEdit && (
                <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {l.documents.length < DOCUMENT_MAX_FILES && (
                      <AttachDocumentsForm licenseId={l.id} defaultOpen={l.documents.length === 0 && licenses.length === 1} />
                    )}
                  </div>
                  <DeleteLicenseButton licenseId={l.id} assetName={l.assetName} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
