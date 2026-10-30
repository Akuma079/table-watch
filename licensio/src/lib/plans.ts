// Forfaits : source unique pour les limites, les fonctionnalités et la page /pricing.
// Utilisable côté navigateur (aucun secret ici ; l'ID de prix Stripe vient de l'environnement).
import type { WorkspacePlan } from "@prisma/client";

export type PlanLimits = { projects: number | null; licenses: number | null; members: number | null }; // null = illimité
export type PlanFeatures = { passport: boolean; whiteLabel: boolean; multiUser: boolean };

export type PlanDefinition = {
  name: string;
  tagline: string;
  monthlyEur: number; // 0 = gratuit, sans passage par Stripe
  limits: PlanLimits;
  features: PlanFeatures;
  highlights: string[];
};

export const PLANS: Record<WorkspacePlan, PlanDefinition> = {
  FREE: {
    name: "Gratuit",
    tagline: "Pour essayer l'audit sur une vraie vidéo.",
    monthlyEur: 0,
    limits: { projects: 1, licenses: 10, members: 1 },
    features: { passport: false, whiteLabel: false, multiUser: false },
    highlights: [
      "1 projet audité",
      "10 licences dans le coffre-fort",
      "Preuves PDF et images, aperçu et téléchargement",
      "Audit de conformité et recommandations",
    ],
  },
  CREATOR: {
    name: "Creator",
    tagline: "Pour les créateurs solo qui livrent à des marques.",
    monthlyEur: 19,
    limits: { projects: 5, licenses: 50, members: 1 },
    features: { passport: true, whiteLabel: false, multiUser: false },
    highlights: [
      "5 projets audités",
      "50 licences dans le coffre-fort",
      "Passeport de Droits pour vos clients (lien public + PDF)",
      "Audit de conformité et recommandations",
    ],
  },
  AGENCY: {
    name: "Agence",
    tagline: "Pour les agences qui livrent des vidéos à leurs clients.",
    monthlyEur: 79,
    limits: { projects: null, licenses: null, members: null },
    features: { passport: true, whiteLabel: true, multiUser: true },
    highlights: [
      "Projets et licences illimités",
      "Passeport de Droits pour vos clients (lien public + PDF)",
      "Passeport en marque blanche : votre nom, votre couleur",
      "Collaborateurs illimités, rôles et invitations",
    ],
  },
};

// Forfaits payants, du moins cher au plus cher (ordre d'affichage et de montée en gamme).
export const PAID_PLANS = ["CREATOR", "AGENCY"] as const satisfies readonly WorkspacePlan[];
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

// Délai pendant lequel les Passeports déjà partagés restent consultables après la perte
// d'un forfait qui les inclut.
export const PASSPORT_GRACE_DAYS = 30;

export type LimitKind = keyof PlanLimits;

export const LIMIT_LABELS: Record<LimitKind, string> = {
  projects: "projets",
  licenses: "licences",
  members: "membres",
};

// Vrai si l'espace ne peut plus créer d'élément de ce type.
export function limitReached(plan: WorkspacePlan, kind: LimitKind, current: number) {
  const max = PLANS[plan].limits[kind];
  return max !== null && current >= max;
}

export function hasFeature(plan: WorkspacePlan, feature: keyof PlanFeatures) {
  return PLANS[plan].features[feature];
}

// Premier forfait au-dessus de `plan` qui lève la limite (ou l'Agence, illimitée).
export function upgradeTarget(plan: WorkspacePlan, kind: LimitKind): PaidPlan {
  const max = PLANS[plan].limits[kind];
  return PAID_PLANS.find((p) => {
    const next = PLANS[p].limits[kind];
    return next === null || (max !== null && next > max);
  }) ?? "AGENCY";
}

export function limitMessage(plan: WorkspacePlan, kind: LimitKind) {
  const target = PLANS[upgradeTarget(plan, kind)];
  return `Le plan ${PLANS[plan].name} est limité à ${PLANS[plan].limits[kind]} ${LIMIT_LABELS[kind]}. Passez au plan ${target.name} pour aller au-delà.`;
}
