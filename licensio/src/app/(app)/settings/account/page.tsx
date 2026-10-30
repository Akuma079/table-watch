import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/server/auth";
import { DeleteAccountForm, ProfileForm } from "@/components/settings/DangerForms";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const { user } = await requireWorkspace();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { name: true, _count: { select: { members: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const owned = memberships.filter((m) => m.role === "OWNER");
  const blocking = owned.filter((m) => m.workspace._count.members > 1);
  const deleted = owned.filter((m) => m.workspace._count.members === 1);
  const left = memberships.filter((m) => m.role !== "OWNER");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Mon compte" description={user.email} />

      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <ProfileForm name={user.name ?? ""} />
        <p className="mt-4 text-xs text-neutral-500">
          Adresse de connexion : {user.email}. Pour changer de mot de passe, déconnectez-vous puis utilisez « Mot de passe oublié ».
        </p>
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-6">
        <h2 className="font-medium text-red-700">Supprimer mon compte</h2>
        <p className="mt-1 text-sm text-neutral-500">Suppression définitive de votre compte et de vos données personnelles (RGPD).</p>
        {blocking.length > 0 ? (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Vous êtes propriétaire d&apos;espaces partagés avec d&apos;autres membres :{" "}
            {blocking.map((m) => `« ${m.workspace.name} »`).join(", ")}. Transférez-en la propriété, ou supprimez-les, depuis{" "}
            <Link href="/settings/workspace" className="font-medium underline">
              Paramètres de l&apos;espace
            </Link>{" "}
            avant de supprimer votre compte.
          </div>
        ) : (
          <>
            <ul className="mb-5 mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-600">
              {deleted.length > 0 && (
                <li>
                  Supprimé{deleted.length > 1 ? "s" : ""} avec toutes leurs données et leur abonnement :{" "}
                  {deleted.map((m) => `« ${m.workspace.name} »`).join(", ")}.
                </li>
              )}
              {left.length > 0 && (
                <li>
                  Vous quittez {left.map((m) => `« ${m.workspace.name} »`).join(", ")} ; ce que vous y avez ajouté reste à l&apos;équipe,
                  sans votre nom.
                </li>
              )}
              <li>Votre connexion et votre profil sont effacés. Cette action est irréversible.</li>
            </ul>
            <DeleteAccountForm email={user.email} />
          </>
        )}
      </section>
    </div>
  );
}
