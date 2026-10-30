import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getAuthUser } from "@/server/auth";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

// On arrive ici via /auth/callback, qui a ouvert une session de récupération.
export default async function ResetPasswordPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?error=link_invalid");

  return (
    <AuthCard title="Nouveau mot de passe" subtitle={`Pour le compte ${user.email}.`}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
