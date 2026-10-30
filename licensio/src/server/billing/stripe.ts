import "server-only";
import Stripe from "stripe";
import type { Workspace } from "@prisma/client";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { workspaceBillingFields, type SubscriptionSnapshot } from "./subscription";

export function billingConfigured() {
  const env = serverEnv();
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_AGENCY);
}

let client: Stripe | undefined;

export function getStripe() {
  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY manquant");
  if (!client) {
    const base = env.STRIPE_API_BASE ? new URL(env.STRIPE_API_BASE) : null;
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      appInfo: { name: "Licensio" },
      ...(base && {
        host: base.hostname,
        port: base.port || (base.protocol === "https:" ? 443 : 80),
        protocol: base.protocol.replace(":", "") as "http" | "https",
      }),
    });
  }
  return client;
}

export function priceMap() {
  return { AGENCY: serverEnv().STRIPE_PRICE_AGENCY };
}

function snapshot(sub: Stripe.Subscription): SubscriptionSnapshot {
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  return {
    id: sub.id,
    status: sub.status,
    priceIds: sub.items.data.map((i) => i.price.id),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: ends.length ? Math.max(...ends) : null,
  };
}

function customerId(c: string | Stripe.Customer | Stripe.DeletedCustomer) {
  return typeof c === "string" ? c : c.id;
}

// Relit l'abonnement chez Stripe (jamais le contenu de l'événement, qui peut arriver dans
// le désordre) et recalcule les droits de l'espace concerné. Idempotent.
export async function syncSubscription(subscriptionId: string, workspaceHint?: string): Promise<Workspace | null> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  const customer = customerId(sub.customer);
  const workspaceId = workspaceHint ?? sub.metadata?.workspaceId;

  const workspace =
    (await prisma.workspace.findUnique({ where: { stripeSubscriptionId: sub.id } })) ??
    (workspaceId ? await prisma.workspace.findUnique({ where: { id: workspaceId } }) : null) ??
    (await prisma.workspace.findUnique({ where: { stripeCustomerId: customer } }));
  if (!workspace) {
    console.warn(`[stripe] abonnement ${sub.id} : aucun espace correspondant`);
    return null;
  }

  const fields = workspaceBillingFields(snapshot(sub), priceMap());
  // Événement tardif d'un ancien abonnement (ex. annulation d'un abonnement remplacé) :
  // il ne doit pas rétrograder l'espace qui en a un autre, actif.
  if (workspace.stripeSubscriptionId && workspace.stripeSubscriptionId !== sub.id && fields.plan === "CREATOR") {
    return workspace;
  }

  return prisma.workspace.update({
    where: { id: workspace.id },
    data: { ...fields, stripeCustomerId: workspace.stripeCustomerId ?? customer },
  });
}

// Retour de Stripe Checkout : on n'attend pas le webhook pour afficher le bon plan.
export async function syncCheckoutSession(sessionId: string, workspaceId: string) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== workspaceId || !session.subscription) return null;
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  return syncSubscription(subId, workspaceId);
}
