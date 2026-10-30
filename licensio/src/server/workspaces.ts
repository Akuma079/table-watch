import "server-only";
import { prisma } from "@/lib/prisma";
import { billingConfigured, getStripe } from "@/server/billing/stripe";
import { removeDocuments } from "@/server/storage";

// Un seul espace gratuit possédé par compte : sinon la limite du plan Gratuit se
// contournerait en multipliant les espaces. Les espaces payants et ceux où l'on est
// seulement invité ne comptent pas.
export async function ownedFreeWorkspace(userId: string) {
  return prisma.workspace.findFirst({
    where: { plan: "FREE", members: { some: { userId, role: "OWNER" } } },
    select: { id: true, name: true },
  });
}

// Suppression définitive d'un espace : abonnement Stripe résilié immédiatement, données
// effacées (licences, preuves, projets, audits, invitations), puis fichiers du bucket.
// Le client Stripe et ses factures sont conservés chez Stripe (obligations comptables).
export async function deleteWorkspaceData(workspaceId: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { stripeSubscriptionId: true },
  });
  if (ws.stripeSubscriptionId && billingConfigured()) {
    try {
      await getStripe().subscriptions.cancel(ws.stripeSubscriptionId);
    } catch (e) {
      // Abonnement déjà supprimé chez Stripe : rien à résilier.
      if ((e as { code?: string }).code !== "resource_missing") throw e;
    }
  }
  const documents = await prisma.licenseDocument.findMany({
    where: { license: { workspaceId } },
    select: { storagePath: true },
  });
  await prisma.workspace.delete({ where: { id: workspaceId } });
  // Après la base. En cas d'échec, le nettoyage quotidien des fichiers orphelins les supprimera.
  const paths = documents.map((d) => d.storagePath);
  for (let i = 0; i < paths.length; i += 100) {
    await removeDocuments(paths.slice(i, i + 100)).catch((e) => console.error("[storage] suppression d'espace", e));
  }
}
