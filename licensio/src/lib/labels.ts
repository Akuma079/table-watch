import type {
  AssetType,
  ComplianceStatus,
  DocumentKind,
  FindingCode,
  LicenseType,
  Platform,
  ProjectUsage,
  WorkspaceRole,
} from "@prisma/client";

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MEMBER: "Membre",
  VIEWER: "Lecture seule",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  ARTLIST: "Artlist",
  ENVATO_ELEMENTS: "Envato Elements",
  EPIDEMIC_SOUND: "Epidemic Sound",
  ARTGRID: "Artgrid",
  MUSICBED: "Musicbed",
  SOUNDSTRIPE: "Soundstripe",
  STORYBLOCKS: "Storyblocks",
  SHUTTERSTOCK: "Shutterstock",
  ADOBE_STOCK: "Adobe Stock",
  POND5: "Pond5",
  OTHER: "Autre",
};

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  PERSONAL: "Personnelle",
  COMMERCIAL: "Commerciale",
  EXTENDED: "Étendue",
  RESTRICTED: "Utilité restreinte",
};

export const LICENSE_TYPE_HINTS: Record<LicenseType, string> = {
  PERSONAL: "Usage non commercial uniquement.",
  COMMERCIAL: "Contenus monétisés, clients, réseaux sociaux.",
  EXTENDED: "TV, cinéma, publicité payante, gros volumes.",
  RESTRICTED: "Conditions particulières : un seul projet, éditorial…",
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  MUSIC: "Musique",
  SFX: "Effet sonore",
  STOCK_VIDEO: "Vidéo de stock",
  IMAGE: "Image",
  FONT: "Police",
  OTHER: "Autre",
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  LICENSE_CERTIFICATE: "Certificat de licence",
  INVOICE: "Facture",
  RECEIPT: "Reçu",
  OTHER: "Autre",
};

export const dateFormat = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric" });
// Les dates de licence sont stockées en @db.Date (minuit UTC) : on les affiche en UTC
// pour ne pas reculer d'un jour selon le fuseau du serveur.
export const dayFormat = new Intl.DateTimeFormat("fr-BE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const PROJECT_USAGE_LABELS: Record<ProjectUsage, string> = {
  PERSONAL: "Personnel",
  COMMERCIAL: "Commercial",
  BROADCAST: "Diffusion TV / pub payante",
};

export const PROJECT_USAGE_HINTS: Record<ProjectUsage, string> = {
  PERSONAL: "Vidéo perso, non monétisée. Toute licence suffit.",
  COMMERCIAL: "Client, chaîne monétisée, réseaux sociaux d'une marque, pub en ligne. Licence commerciale requise.",
  BROADCAST: "Télévision, cinéma, campagne publicitaire payante. Licence étendue requise.",
};

export const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  COMPLIANT: "Conforme",
  WARNING: "Attention",
  NON_COMPLIANT: "Non conforme",
  PENDING: "En attente",
};

export const FINDING_LABELS: Record<FindingCode, string> = {
  LICENSED: "Licence valide",
  MISSING_LICENSE: "Licence manquante",
  LICENSE_EXPIRED: "Licence expirée",
  LICENSE_REVOKED: "Licence révoquée",
  LICENSE_TYPE_INSUFFICIENT: "Licence inadaptée",
  PLATFORM_MISMATCH: "Plateforme différente",
  MISSING_PROOF: "Preuve manquante",
  LICENSE_EXPIRING_SOON: "Expire bientôt",
  LICENSE_RESTRICTED: "À vérifier",
};
