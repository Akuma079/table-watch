import type { Metadata } from "next";
import Link from "next/link";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing-labels";
import { dateFormat } from "@/lib/labels";
import { isPaidPlan, PLANS } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { hasRole, requireWorkspace } from "@/server/auth";
import { openBillingPortal } from "@/server/actions/billing";
import { billingConfigured } from "@/server/billing/stripe";
import { BrandingForm } from "@/components/billing/BrandingForm";
import { UsageMeter } from "@/components/billing/UsageMeter";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Mon abonnement" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; changed?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { workspace, role } = await requireWorkspace();
  const canManage = hasRole(role, "ADMIN");
  const plan = PLANS[workspace.plan];
  const paid = workspace.plan !== "FREE";

  const [projects, licenses, members, sharedPassports] = await Promise.all([
    prisma.project.count({ where: { workspaceId: workspace.id } }),
    prisma.license.count({ where: { workspaceId: workspace.id } }),
    prisma.membership.count({ where: { workspaceId: workspace.id } }),
    prisma.project.count({ where: { workspaceId: workspace.id, passportEnabled: true } }),
  ]);
  const status = workspace.subscriptionStatus;
  const graceActive = workspace.passportGraceUntil && workspace.passportGraceUntil > new Date();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Mon abonnement" description={`Espace « ${workspace.name} ». L'abonnement couvre tout l'espace et ses membres.`} />

      <div className="mb-6 space-y-3">
        {params.checkout === "success" && paid && (
          <Alert tone="success">Bienvenue dans le plan {plan.name} ! Vos nouvelles fonctionnalités sont disponibles.</Alert>
        )}
        {params.checkout === "pending" && !paid && (
          <Alert tone="info">Paiement reçu, activation en cours. Actualisez la page dans quelques instants.</Alert>
        )}
        {params.changed && isPaidPlan(params.changed) && (
          <Alert tone="success">
            Forfait modifié : vous êtes maintenant en plan {plan.name}. La différence sera calculée au prorata sur votre prochaine facture.
          </Alert>
        )}
        {params.error === "unconfigured" && <Alert tone="error">Le paiement en ligne n&apos;est pas encore configuré pour ce forfait.</Alert>}
        {status === "past_due" && paid && (
          <Alert tone="error">
            Le dernier paiement a échoué. Stripe va réessayer ; mettez à jour votre moyen de paiement pour conserver le plan {plan.name}.
          </Alert>
        )}
        {graceActive && sharedPassports > 0 && (
          <Alert tone="info">
            Vos {sharedPassports} Passeport{sharedPassports > 1 ? "s" : ""} déjà partagé{sharedPassports > 1 ? "s" : ""} reste
            {sharedPassports > 1 ? "nt" : ""} consultable{sharedPassports > 1 ? "s" : ""} jusqu&apos;au{" "}
            {dateFormat.format(workspace.passportGraceUntil!)}. Reprenez un forfait Creator ou Agence pour les garder actifs.
          </Alert>
        )}
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Forfait actuel</p>
            <p className="mt-1 text-2xl font-semibold">
              {plan.name}{" "}
              <span className="text-base font-normal text-neutral-500">{plan.monthlyEur ? `${plan.monthlyEur} € TTC / mois` : "Gratuit"}</span>
            </p>
            {status && paid && (
              <p className="mt-1 text-sm text-neutral-500">
                {SUBSCRIPTION_STATUS_LABELS[status] ?? status}
                {workspace.currentPeriodEnd &&
                  (workspace.cancelAtPeriodEnd
                    ? ` · se termine le ${dateFormat.format(workspace.currentPeriodEnd)}`
                    : ` · renouvellement le ${dateFormat.format(workspace.currentPeriodEnd)}`)}
              </p>
            )}
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Link href="/pricing" className={buttonClass(workspace.plan === "AGENCY" ? "secondary" : "primary")}>
                {workspace.plan === "AGENCY" ? "Changer de forfait" : "Voir les forfaits"}
              </Link>
              {workspace.stripeCustomerId && billingConfigured() && (
                <form action={openBillingPortal}>
                  <SubmitButton variant={null} className={buttonClass("secondary")} pendingLabel="Ouverture du portail…">
                    {paid ? "Paiement, factures et résiliation" : "Factures"}
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>
        {workspace.cancelAtPeriodEnd && workspace.currentPeriodEnd && (
          <div className="mt-4">
            <Alert tone="info">
              Résiliation programmée : l&apos;espace repassera au plan Gratuit le {dateFormat.format(workspace.currentPeriodEnd)}. Vous pouvez
              l&apos;annuler depuis le portail.
            </Alert>
          </div>
        )}

        <div className="mt-6 grid gap-5 border-t border-neutral-100 pt-6 sm:grid-cols-3">
          <UsageMeter label="Projets" used={projects} max={plan.limits.projects} />
          <UsageMeter label="Licences" used={licenses} max={plan.limits.licenses} />
          <UsageMeter label="Membres" used={members} max={plan.limits.members} />
        </div>
      </section>

      {workspace.plan === "AGENCY" && canManage && (
        <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-medium">Marque blanche du Passeport de Droits</h2>
          <p className="mb-5 mt-1 text-sm text-neutral-500">
            Vos clients voient votre nom et votre couleur, sans mention de Licensio, sur la page publique et le PDF.
          </p>
          <BrandingForm brandName={workspace.brandName ?? ""} brandColor={workspace.brandColor ?? ""} fallbackName={workspace.name} />
        </section>
      )}

      {!canManage && (
        <p className="mt-6 text-sm text-neutral-500">Seuls le propriétaire et les administrateurs de l&apos;espace peuvent modifier l&apos;abonnement.</p>
      )}
    </div>
  );
}
