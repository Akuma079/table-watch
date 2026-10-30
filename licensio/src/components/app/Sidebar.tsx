import type { WorkspaceContext } from "@/server/auth";
import { hasRole } from "@/server/auth";
import { logout } from "@/server/actions/auth";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export function Sidebar({ ctx }: { ctx: WorkspaceContext }) {
  return (
    <aside className="flex w-full flex-col gap-6 border-b border-neutral-200 bg-white p-4 md:min-h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <Logo />
      <WorkspaceSwitcher activeId={ctx.workspace.id} workspaces={ctx.workspaces} />
      <nav className="flex flex-wrap gap-1 md:flex-col">
        <NavLink href="/dashboard">Tableau de bord</NavLink>
        <NavLink href="/projects">Projets</NavLink>
        <NavLink href="/vault">Coffre-fort</NavLink>
        {hasRole(ctx.role, "ADMIN") && <NavLink href="/settings/members">Membres</NavLink>}
      </nav>
      <div className="mt-auto border-t border-neutral-100 pt-4">
        <p className="truncate text-sm font-medium">{ctx.user.name ?? ctx.user.email}</p>
        <p className="truncate text-xs text-neutral-500">{ctx.user.email}</p>
        <form action={logout} className="mt-3">
          <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-900">
            Se déconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
