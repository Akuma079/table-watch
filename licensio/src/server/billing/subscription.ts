// Traduction d'un abonnement Stripe en droits Licensio — fonctions pures, testées.
import type { WorkspacePlan } from "@prisma/client";
import { hasFeature, PASSPORT_GRACE_DAYS, type PaidPlan } from "@/lib/plans";

// Statuts qui ouvrent les droits payants. `past_due` : Stripe relance le paiement pendant
// quelques jours ; on laisse l'accès pendant ce délai plutôt que de bloquer une agence en
// pleine livraison. `incomplete`, `unpaid`, `canceled`, `paused`… : retour au plan gratuit.
export const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export type PriceMap = Partial<Record<PaidPlan, string>>;

export type SubscriptionSnapshot = {
  id: string;
  status: string;
  priceIds: string[];
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null; // secondes Unix
};

export function planFromSubscription(sub: SubscriptionSnapshot, prices: PriceMap): WorkspacePlan {
  if (!ENTITLED_STATUSES.has(sub.status)) return "FREE";
  // Du plus élevé au plus bas : un abonnement qui contiendrait les deux prix donne Agence.
  if (prices.AGENCY && sub.priceIds.includes(prices.AGENCY)) return "AGENCY";
  if (prices.CREATOR && sub.priceIds.includes(prices.CREATOR)) return "CREATOR";
  return "FREE";
}

// Délai de grâce des Passeports partagés : ouvert quand l'espace perd un forfait qui les
// incluait, conservé tant qu'il reste sans passeport, effacé dès qu'il en retrouve un.
export function passportGraceUntil(
  previous: { plan: WorkspacePlan; passportGraceUntil: Date | null },
  next: WorkspacePlan,
  now: Date,
): Date | null {
  if (hasFeature(next, "passport")) return null;
  if (hasFeature(previous.plan, "passport")) return new Date(now.getTime() + PASSPORT_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return previous.passportGraceUntil;
}

export function workspaceBillingFields(
  sub: SubscriptionSnapshot,
  prices: PriceMap,
  previous: { plan: WorkspacePlan; passportGraceUntil: Date | null } = { plan: "FREE", passportGraceUntil: null },
  now = new Date(),
) {
  const ended = sub.status === "canceled" || sub.status === "incomplete_expired";
  const plan = planFromSubscription(sub, prices);
  return {
    plan,
    // Abonnement terminé : on l'oublie pour permettre un nouveau checkout ; le client
    // Stripe est conservé (historique de factures).
    stripeSubscriptionId: ended ? null : sub.id,
    subscriptionStatus: sub.status,
    cancelAtPeriodEnd: ended ? false : sub.cancelAtPeriodEnd,
    currentPeriodEnd: !ended && sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd * 1000) : null,
    passportGraceUntil: passportGraceUntil(previous, plan, now),
  };
}
