"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { hasFeature } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireWorkspaceRole } from "@/server/auth";
import { billingConfigured, getStripe, priceMap } from "@/server/billing/stripe";
import { fieldErrors, str } from "./form";
import type { FormState } from "./types";

const billingUrl = (query = "") => `${serverEnv().NEXT_PUBLIC_APP_URL}/settings/billing${query}`;

// Passage au plan Agence via Stripe Checkout. Réservé aux propriétaires et administrateurs.
export async function startAgencyCheckout() {
  const { workspace, user } = await requireWorkspaceRole("ADMIN");
  if (!billingConfigured()) redirect("/settings/billing?error=unconfigured");
  // Déjà abonné : on gère l'abonnement existant plutôt que d'en créer un second.
  if (workspace.stripeSubscriptionId) return openBillingPortal();

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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: workspace.id,
    line_items: [{ price: priceMap().AGENCY!, quantity: 1 }],
    subscription_data: { metadata: { workspaceId: workspace.id } },
    allow_promotion_codes: true,
    success_url: `${serverEnv().NEXT_PUBLIC_APP_URL}/api/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${serverEnv().NEXT_PUBLIC_APP_URL}/pricing?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
  redirect(session.url);
}

// Portail client Stripe : moyen de paiement, factures, résiliation.
export async function openBillingPortal() {
  const { workspace } = await requireWorkspaceRole("ADMIN");
  if (!billingConfigured() || !workspace.stripeCustomerId) redirect("/settings/billing");
  const portal = await getStripe().billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: billingUrl(),
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
    return { error: "La marque blanche est incluse dans le plan Agence.", values };
  }
  const parsed = brandInput.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  await prisma.workspace.update({ where: { id: ctx.workspace.id }, data: parsed.data });
  revalidatePath("/settings/billing");
  return { success: "Personnalisation enregistrée.", values };
}
