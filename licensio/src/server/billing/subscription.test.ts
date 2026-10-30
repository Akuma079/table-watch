import { test } from "node:test";
import assert from "node:assert/strict";
import { limitReached, hasFeature } from "@/lib/plans";
import { planFromSubscription, workspaceBillingFields, type SubscriptionSnapshot } from "./subscription";

const prices = { AGENCY: "price_agency" };
const sub = (over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  id: "sub_1", status: "active", priceIds: ["price_agency"], cancelAtPeriodEnd: false, currentPeriodEnd: 1_800_000_000, ...over,
});

test("abonnement Agence actif, en essai ou en retard de paiement → AGENCY", () => {
  for (const status of ["active", "trialing", "past_due"]) assert.equal(planFromSubscription(sub({ status }), prices), "AGENCY");
});

test("abonnement impayé, incomplet ou annulé → CREATOR", () => {
  for (const status of ["unpaid", "incomplete", "incomplete_expired", "canceled", "paused"]) {
    assert.equal(planFromSubscription(sub({ status }), prices), "CREATOR");
  }
});

test("prix inconnu → pas de droits Agence", () => {
  assert.equal(planFromSubscription(sub({ priceIds: ["price_autre"] }), prices), "CREATOR");
  assert.equal(planFromSubscription(sub(), {}), "CREATOR");
});

test("abonnement annulé : identifiant oublié, client conservé", () => {
  const f = workspaceBillingFields(sub({ status: "canceled", cancelAtPeriodEnd: true }), prices);
  assert.deepEqual([f.plan, f.stripeSubscriptionId, f.cancelAtPeriodEnd, f.currentPeriodEnd], ["CREATOR", null, false, null]);
});

test("résiliation programmée : droits conservés jusqu'à la fin de période", () => {
  const f = workspaceBillingFields(sub({ cancelAtPeriodEnd: true }), prices);
  assert.equal(f.plan, "AGENCY");
  assert.equal(f.cancelAtPeriodEnd, true);
  assert.equal(f.currentPeriodEnd?.toISOString(), "2027-01-15T08:00:00.000Z");
});

test("limites du plan Creator", () => {
  assert.equal(limitReached("CREATOR", "projects", 4), false);
  assert.equal(limitReached("CREATOR", "projects", 5), true);
  assert.equal(limitReached("CREATOR", "licenses", 50), true);
  assert.equal(limitReached("CREATOR", "members", 1), true);
  assert.equal(limitReached("AGENCY", "projects", 10_000), false);
  assert.equal(hasFeature("CREATOR", "passport"), false);
  assert.equal(hasFeature("AGENCY", "whiteLabel"), true);
});
