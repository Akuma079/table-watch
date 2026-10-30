import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/labels";
import { getAuthUser } from "@/server/auth";
import { hashInvitationToken } from "@/server/invitations";
import { Logo } from "@/components/app/Logo";
import { AuthCard } from "@/components/auth/AuthCard";
import { AcceptInvitationForm } from "@/components/workspace/AcceptInvitationForm";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, authUser] = await Promise.all([
    prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      include: { workspace: { select: { name: true } }, invitedBy: { select: { name: true, email: true } } },
    }),
    getAuthUser(),
  ]);
  const valid =
    invitation && !invitation.revokedAt && !invitation.acceptedAt && invitation.expiresAt > new Date();
  const here = `/invite/${token}`;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12">
      <div className="mb-10">
        <Logo />
      </div>
      {!valid ? (
        <AuthCard title="Invitation expirée">
          <Alert tone="error">Ce lien n&apos;est plus valable. Demandez une nouvelle invitation à l&apos;espace concerné.</Alert>
        </AuthCard>
      ) : (
        <AuthCard
          title={`Rejoindre « ${invitation.workspace.name} »`}
          subtitle={`${invitation.invitedBy?.name ?? invitation.invitedBy?.email ?? "Un membre"} vous invite en tant que ${ROLE_LABELS[invitation.role].toLowerCase()}. Invitation pour ${invitation.email}.`}
        >
          {authUser ? (
            <AcceptInvitationForm token={token} />
          ) : (
            <div className="space-y-3">
              <Link href={`/register?next=${encodeURIComponent(here)}`} className={buttonClass("primary", "w-full")}>
                Créer un compte
              </Link>
              <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonClass("secondary", "w-full")}>
                J&apos;ai déjà un compte
              </Link>
            </div>
          )}
        </AuthCard>
      )}
    </div>
  );
}
