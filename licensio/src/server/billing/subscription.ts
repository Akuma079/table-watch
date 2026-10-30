// Traduction d'un abonnement Stripe en droits Licensio — fonctions pures, testées.
import type { WorkspacePlan } from "@prisma/client";

// Statuts qui ouvrent les droits payants. `past_due` : Stripe relance le paiement pendant
// quelques jours ; on laisse l'accès pendant ce délai plutôt que de bloquer une agence en
// pleine livraison. `incomplete`, `unpaid`, `canceled`, `paused`… : retour au plan gratuit.
export const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export type SubscriptionSnapshot = {
  id: string;
  status: string;
  priceIds: string[];
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null; // secondes Unix
};

export function planFromSubscription(sub: SubscriptionSnapshot, prices: Partial<Record<WorkspacePlan, string>>): WorkspacePlan {
  if (!ENTITLED_STATUSES.has(sub.status)) return "CREATOR";
  if (prices.AGENCY && sub.priceIds.includes(prices.AGENCY)) return "AGENCY";
  return "CREATOR";
}

export function workspaceBillingFields(sub: SubscriptionSnapshot, prices: Partial<Record<WorkspacePlan, string>>) {
  const ended = sub.status === "canceled" || sub.status === "incomplete_expired";
  return {
    plan: planFromSubscription(sub, prices),
    // Abonnement terminé : on l'oublie pour permettre un nouveau checkout ; le client
    // Stripe est conservé (historique de factures).
    stripeSubscriptionId: ended ? null : sub.id,
    subscriptionStatus: sub.status,
    cancelAtPeriodEnd: ended ? false : sub.cancelAtPeriodEnd,
    currentPeriodEnd: !ended && sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd * 1000) : null,
  };
}
