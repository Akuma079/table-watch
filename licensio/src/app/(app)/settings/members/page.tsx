import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dateFormat, ROLE_LABELS } from "@/lib/labels";
import { hasRole, requireWorkspace } from "@/server/auth";
import { removeMember, revokeInvitation, updateMemberRole } from "@/server/actions/workspaces";
import { InviteForm } from "@/components/workspace/InviteForm";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Membres" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const ctx = await requireWorkspace();
  if (!hasRole(ctx.role, "ADMIN")) redirect("/dashboard");
  const isOwner = ctx.role === "OWNER";

  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { workspaceId: ctx.workspace.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      {(await searchParams).created && (
        <div className="mb-6">
          <Alert tone="success">Espace « {ctx.workspace.name} » créé. Invitez maintenant vos collaborateurs.</Alert>
        </div>
      )}
      <PageHeader title="Membres" description={`Qui a accès à « ${ctx.workspace.name} ».`} />

      <section className="mb-10 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-medium">Inviter un collaborateur</h2>
        <InviteForm canInviteAdmin={isOwner} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-medium">Membres ({members.length})</h2>
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {members.map((m) => {
            const editable = m.role !== "OWNER" && m.userId !== ctx.user.id;
            const removable = editable && (m.role !== "ADMIN" || isOwner);
            return (
              <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.user.name ?? m.user.email}
                    {m.userId === ctx.user.id && <span className="ml-2 text-xs text-neutral-400">(vous)</span>}
                  </p>
                  <p className="truncate text-sm text-neutral-500">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {isOwner && editable ? (
                    <form action={updateMemberRole} className="flex items-center gap-2">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        aria-label={`Rôle de ${m.user.email}`}
                        className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                      >
                        <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                        <option value="MEMBER">{ROLE_LABELS.MEMBER}</option>
                        <option value="VIEWER">{ROLE_LABELS.VIEWER}</option>
                      </select>
                      <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-900">
                        Enregistrer
                      </button>
                    </form>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                  {removable && (
                    <form action={removeMember}>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Retirer
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {invitations.length > 0 && (
        <section>
          <h2 className="mb-3 font-medium">Invitations en attente ({invitations.length})</h2>
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{inv.email}</p>
                  <p className="text-sm text-neutral-500">
                    {ROLE_LABELS[inv.role]} · expire le {dateFormat.format(inv.expiresAt)}
                  </p>
                </div>
                <form action={revokeInvitation}>
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Annuler
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
