import Link from "next/link";
import { Logo } from "@/components/app/Logo";
import { requireUser } from "@/server/auth";

// Hors du groupe (app) : accessible même sans espace de travail actif
// (sinon requireWorkspace redirigerait ici en boucle).
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Link href="/dashboard" className="mb-10 inline-block">
        <Logo />
      </Link>
      {children}
    </div>
  );
}
