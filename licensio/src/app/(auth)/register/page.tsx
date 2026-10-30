import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { safeNextPath } from "@/lib/redirect";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextPath = safeNextPath((await searchParams).next);
  const loginHref = nextPath === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthCard
      title="Créer un compte"
      subtitle="Centralisez vos licences et prouvez la conformité de chaque vidéo."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href={loginHref} className="font-medium text-neutral-900 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <RegisterForm next={nextPath} />
    </AuthCard>
  );
}
