"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, requireUser } from "@/server/auth";
import { deleteWorkspaceData } from "@/server/workspaces";
import { fieldErrors, str } from "./form";
import type { FormState } from "./types";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = { name: str(formData, "name") };
  const parsed = z.object({ name: z.string().trim().min(1, "Indiquez votre nom.").max(80) }).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath("/", "layout");
  return { success: "Profil enregistré.", values: { name: parsed.data.name } };
}

// Espaces que la suppression du compte bloquerait : possédés et partagés avec d'autres
// membres. Il faut d'abord en transférer la propriété (ou les supprimer).
async function sharedOwnedWorkspaces(userId: string) {
  const owned = await prisma.workspace.findMany({
    where: { members: { some: { userId, role: "OWNER" } } },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  return {
    shared: owned.filter((w) => w._count.members > 1),
    solo: owned.filter((w) => w._count.members === 1),
  };
}

// Droit à l'effacement (RGPD, art. 17) : supprime le compte, les espaces dont l'utilisateur
// est seul membre (avec leurs données et abonnements) et ses accès aux autres espaces.
// Ce qu'il a créé dans les espaces partagés reste à l'équipe, sans lien vers lui.
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (str(formData, "confirm").trim().toLowerCase() !== user.email.toLowerCase()) {
    return { fieldErrors: { confirm: "Recopiez exactement votre adresse email." } };
  }
  const { shared, solo } = await sharedOwnedWorkspaces(user.id);
  if (shared.length > 0) {
    return {
      error: `Transférez d'abord la propriété de ${shared.map((w) => `« ${w.name} »`).join(", ")} à un autre membre, ou supprimez ${shared.length > 1 ? "ces espaces" : "cet espace"}.`,
    };
  }

  try {
    for (const w of solo) await deleteWorkspaceData(w.id);
    // Compte de connexion d'abord : sans lui, plus de reconnexion possible, même si la
    // suite échouait.
    const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
    if (error && error.status !== 404) throw error;
    await prisma.user.delete({ where: { id: user.id } });
  } catch (e) {
    console.error("[account] suppression", e);
    return { error: "La suppression du compte a échoué. Réessayez dans un instant." };
  }

  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => {});
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/login?accountDeleted=1");
}
