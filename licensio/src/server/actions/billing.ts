"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { hasFeature, isPaidPlan, PLANS, type PaidPlan } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireWorkspaceRole } from "@/server/auth";
import { billingConfigured, getStripe, priceMap, syncSubscription, taxEnabled } from "@/server/billing/stripe";
import { fieldErrors, str } from "./form";
import type { FormState } from "./types";

const appUrl = (path: string) => `${serverEnv().NEXT_PUBLIC_APP_URL}${path}`;

// Souscription à un forfait payant (champ `plan` du formulaire). Réservé aux
// propriétaires et administrateurs. Un espace déjà abonné change de forfait sur son
// abonnement existant : jamais deux abonnements pour un même espace.
export async function startCheckout(formData: FormData) {
  const { workspace, user } = await requireWorkspaceRole("ADMIN");
  const plan = str(formData, "plan");
  if (!isPaidPlan(plan) || !billingConfigured(plan)) redirect("/settings/billing?error=unconfigured");
  if (workspace.stripeSubscriptionId) return changePlan(workspace.id, workspace.stripeSubscriptionId, plan);

  const stripe = getStripe();
  let customer = workspace.stripeCustomerId;
  if (!customer) {
    const created = await stripe.customers.create({
      email: user.email,
      name: workspace.name,
      metadata: { workspaceId: workspace.id },
    });
    customer = created.id;
    await prisma.workspace.update({ where: { id: workspace.id }, data: { stripeCustomerId: customer } });
  }

  const tax = taxEnabled();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: workspace.id,
    line_items: [{ price: priceMap()[plan]!, quantity: 1 }],
    subscription_data: { metadata: { workspaceId: workspace.id } },
    allow_promotion_codes: true,
    // TVA : prix TTC (« tax_behavior: inclusive » sur les prix Stripe), calcul selon
    // l'adresse du client ; n° de TVA intracommunautaire accepté pour les entreprises.
    ...(tax && {
      automatic_tax: { enabled: true },
      billing_address_collection: "required" as const,
      customer_update: { address: "auto" as const, name: "auto" as const },
      tax_id_collection: { enabled: true },
    }),
    success_url: appUrl("/api/billing/return?session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: appUrl("/pricing?checkout=cancelled"),
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
  redirect(session.url);
}

// Montée ou descente de gamme sur l'abonnement en cours, au prorata.
async function changePlan(workspaceId: string, subscriptionId: string, plan: PaidPlan): Promise<never> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (item.price.id !== priceMap()[plan]) {
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price: priceMap()[plan]! }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
    });
  }
  await syncSubscription(subscriptionId, workspaceId);
  revalidatePath("/", "layout");
  redirect(`/settings/billing?changed=${plan}`);
}

// Portail client Stripe : moyen de paiement, factures, résiliation.
export async function openBillingPortal() {
  const { workspace } = await requireWorkspaceRole("ADMIN");
  if (!billingConfigured() || !workspace.stripeCustomerId) redirect("/settings/billing");
  const portal = await getStripe().billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: appUrl("/settings/billing"),
  });
  redirect(portal.url);
}

const brandInput = z.object({
  brandName: z
    .string()
    .trim()
    .max(60, "60 caractères maximum.")
    .transform((v) => v || null),
  brandColor: z
    .string()
    .trim()
    .regex(/^(#[0-9a-fA-F]{6})?$/, "Couleur au format #RRGGBB.")
    .transform((v) => v.toLowerCase() || null),
});

export async function updateBranding(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { brandName: str(formData, "brandName"), brandColor: str(formData, "brandColor") };
  let ctx;
  try {
    ctx = await requireWorkspaceRole("ADMIN");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message, values };
    throw e;
  }
  if (!hasFeature(ctx.workspace.plan, "whiteLabel")) {
    return { error: `La marque blanche est incluse dans le plan ${PLANS.AGENCY.name}.`, values };
  }
  const parsed = brandInput.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  await prisma.workspace.update({ where: { id: ctx.workspace.id }, data: parsed.data });
  revalidatePath("/settings/billing");
  return { success: "Personnalisation enregistrée.", values };
}
