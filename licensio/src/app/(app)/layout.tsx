import { Sidebar } from "@/components/app/Sidebar";
import { requireWorkspace } from "@/server/auth";

// Toutes les pages de ce groupe exigent une session (vérifiée ici en plus du middleware)
// et un espace de travail actif.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  return (
    <div className="md:flex">
      <Sidebar ctx={ctx} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-10 md:py-12">{children}</main>
    </div>
  );
}
