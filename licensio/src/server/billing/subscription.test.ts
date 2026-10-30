import { test } from "node:test";
import assert from "node:assert/strict";
import { hasFeature, limitMessage, limitReached, upgradeTarget } from "@/lib/plans";
import { passportGraceUntil, planFromSubscription, workspaceBillingFields, type SubscriptionSnapshot } from "./subscription";

const prices = { CREATOR: "price_creator", AGENCY: "price_agency" };
const NOW = new Date("2026-10-30T12:00:00Z");
const sub = (over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  id: "sub_1", status: "active", priceIds: ["price_agency"], cancelAtPeriodEnd: false, currentPeriodEnd: 1_800_000_000, ...over,
});

test("prix Agence ou Creator actif, en essai ou en retard → forfait correspondant", () => {
  for (const status of ["active", "trialing", "past_due"]) {
    assert.equal(planFromSubscription(sub({ status }), prices), "AGENCY");
    assert.equal(planFromSubscription(sub({ status, priceIds: ["price_creator"] }), prices), "CREATOR");
  }
});

test("abonnement impayé, incomplet ou annulé → Gratuit", () => {
  for (const status of ["unpaid", "incomplete", "incomplete_expired", "canceled", "paused"]) {
    assert.equal(planFromSubscription(sub({ status }), prices), "FREE");
  }
});

test("prix inconnu → Gratuit", () => {
  assert.equal(planFromSubscription(sub({ priceIds: ["price_autre"] }), prices), "FREE");
  assert.equal(planFromSubscription(sub(), {}), "FREE");
});

test("abonnement annulé : identifiant oublié, client conservé", () => {
  const f = workspaceBillingFields(sub({ status: "canceled", cancelAtPeriodEnd: true }), prices, { plan: "AGENCY", passportGraceUntil: null }, NOW);
  assert.deepEqual([f.plan, f.stripeSubscriptionId, f.cancelAtPeriodEnd, f.currentPeriodEnd], ["FREE", null, false, null]);
});

test("résiliation programmée : droits conservés jusqu'à la fin de période", () => {
  const f = workspaceBillingFields(sub({ cancelAtPeriodEnd: true }), prices);
  assert.equal(f.plan, "AGENCY");
  assert.equal(f.cancelAtPeriodEnd, true);
  assert.equal(f.currentPeriodEnd?.toISOString(), "2027-01-15T08:00:00.000Z");
});

test("grâce de 30 jours : ouverte en perdant le passeport, effacée en le retrouvant", () => {
  assert.equal(passportGraceUntil({ plan: "AGENCY", passportGraceUntil: null }, "FREE", NOW)?.toISOString(), "2026-11-29T12:00:00.000Z");
  assert.equal(passportGraceUntil({ plan: "CREATOR", passportGraceUntil: null }, "FREE", NOW)?.toISOString(), "2026-11-29T12:00:00.000Z");
  // Agence → Creator : le passeport reste inclus, pas de grâce
  assert.equal(passportGraceUntil({ plan: "AGENCY", passportGraceUntil: null }, "CREATOR", NOW), null);
  // Événement suivant sans changement : la date d'origine est conservée (pas de prolongation)
  const first = new Date("2026-11-10T00:00:00Z");
  assert.equal(passportGraceUntil({ plan: "FREE", passportGraceUntil: first }, "FREE", NOW), first);
  assert.equal(passportGraceUntil({ plan: "FREE", passportGraceUntil: first }, "CREATOR", NOW), null);
});

test("limites des trois forfaits", () => {
  assert.equal(limitReached("FREE", "projects", 0), false);
  assert.equal(limitReached("FREE", "projects", 1), true);
  assert.equal(limitReached("FREE", "licenses", 10), true);
  assert.equal(limitReached("CREATOR", "projects", 4), false);
  assert.equal(limitReached("CREATOR", "projects", 5), true);
  assert.equal(limitReached("CREATOR", "licenses", 50), true);
  assert.equal(limitReached("CREATOR", "members", 1), true);
  assert.equal(limitReached("AGENCY", "projects", 10_000), false);
  assert.equal(hasFeature("FREE", "passport"), false);
  assert.equal(hasFeature("CREATOR", "passport"), true);
  assert.equal(hasFeature("CREATOR", "whiteLabel"), false);
  assert.equal(hasFeature("AGENCY", "whiteLabel"), true);
});

test("montée en gamme proposée : le premier forfait qui lève la limite", () => {
  assert.equal(upgradeTarget("FREE", "projects"), "CREATOR");
  assert.equal(upgradeTarget("CREATOR", "projects"), "AGENCY");
  assert.equal(upgradeTarget("FREE", "members"), "AGENCY");
  assert.match(limitMessage("FREE", "licenses"), /limité à 10 licences\. Passez au plan Creator/);
});
