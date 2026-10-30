import type { WorkspaceContext } from "@/server/auth";
import { hasRole } from "@/server/auth";
import { PLANS } from "@/lib/plans";
import { logout } from "@/server/actions/auth";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SubmitButton } from "@/components/ui/Button";

export function Sidebar({ ctx }: { ctx: WorkspaceContext }) {
  return (
    <aside className="flex w-full flex-col gap-4 border-b border-neutral-200 bg-white p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:gap-6 md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3 md:hidden">
          <a href="/settings/account" className="text-xs text-neutral-500 hover:text-neutral-900">
            Mon compte
          </a>
        <form action={logout}>
          <SubmitButton variant={null} className="text-xs text-neutral-500 hover:text-neutral-900" pendingLabel="Déconnexion…">
            Se déconnecter
          </SubmitButton>
        </form>
        </div>
      </div>
      <div className="space-y-2">
        <WorkspaceSwitcher activeId={ctx.workspace.id} workspaces={ctx.workspaces} />
        <p className="px-1 text-xs text-neutral-500">
          Plan <span className="font-medium text-neutral-900">{PLANS[ctx.workspace.plan].name}</span>
          {ctx.workspace.plan !== "AGENCY" && hasRole(ctx.role, "ADMIN") && (
            <>
              {" · "}
              <a href="/pricing" className="underline hover:text-neutral-900">
                Changer de forfait
              </a>
            </>
          )}
        </p>
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        <NavLink href="/dashboard">Tableau de bord</NavLink>
        <NavLink href="/projects">Projets</NavLink>
        <NavLink href="/vault">Coffre-fort</NavLink>
        <NavLink href="/settings/members">Membres</NavLink>
        <NavLink href="/settings/billing">Abonnement</NavLink>
        <NavLink href="/settings/workspace">Paramètres</NavLink>
      </nav>
      <div className="mt-auto hidden border-t border-neutral-100 pt-4 md:block">
        <a href="/settings/account" className="block rounded-lg hover:text-neutral-600">
          <p className="truncate text-sm font-medium">{ctx.user.name ?? ctx.user.email}</p>
          <p className="truncate text-xs text-neutral-500">{ctx.user.email} · Mon compte</p>
        </a>
        <form action={logout} className="mt-3">
          <SubmitButton variant={null} className="text-xs text-neutral-500 hover:text-neutral-900" pendingLabel="Déconnexion…">
            Se déconnecter
          </SubmitButton>
        </form>
      </div>
    </aside>
  );
}
