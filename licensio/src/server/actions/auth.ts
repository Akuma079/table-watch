"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/auth";
import { fieldErrors, str } from "./form";
import type { FormState } from "./types";

const email = z.string().trim().toLowerCase().email("Adresse email invalide.");
const password = z.string().min(8, "8 caractères minimum.").max(72, "72 caractères maximum.");

// Messages Supabase → français. Un message générique pour les identifiants : on ne
// révèle pas si un compte existe pour cette adresse.
function authErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirmez d'abord votre adresse via le lien reçu par email.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Réessayez dans quelques minutes.";
    case "weak_password":
      return "Mot de passe trop faible : choisissez-en un plus long ou moins courant.";
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'ancien.";
    default:
      return fallback;
  }
}

function callbackUrl(next: string) {
  return `${serverEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: str(formData, "email") };
  const parsed = z.object({ email, password: z.string().min(1, "Mot de passe requis.") }).safeParse({
    email: values.email,
    password: str(formData, "password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error.code, "Connexion impossible. Réessayez."), values };

  redirect(safeNextPath(str(formData, "next")));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: str(formData, "name"),
    email: str(formData, "email"),
    workspaceName: str(formData, "workspaceName"),
  };
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Indiquez votre nom.").max(80),
      email,
      workspaceName: z.string().trim().max(80).optional(),
      password,
    })
    .safeParse({ ...values, password: str(formData, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const next = safeNextPath(str(formData, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callbackUrl(next),
      // Lu à la première connexion pour créer l'utilisateur et son espace (server/auth.ts).
      data: { full_name: parsed.data.name, workspace_name: parsed.data.workspaceName || undefined },
    },
  });
  if (error) return { error: authErrorMessage(error.code, "Inscription impossible. Réessayez."), values };

  // Confirmation d'email désactivée dans Supabase : la session existe déjà.
  if (data.session) redirect(next);

  return {
    success: `Un email de confirmation a été envoyé à ${parsed.data.email}. Cliquez sur le lien pour activer votre compte.`,
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: str(formData, "email") };
  const parsed = email.safeParse(values.email);
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message }, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: callbackUrl("/reset-password"),
  });
  if (error?.code?.startsWith("over_")) return { error: authErrorMessage(error.code, ""), values };

  // Même réponse que l'adresse existe ou non.
  return {
    success: `Si un compte existe pour ${parsed.data}, vous allez recevoir un lien pour choisir un nouveau mot de passe.`,
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas." })
    .safeParse({ password: str(formData, "password"), confirm: str(formData, "confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error.code, "Le lien a expiré. Demandez-en un nouveau.") };

  redirect("/dashboard?password=updated");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/login");
}
