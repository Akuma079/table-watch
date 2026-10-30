import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { Alert } from "@/components/ui/Alert";
import { safeNextPath } from "@/lib/redirect";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  link_invalid: "Ce lien est invalide ou a expiré. Recommencez la démarche.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; accountDeleted?: string }>;
}) {
  const { next, error, accountDeleted } = await searchParams;
  const nextPath = safeNextPath(next);
  const registerHref = nextPath === "/dashboard" ? "/register" : `/register?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthCard
      title="Connexion"
      subtitle="Accédez à vos projets et à votre coffre-fort de licences."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={registerHref} className="font-medium text-neutral-900 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      {error && ERRORS[error] && (
        <div className="mb-4">
          <Alert tone="error">{ERRORS[error]}</Alert>
        </div>
      )}
      {accountDeleted && (
        <div className="mb-4">
          <Alert tone="success">Votre compte et vos données ont été supprimés.</Alert>
        </div>
      )}
      <LoginForm next={nextPath} />
    </AuthCard>
  );
}
