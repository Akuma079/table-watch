import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { cn } from "@/lib/cn";
import { ASSET_TYPE_LABELS, dateFormat, dayFormat, LICENSE_TYPE_LABELS, PROJECT_USAGE_LABELS } from "@/lib/labels";
import { loadPassport, PASSPORT_VERDICT } from "@/server/passport/data";
import { BrandMark } from "@/components/passport/BrandMark";
import { PrintButton } from "@/components/passport/PrintButton";
import { VerdictSeal } from "@/components/passport/VerdictSeal";
import { buttonClass } from "@/components/ui/button-styles";

const getPassport = cache(loadPassport);

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const passport = await getPassport((await params).token);
  return {
    // Titre absolu : le modèle « … · Licensio » de la mise en page racine trahirait la
    // marque blanche dans l'onglet du navigateur.
    title: { absolute: passport ? `Passeport de Droits — ${passport.projectName}` : "Passeport introuvable" },
    description: passport ? `Ressources et licences du projet ${passport.projectName}, vérifiées par ${passport.issuer}.` : undefined,
    // Lien privé partagé avec le client : pas d'indexation, et le jeton ne fuit pas
    // par l'en-tête Referer vers d'autres sites.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

const ROW_STATUS = {
  OK: { label: "Licence valide", cls: "bg-green-50 text-green-700 ring-green-600/20" },
  WARNING: { label: "Avec réserve", cls: "bg-amber-50 text-amber-800 ring-amber-500/25" },
  ERROR: { label: "Non couverte", cls: "bg-red-50 text-red-700 ring-red-600/20" },
} as const;

export default async function PassportPage({ params }: Props) {
  const { token } = await params;
  const p = await getPassport(token);
  if (!p) notFound();
  const verdict = PASSPORT_VERDICT[p.status];

  const facts = [
    { label: "Projet", value: p.projectName },
    { label: "Client", value: p.clientName ?? "—" },
    { label: "Émis par", value: p.issuer },
    { label: "Usage couvert", value: PROJECT_USAGE_LABELS[p.usage] },
    { label: "Diffusion", value: p.publishedAt ? dayFormat.format(p.publishedAt) : "Non renseignée" },
    {
      label: "Vérifié le",
      value: p.verifiedAt
        ? `${dateFormat.format(p.verifiedAt)} à ${p.verifiedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}`
        : "—",
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-8 sm:py-14 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <BrandMark brand={p.brand} />
          <div className="flex gap-2">
            <PrintButton />
            <a href={`/passport/${p.token}/pdf`} className={buttonClass("primary")}>
              Télécharger le PDF
            </a>
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div aria-hidden className="h-1.5" style={{ backgroundColor: p.brand.color }} />
          <header className="border-b border-neutral-200 px-6 py-8 sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Passeport de Droits</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{p.projectName}</h1>
            <div className="mt-6">
              <VerdictSeal status={p.status} title={verdict.title} />
              <p className="mt-3 max-w-2xl text-sm text-neutral-600">{verdict.subtitle}</p>
            </div>
          </header>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-neutral-200 px-6 py-6 sm:grid-cols-3 sm:px-10">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-neutral-400">{f.label}</dt>
                <dd className="mt-1 break-words text-sm font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>

          <section className="px-6 py-6 sm:px-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Ressources utilisées ({p.assets.length})
            </h2>
            {p.assets.length === 0 ? (
              <p className="text-sm text-neutral-500">Aucune ressource déclarée.</p>
            ) : (
              <ol className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                {p.assets.map((a, i) => {
                  const status = ROW_STATUS[a.severity];
                  return (
                    <li key={i} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:px-5">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {a.name}
                          {a.author && <span className="font-normal text-neutral-500"> — {a.author}</span>}
                        </p>
                        {a.licenseName && <p className="mt-0.5 text-sm text-neutral-600">Licence : {a.licenseName}</p>}
                        <p className="mt-0.5 text-sm text-neutral-500">
                          {[ASSET_TYPE_LABELS[a.assetType], a.platform, a.licenseType && `Licence ${LICENSE_TYPE_LABELS[a.licenseType].toLowerCase()}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {a.licenseType && (
                          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                            <span>
                              Identifiant :{" "}
                              <span className="font-mono text-neutral-800">{a.licenseKey ?? "non renseigné"}</span>
                            </span>
                            {a.purchaseDate && <span>Acquise le {dayFormat.format(a.purchaseDate)}</span>}
                            <span>{a.expiresAt ? `Valable jusqu'au ${dayFormat.format(a.expiresAt)}` : "Sans date d'expiration"}</span>
                          </p>
                        )}
                        {a.notes.map((n) => (
                          <p key={n} className={cn("mt-2 text-xs", a.severity === "ERROR" ? "text-red-700" : "text-amber-800")}>
                            {n}
                          </p>
                        ))}
                      </div>
                      <span className={cn("h-fit w-fit rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", status.cls)}>
                        {status.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <footer className="border-t border-neutral-200 bg-neutral-50 px-6 py-5 text-xs leading-relaxed text-neutral-500 sm:px-10">
            {p.verificationId && (
              <p className="mb-2 font-mono text-neutral-700">N° de vérification : {p.verificationId}</p>
            )}
            <p>
              Ce passeport recoupe les ressources déclarées par {p.issuer} avec les licences et preuves d&apos;achat
              enregistrées dans son coffre-fort {p.brand.whiteLabel ? "de licences" : "Licensio"}, à la date de vérification indiquée. Il ne remplace pas les
              conditions de licence des plateformes, qui font foi. Cette page est mise à jour en continu : la version en
              ligne prévaut sur toute copie imprimée.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
