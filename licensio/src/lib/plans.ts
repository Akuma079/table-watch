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
  CREATOR: {
    name: "Creator",
    tagline: "Pour les créateurs solo qui veulent garder leurs licences en ordre.",
    monthlyEur: 0,
    limits: { projects: 5, licenses: 50, members: 1 },
    features: { passport: false, whiteLabel: false, multiUser: false },
    highlights: [
      "5 projets audités",
      "50 licences dans le coffre-fort",
      "Preuves PDF et images, aperçu et téléchargement",
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

export function limitMessage(plan: WorkspacePlan, kind: LimitKind) {
  return `Le plan ${PLANS[plan].name} est limité à ${PLANS[plan].limits[kind]} ${LIMIT_LABELS[kind]}. Passez au plan Agence pour aller au-delà.`;
}
