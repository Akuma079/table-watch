import Link from "next/link";
import { Logo } from "@/components/app/Logo";
import { buttonClass } from "@/components/ui/button-styles";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <Link href="/dashboard" className="inline-block">
          <Logo />
        </Link>
        <p className="mt-10 text-sm font-medium text-neutral-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page introuvable</h1>
        <p className="mt-3 text-sm text-neutral-500">
          Ce lien n&apos;existe pas, ou l&apos;élément a été supprimé ou appartient à un autre espace de travail.
        </p>
        <Link href="/dashboard" className={buttonClass("primary", "mt-6")}>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
