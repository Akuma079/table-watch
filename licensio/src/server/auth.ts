import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma, type User, type Workspace, type WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_WORKSPACE_COOKIE = "licensio_workspace";

const ROLE_RANK: Record<WorkspaceRole, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

export function hasRole(role: WorkspaceRole, minimum: WorkspaceRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

// Utilisateur Supabase de la requête, ou null. getUser() revalide le jeton auprès de
// Supabase (contrairement à getSession(), qui se fie au cookie).
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Utilisateur applicatif. À la première connexion, crée la ligne `users` et l'espace
// personnel (l'inscription peut attendre la confirmation de l'email : on ne peut pas
// le faire au moment du signUp).
export const requireUser = cache(async (): Promise<User> => {
  const authUser = await getAuthUser();
  if (!authUser?.email) redirect("/login");

  const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (existing) return existing;

  const meta = authUser.user_metadata as { full_name?: string; workspace_name?: string };
  const name = meta.full_name?.trim() || null;
  const workspaceName = meta.workspace_name?.trim() || (name ? `Espace de ${name}` : "Mon espace");

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { id: authUser.id, email: authUser.email!.toLowerCase(), name },
      });
      await tx.workspace.create({
        data: {
          name: workspaceName,
          slug: uniqueSlug(workspaceName),
          isPersonal: true,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
      });
      return user;
    });
  } catch (error) {
    // Deux requêtes simultanées à la première connexion : l'autre a déjà tout créé.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });
    }
    throw error;
  }
});

export type WorkspaceContext = {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
  workspaces: { id: string; name: string; role: WorkspaceRole }[];
};

// Espace actif : celui du cookie s'il appartient bien à l'utilisateur, sinon le premier.
// C'est le point d'entrée de toute page ou action qui lit des données : chaque requête
// Prisma doit ensuite filtrer sur `workspace.id`.
export const requireWorkspace = cache(async (): Promise<WorkspaceContext> => {
  const user = await requireUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  // Possible si l'utilisateur a été retiré de son dernier espace.
  if (memberships.length === 0) redirect("/workspaces/new");

  const activeId = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspaceId === activeId) ?? memberships[0];

  return {
    user,
    workspace: active.workspace,
    role: active.role,
    workspaces: memberships.map((m) => ({ id: m.workspaceId, name: m.workspace.name, role: m.role })),
  };
});

export class ForbiddenError extends Error {
  constructor(message = "Vous n'avez pas les droits nécessaires dans cet espace.") {
    super(message);
  }
}

// Pour les Server Actions : espace actif + rôle minimum exigé.
export async function requireWorkspaceRole(minimum: WorkspaceRole) {
  const ctx = await requireWorkspace();
  if (!hasRole(ctx.role, minimum)) throw new ForbiddenError();
  return ctx;
}
