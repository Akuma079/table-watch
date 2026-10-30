import type Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { getStripe, syncSubscription } from "@/server/billing/stripe";

// Webhook Stripe. À déclarer dans le tableau de bord Stripe (ou `stripe listen`) avec les
// événements : checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted.
export async function POST(request: Request) {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook Stripe non configuré", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text(); // corps brut : indispensable à la vérification de signature
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature ?? "", secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await syncSubscription(subId, session.client_reference_id ?? undefined);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object.id);
        break;
      default:
        // Événement non utilisé : accusé de réception pour que Stripe ne le renvoie pas.
        break;
    }
  } catch (error) {
    // 500 : Stripe renverra l'événement plus tard.
    console.error(`[stripe] échec du traitement de ${event.type} (${event.id})`, error);
    return new Response("Erreur de traitement", { status: 500 });
  }

  return Response.json({ received: true });
}
