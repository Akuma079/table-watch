import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspace } from "@/server/auth";
import { billingConfigured, syncCheckoutSession } from "@/server/billing/stripe";

// Retour de Stripe Checkout. On synchronise l'abonnement ici, avant tout affichage, pour
// que toute la page (barre latérale comprise) montre déjà le nouveau plan, sans attendre
// le webhook. Le webhook reste la source de vérité ; cette synchronisation est idempotente.
export async function GET(request: NextRequest) {
  const { workspace } = await requireWorkspace();
  const sessionId = request.nextUrl.searchParams.get("session_id");
  let synced = false;
  if (sessionId && billingConfigured()) {
    try {
      const synced_ = await syncCheckoutSession(sessionId, workspace.id);
      synced = Boolean(synced_ && synced_.plan !== "FREE");
    } catch (e) {
      console.error("[stripe] synchronisation du retour de Checkout", e);
    }
  }
  const target = new URL(`/settings/billing?checkout=${synced ? "success" : "pending"}`, request.nextUrl.origin);
  return NextResponse.redirect(target, 303);
}
