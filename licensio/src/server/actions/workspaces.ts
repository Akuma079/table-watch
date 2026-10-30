"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { hasFeature, limitReached, PLANS } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ForbiddenError,
  requireUser,
  requireWorkspaceRole,
} from "@/server/auth";
import { hashInvitationToken, invitationExpiry, newInvitationToken } from "@/server/invitations";
import { emailConfigured, invitationEmail, sendEmail } from "@/server/email";
import { ROLE_LABELS } from "@/lib/labels";
import { fieldErrors, str } from "./form";
import type { FormState } from "./types";

async function setActiveWorkspace(workspaceId: string) {
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = { name: str(formData, "name") };
  const parsed = z.object({ name: z.string().trim().min(2, "2 caractères minimum.").max(80) }).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      slug: uniqueSlug(parsed.data.name),
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await setActiveWorkspace(workspace.id);
  redirect("/settings/members?created=1");
}

export async function switchWorkspace(formData: FormData) {
  const user = await requireUser();
  const workspaceId = str(formData, "workspaceId");
  // Le cookie n'est posé que pour un espace dont l'utilisateur est membre.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (membership) await setActiveWorkspace(workspaceId);
  redirect("/dashboard");
}

export type InviteState = FormState & { inviteUrl?: string };

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const values = { email: str(formData, "email"), role: str(formData, "role") };
  let ctx;
  try {
    ctx = await requireWorkspaceRole("ADMIN");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message, values };
    throw e;
  }

  if (!hasFeature(ctx.workspace.plan, "multiUser")) {
    return { error: `Le plan ${PLANS[ctx.workspace.plan].name} est réservé à un seul utilisateur. Passez au plan Agence pour inviter vos collaborateurs.`, values };
  }

  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Adresse email invalide."),
      // OWNER n'est jamais attribuable par invitation.
      role: z.enum(["ADMIN", "MEMBER", "VIEWER"], { message: "Rôle invalide." }),
    })
    .safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { email, role } = parsed.data;

  // Seul le propriétaire peut nommer un administrateur.
  if (role === "ADMIN" && ctx.role !== "OWNER") {
    return { error: "Seul le propriétaire peut inviter un administrateur.", values };
  }

  const alreadyMember = await prisma.membership.findFirst({
    where: { workspaceId: ctx.workspace.id, user: { email } },
  });
  if (alreadyMember) return { error: `${email} fait déjà partie de cet espace.`, values };

  const { token, tokenHash } = newInvitationToken();
  const [, invitation] = await prisma.$transaction([
    // Une seule invitation active par adresse : la nouvelle remplace l'ancienne.
    prisma.invitation.updateMany({
      where: { workspaceId: ctx.workspace.id, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.invitation.create({
      data: {
        workspaceId: ctx.workspace.id,
        email,
        role,
        tokenHash,
        invitedById: ctx.user.id,
        expiresAt: invitationExpiry(),
      },
      select: { id: true },
    }),
  ]);

  const inviteUrl = `${serverEnv().NEXT_PUBLIC_APP_URL}/invite/${token}`;
  const sent = await sendEmail({
    to: email,
    replyTo: ctx.user.email,
    ...invitationEmail({
      workspaceName: ctx.workspace.name,
      inviterName: ctx.user.name || ctx.user.email,
      roleLabel: ROLE_LABELS[role],
      url: inviteUrl,
    }),
  });
  if (sent) await prisma.invitation.update({ where: { id: invitation.id }, data: { emailSentAt: new Date() } });

  revalidatePath("/settings/members");
  // Le lien n'est affiché qu'une fois (seul son empreinte est en base) : il reste copiable,
  // que l'email soit parti ou non.
  return {
    success: sent
      ? `Invitation envoyée par email à ${email}. Vous pouvez aussi lui transmettre ce lien (valable 7 jours) :`
      : emailConfigured()
        ? `L'email n'a pas pu être envoyé à ${email}. Transmettez-lui ce lien (valable 7 jours) :`
        : `Invitation créée pour ${email}. Transmettez-lui ce lien (valable 7 jours) :`,
    inviteUrl,
  };
}

export async function revokeInvitation(formData: FormData) {
  const ctx = await requireWorkspaceRole("ADMIN");
  await prisma.invitation.updateMany({
    where: { id: str(formData, "invitationId"), workspaceId: ctx.workspace.id, acceptedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings/members");
}

export async function removeMember(formData: FormData) {
  const ctx = await requireWorkspaceRole("ADMIN");
  const membership = await prisma.membership.findFirst({
    where: { id: str(formData, "membershipId"), workspaceId: ctx.workspace.id },
  });
  // Le propriétaire ne peut pas être retiré ; un admin ne peut pas retirer un autre admin.
  if (!membership || membership.role === "OWNER") return;
  if (membership.role === "ADMIN" && ctx.role !== "OWNER") return;
  if (membership.userId === ctx.user.id) return;

  await prisma.membership.delete({ where: { id: membership.id } });
  revalidatePath("/settings/members");
}

export async function renameWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { name: str(formData, "name") };
  let ctx;
  try {
    ctx = await requireWorkspaceRole("ADMIN");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message, values };
    throw e;
  }
  const parsed = z.object({ name: z.string().trim().min(2, "2 caractères minimum.").max(80) }).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  await prisma.workspace.update({ where: { id: ctx.workspace.id }, data: { name: parsed.data.name } });
  revalidatePath("/", "layout");
  return { success: "Nom de l'espace enregistré.", values: { name: parsed.data.name } };
}

// Quitter l'espace actif. Le propriétaire ne peut pas partir : l'espace (et son
// abonnement) resterait sans responsable.
export async function leaveWorkspace() {
  const ctx = await requireWorkspaceRole("VIEWER");
  if (ctx.role === "OWNER") return;
  await prisma.membership.delete({ where: { userId_workspaceId: { userId: ctx.user.id, workspaceId: ctx.workspace.id } } });
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect(ctx.workspaces.length > 1 ? "/dashboard" : "/workspaces/new");
}

export async function updateMemberRole(formData: FormData) {
  const ctx = await requireWorkspaceRole("OWNER");
  const role = z.enum(["ADMIN", "MEMBER", "VIEWER"]).safeParse(str(formData, "role"));
  if (!role.success) return;
  await prisma.membership.updateMany({
    where: { id: str(formData, "membershipId"), workspaceId: ctx.workspace.id, role: { not: "OWNER" } },
    data: { role: role.data },
  });
  revalidatePath("/settings/members");
}

export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(str(formData, "token")) },
  });

  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return { error: "Cette invitation n'est plus valable. Demandez-en une nouvelle." };
  }
  // Invitation envoyée avant un passage au plan gratuit : l'espace n'accepte plus de membre.
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: invitation.workspaceId },
    select: { plan: true, _count: { select: { members: true } } },
  });
  if (limitReached(workspace.plan, "members", workspace._count.members)) {
    return { error: "Cet espace ne peut plus accueillir de nouveau membre avec son abonnement actuel." };
  }
  // Le lien ne suffit pas : il faut être connecté avec l'adresse invitée.
  if (invitation.email !== user.email.toLowerCase()) {
    return { error: `Cette invitation est destinée à ${invitation.email}. Connectez-vous avec cette adresse.` };
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: invitation.workspaceId } },
      create: { userId: user.id, workspaceId: invitation.workspaceId, role: invitation.role },
      update: {},
    }),
    prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
  ]);

  await setActiveWorkspace(invitation.workspaceId);
  redirect("/dashboard");
}

