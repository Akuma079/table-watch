import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";

// Encart affiché quand une fonctionnalité ou une limite dépend du plan Agence.
export function UpgradeNotice({ title, children, canManage }: { title: string; children: React.ReactNode; canManage: boolean }) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
      <p className="font-medium text-indigo-950">{title}</p>
      <div className="mt-1 text-sm text-indigo-900/80">{children}</div>
      <div className="mt-4">
        {canManage ? (
          <Link href="/pricing" className={buttonClass("primary")}>
            Découvrir le plan Agence
          </Link>
        ) : (
          <p className="text-xs text-indigo-900/70">Demandez à un administrateur de l&apos;espace de changer de plan.</p>
        )}
      </div>
    </div>
  );
}
