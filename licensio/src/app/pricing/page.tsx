import type { Metadata } from "next";
import Link from "next/link";
import type { WorkspacePlan } from "@prisma/client";
import { cn } from "@/lib/cn";
import { PLANS } from "@/lib/plans";
import { getAuthUser, hasRole, requireWorkspace } from "@/server/auth";
import { startAgencyCheckout } from "@/server/actions/billing";
import { billingConfigured } from "@/server/billing/stripe";
import { Logo } from "@/components/app/Logo";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Tarifs" };

const COMPARISON: { label: string; creator: string; agency: string }[] = [
  { label: "Projets audités", creator: "5", agency: "Illimités" },
  { label: "Licences au coffre-fort", creator: "50", agency: "Illimitées" },
  { label: "Preuves (PDF, factures) et téléchargement", creator: "✓", agency: "✓" },
  { label: "Audit de conformité et recommandations", creator: "✓", agency: "✓" },
  { label: "Passeport de Droits (lien client + PDF)", creator: "—", agency: "✓" },
  { label: "Marque blanche (votre nom, votre couleur)", creator: "—", agency: "✓" },
  { label: "Utilisateurs", creator: "1", agency: "Illimités, avec rôles" },
];

const FAQ = [
  {
    q: "L'abonnement est-il par utilisateur ?",
    a: "Non : il couvre tout l'espace de travail. Invitez autant de collaborateurs que nécessaire sans surcoût.",
  },
  {
    q: "Que se passe-t-il si je repasse au plan Creator ?",
    a: "Vos projets, licences et preuves sont conservés. Au-delà des limites, vous ne pouvez plus en créer de nouveaux, et les liens publics des Passeports cessent de répondre jusqu'à votre retour au plan Agence.",
  },
  { q: "Puis-je résilier à tout moment ?", a: "Oui, depuis « Mon abonnement ». Le plan Agence reste actif jusqu'à la fin de la période payée." },
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const user = await getAuthUser();
  const ctx = user ? await requireWorkspace() : null;
  const current: WorkspacePlan | null = ctx?.workspace.plan ?? null;
  const canManage = ctx ? hasRole(ctx.role, "ADMIN") : false;
  const configured = billingConfigured();

  function agencyCta() {
    if (!ctx) {
      return (
        <Link href="/register?next=/pricing" className={buttonClass("primary", "w-full")}>
          Créer un compte
        </Link>
      );
    }
    if (current === "AGENCY") {
      return (
        <Link href="/settings/billing" className={buttonClass("secondary", "w-full")}>
          Gérer mon abonnement
        </Link>
      );
    }
    if (!canManage) return <p className="text-center text-xs text-neutral-500">Demandez à un administrateur de l&apos;espace.</p>;
    return (
      <form action={startAgencyCheckout}>
        <button type="submit" disabled={!configured} className={buttonClass("primary", "w-full")}>
          {configured ? "Passer au plan Agence" : "Paiement bientôt disponible"}
        </button>
      </form>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 flex items-center justify-between">
          <Link href={ctx ? "/dashboard" : "/"}>
            <Logo />
          </Link>
          {ctx ? (
            <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900">
              Retour à l&apos;application
            </Link>
          ) : (
            <Link href="/login" className="text-sm text-neutral-500 hover:text-neutral-900">
              Se connecter
            </Link>
          )}
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Des licences en ordre, des clients rassurés</h1>
          <p className="mt-3 text-neutral-500">
            Commencez gratuitement. Passez au plan Agence pour remettre un Passeport de Droits à chaque client.
          </p>
        </div>

        {checkout === "cancelled" && (
          <div className="mx-auto mt-8 max-w-xl">
            <Alert tone="info">Paiement annulé : rien n&apos;a été débité.</Alert>
          </div>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {(["CREATOR", "AGENCY"] as const).map((key) => {
            const plan = PLANS[key];
            const featured = key === "AGENCY";
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col rounded-2xl border bg-white p-7",
                  featured ? "border-neutral-900 shadow-lg ring-1 ring-neutral-900" : "border-neutral-200",
                )}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {current === key && (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">Votre plan</span>
                  )}
                  {featured && current !== key && (
                    <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">Pour les agences</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-500">{plan.tagline}</p>
                <p className="mt-6">
                  <span className="text-4xl font-semibold tracking-tight">{plan.monthlyEur ? `${plan.monthlyEur} €` : "0 €"}</span>
                  <span className="text-neutral-500"> / mois</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-green-600" fill="currentColor">
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
                      </svg>
                      {h}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  {key === "CREATOR" ? (
                    ctx ? (
                      <p className="py-2 text-center text-sm text-neutral-500">{current === "CREATOR" ? "Plan actuel" : "Inclus"}</p>
                    ) : (
                      <Link href="/register" className={buttonClass("secondary", "w-full")}>
                        Commencer gratuitement
                      </Link>
                    )
                  ) : (
                    agencyCta()
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-14 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Comparaison des plans</caption>
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Fonctionnalité</th>
                <th className="px-5 py-3 font-medium">Creator</th>
                <th className="px-5 py-3 font-medium">Agence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <td className="px-5 py-3">{row.label}</td>
                  <td className="px-5 py-3 text-neutral-600">{row.creator}</td>
                  <td className="px-5 py-3 font-medium">{row.agency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mx-auto mt-14 max-w-2xl space-y-6">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="font-medium">{f.q}</h3>
              <p className="mt-1 text-sm text-neutral-500">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
