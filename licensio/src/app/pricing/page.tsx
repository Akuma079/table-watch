import type { Metadata } from "next";
import Link from "next/link";
import type { WorkspacePlan } from "@prisma/client";
import { cn } from "@/lib/cn";
import { PASSPORT_GRACE_DAYS, PLANS } from "@/lib/plans";
import { getAuthUser, hasRole, requireWorkspace } from "@/server/auth";
import { startCheckout } from "@/server/actions/billing";
import { billingConfigured, taxEnabled } from "@/server/billing/stripe";
import { Logo } from "@/components/app/Logo";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { SubmitButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Tarifs" };

const ORDER: WorkspacePlan[] = ["FREE", "CREATOR", "AGENCY"];
const RANK: Record<WorkspacePlan, number> = { FREE: 0, CREATOR: 1, AGENCY: 2 };

const COMPARISON: { label: string; values: Record<WorkspacePlan, string> }[] = [
  { label: "Projets audités", values: { FREE: "1", CREATOR: "5", AGENCY: "Illimités" } },
  { label: "Licences au coffre-fort", values: { FREE: "10", CREATOR: "50", AGENCY: "Illimitées" } },
  { label: "Preuves (PDF, factures) et téléchargement", values: { FREE: "✓", CREATOR: "✓", AGENCY: "✓" } },
  { label: "Audit de conformité et recommandations", values: { FREE: "✓", CREATOR: "✓", AGENCY: "✓" } },
  { label: "Passeport de Droits (lien client + PDF)", values: { FREE: "—", CREATOR: "✓", AGENCY: "✓" } },
  { label: "Marque blanche (votre nom, votre couleur)", values: { FREE: "—", CREATOR: "—", AGENCY: "✓" } },
  { label: "Utilisateurs", values: { FREE: "1", CREATOR: "1", AGENCY: "Illimités, avec rôles" } },
];

const FAQ = [
  {
    q: "L'abonnement est-il par utilisateur ?",
    a: "Non : il couvre tout l'espace de travail. Avec le plan Agence, invitez autant de collaborateurs que nécessaire sans surcoût.",
  },
  {
    q: "Puis-je changer de forfait ?",
    a: "Oui, à tout moment depuis cette page : la différence est calculée au prorata sur votre prochaine facture.",
  },
  {
    q: "Que se passe-t-il si je repasse au plan Gratuit ?",
    a: `Vos projets, licences et preuves sont conservés ; au-delà des limites, vous ne pouvez plus en créer. Les Passeports déjà envoyés à vos clients restent consultables ${PASSPORT_GRACE_DAYS} jours, puis leurs liens cessent de répondre jusqu'à votre retour sur un forfait payant.`,
  },
  { q: "Puis-je résilier à tout moment ?", a: "Oui, depuis « Mon abonnement ». Le forfait reste actif jusqu'à la fin de la période payée." },
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const user = await getAuthUser();
  const ctx = user ? await requireWorkspace() : null;
  const current: WorkspacePlan | null = ctx?.workspace.plan ?? null;
  const canManage = ctx ? hasRole(ctx.role, "ADMIN") : false;
  const subscribed = Boolean(ctx?.workspace.stripeSubscriptionId);

  function cta(key: WorkspacePlan) {
    if (!ctx) {
      return (
        <Link href={key === "FREE" ? "/register" : "/register?next=/pricing"} className={buttonClass(key === "AGENCY" ? "primary" : "secondary", "w-full")}>
          {key === "FREE" ? "Commencer gratuitement" : "Créer un compte"}
        </Link>
      );
    }
    if (current === key) return <p className="py-2 text-center text-sm font-medium text-neutral-500">Votre forfait actuel</p>;
    if (key === "FREE") {
      return subscribed && canManage ? (
        <Link href="/settings/billing" className={buttonClass("ghost", "w-full")}>
          Résilier depuis « Mon abonnement »
        </Link>
      ) : null;
    }
    if (!canManage) return <p className="text-center text-xs text-neutral-500">Demandez à un administrateur de l&apos;espace.</p>;
    const up = RANK[key] > RANK[current!];
    const configured = billingConfigured(key);
    return (
      <form action={startCheckout}>
        <input type="hidden" name="plan" value={key} />
        <SubmitButton variant={null}
          disabled={!configured}
          className={buttonClass(up ? "primary" : "secondary", "w-full")}
          pendingLabel={subscribed ? "Changement de forfait…" : "Redirection vers le paiement…"}
        >
          {!configured ? "Paiement bientôt disponible" : `${up ? "Passer" : "Revenir"} au plan ${PLANS[key].name}`}
        </SubmitButton>
        {subscribed && configured && (
          <p className="mt-2 text-center text-xs text-neutral-500">Changement immédiat, calculé au prorata.</p>
        )}
      </form>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex items-center justify-between">
          <Link href={ctx ? "/dashboard" : "/"}>
            <Logo />
          </Link>
          <Link href={ctx ? "/dashboard" : "/login"} className="text-sm text-neutral-500 hover:text-neutral-900">
            {ctx ? "Retour à l'application" : "Se connecter"}
          </Link>
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Des licences en ordre, des clients rassurés</h1>
          <p className="mt-3 text-neutral-500">
            Commencez gratuitement. Passez à Creator pour remettre un Passeport de Droits à vos clients, à Agence pour toute votre équipe.
          </p>
        </div>

        {checkout === "cancelled" && (
          <div className="mx-auto mt-8 max-w-xl">
            <Alert tone="info">Paiement annulé : rien n&apos;a été débité.</Alert>
          </div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {ORDER.map((key) => {
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
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {current === key ? (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">Votre forfait</span>
                  ) : featured ? (
                    <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">Pour les agences</span>
                  ) : null}
                </div>
                <p className="mt-1 min-h-10 text-sm text-neutral-500">{plan.tagline}</p>
                <p className="mt-6">
                  <span className="text-4xl font-semibold tracking-tight">{plan.monthlyEur} €</span>
                  <span className="text-neutral-500"> / mois{plan.monthlyEur ? " TTC" : ""}</span>
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
                <div className="mt-8 min-h-10">{cta(key)}</div>
              </div>
            );
          })}
        </div>
        {taxEnabled() && (
          <p className="mt-4 text-center text-xs text-neutral-500">
            Prix TVA comprise. Entreprises de l&apos;UE : saisissez votre n° de TVA lors du paiement.
          </p>
        )}

        <div className="relative mt-14 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[600px] text-left text-sm">
            <caption className="sr-only">Comparaison des forfaits</caption>
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Fonctionnalité</th>
                {ORDER.map((k) => (
                  <th key={k} className="px-5 py-3 font-medium">
                    {PLANS[k].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <td className="px-5 py-3">{row.label}</td>
                  {ORDER.map((k) => (
                    <td key={k} className={cn("px-5 py-3", k === "AGENCY" ? "font-medium" : "text-neutral-600")}>
                      {row.values[k]}
                    </td>
                  ))}
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
