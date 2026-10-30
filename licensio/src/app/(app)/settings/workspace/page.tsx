import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";
import { ROLE_LABELS } from "@/lib/labels";
import { hasRole, requireWorkspace } from "@/server/auth";
import { leaveWorkspace } from "@/server/actions/workspaces";
import { DeleteWorkspaceForm, TransferOwnershipForm } from "@/components/settings/DangerForms";
import { RenameWorkspaceForm } from "@/components/workspace/RenameWorkspaceForm";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Paramètres de l'espace" };

const card = "rounded-xl border border-neutral-200 bg-white p-6";

export default async function WorkspaceSettingsPage({ searchParams }: { searchParams: Promise<{ transferred?: string }> }) {
  const ctx = await requireWorkspace();
  const isOwner = ctx.role === "OWNER";
  const { transferred } = await searchParams;

  const [others, counts] = await Promise.all([
    isOwner
      ? prisma.membership.findMany({
          where: { workspaceId: ctx.workspace.id, userId: { not: ctx.user.id } },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : [],
    isOwner
      ? Promise.all([
          prisma.license.count({ where: { workspaceId: ctx.workspace.id } }),
          prisma.project.count({ where: { workspaceId: ctx.workspace.id } }),
        ])
      : [0, 0],
  ]);
  const [licenses, projects] = counts;
  const subscribed = Boolean(ctx.workspace.stripeSubscriptionId);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Paramètres de l'espace" description={`« ${ctx.workspace.name} » · vous êtes ${ROLE_LABELS[ctx.role].toLowerCase()}.`} />
      {transferred && <Alert tone="success">Propriété transférée. Vous êtes maintenant administrateur de cet espace.</Alert>}

      {hasRole(ctx.role, "ADMIN") && (
        <section className={card}>
          <RenameWorkspaceForm name={ctx.workspace.name} />
        </section>
      )}

      {isOwner && (
        <section className={card}>
          <h2 className="font-medium">Transférer la propriété</h2>
          <p className="mb-4 mt-1 text-sm text-neutral-500">
            Le nouveau propriétaire gère l&apos;abonnement, les administrateurs et la suppression de l&apos;espace. Vous en restez administrateur.
          </p>
          {others.length > 0 ? (
            <TransferOwnershipForm
              members={others.map((m) => ({ id: m.id, label: `${m.user.name ?? m.user.email} (${ROLE_LABELS[m.role].toLowerCase()})` }))}
            />
          ) : (
            <p className="text-sm text-neutral-500">Invitez d&apos;abord la personne dans l&apos;espace (page « Membres »).</p>
          )}
        </section>
      )}

      {!isOwner && (
        <section className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h2 className="font-medium">Quitter cet espace</h2>
            <p className="text-sm text-neutral-500">Vous perdrez l&apos;accès à ses projets et à son coffre-fort.</p>
          </div>
          <ConfirmButton
            action={leaveWorkspace}
            fields={{}}
            message={`Quitter « ${ctx.workspace.name} » ? Il faudra une nouvelle invitation pour y revenir.`}
            className={buttonClass("danger", "shrink-0")}
            pendingLabel="Départ…"
          >
            Quitter l&apos;espace
          </ConfirmButton>
        </section>
      )}

      {isOwner && (
        <section className="rounded-xl border border-red-200 bg-white p-6">
          <h2 className="font-medium text-red-700">Supprimer l&apos;espace</h2>
          <ul className="mb-5 mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
            <li>
              {licenses} licence{licenses > 1 ? "s" : ""} et leurs preuves, {projects} projet{projects > 1 ? "s" : ""} et leurs audits,
              invitations et accès des membres : tout est effacé définitivement.
            </li>
            <li>Les liens de Passeport de Droits déjà envoyés cessent de fonctionner.</li>
            {subscribed && (
              <li>
                L&apos;abonnement {PLANS[ctx.workspace.plan].name} est résilié immédiatement, sans remboursement de la période en cours.
                Vos factures restent disponibles chez Stripe.
              </li>
            )}
          </ul>
          <DeleteWorkspaceForm name={ctx.workspace.name} />
        </section>
      )}
    </div>
  );
}
