import type { AssetType, DocumentKind, LicenseType, Platform, WorkspaceRole } from "@prisma/client";

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
