import type { FindingCode, LicenseType, Platform, ProjectUsage } from "@prisma/client";
import { LICENSE_TYPE_LABELS, PLATFORM_LABELS } from "@/lib/labels";

type Ctx = {
  projectId: string;
  usage: ProjectUsage;
  asset: { assetName: string; author: string | null; platform: Platform | null; assetType: string; sourceUrl: string | null };
  license: { assetName: string; platform: Platform } | null;
};

export type Recommendation = { text: string; action?: { label: string; href: string } };

const REQUIRED: Record<ProjectUsage, LicenseType> = { PERSONAL: "PERSONAL", COMMERCIAL: "COMMERCIAL", BROADCAST: "EXTENDED" };

// Lien vers le formulaire du coffre-fort pré-rempli avec la ressource, qui ramène au projet.
function addLicenseHref(ctx: Ctx, licenseType?: LicenseType) {
  const q = new URLSearchParams({ assetName: ctx.asset.assetName, assetType: ctx.asset.assetType, returnTo: `/projects/${ctx.projectId}` });
  if (ctx.asset.author) q.set("author", ctx.asset.author);
  const platform = ctx.asset.platform ?? ctx.license?.platform;
  if (platform) q.set("platform", platform);
  if (ctx.asset.sourceUrl) q.set("sourceUrl", ctx.asset.sourceUrl);
  if (licenseType) q.set("licenseType", licenseType);
  return `/vault/new?${q}`;
}

export function recommendationFor(code: FindingCode, ctx: Ctx): Recommendation | null {
  const required = REQUIRED[ctx.usage];
  const platform = ctx.license ? PLATFORM_LABELS[ctx.license.platform] : "la plateforme";
  switch (code) {
    case "LICENSED":
      return null;
    case "MISSING_LICENSE":
      return {
        text: "Ajoutez la licence de cette ressource au coffre-fort. Si elle y est déjà sous un autre titre, associez-la ci-dessous.",
        action: { label: "Ajouter la licence manquante", href: addLicenseHref(ctx, ctx.usage === "PERSONAL" ? undefined : required) },
      };
    case "LICENSE_TYPE_INSUFFICIENT":
      return {
        text: `Obtenez une licence ${LICENSE_TYPE_LABELS[required].toLowerCase()} auprès de ${platform}, puis enregistrez-la. À défaut, remplacez la ressource dans le montage.`,
        action: { label: `Ajouter la licence ${LICENSE_TYPE_LABELS[required].toLowerCase()}`, href: addLicenseHref(ctx, required) },
      };
    case "LICENSE_EXPIRED":
      return {
        text: "Renouvelez la licence (ou retirez la vidéo tant qu'elle n'est plus couverte), ou remplacez la ressource.",
        action: { label: "Ajouter la licence renouvelée", href: addLicenseHref(ctx, required) },
      };
    case "LICENSE_EXPIRING_SOON":
      return {
        text: "Publiez avant l'échéance (et renseignez la date de diffusion du projet), ou renouvelez la licence.",
      };
    case "LICENSE_REVOKED":
      return { text: "Cette licence ne vous couvre plus : obtenez-en une nouvelle ou remplacez la ressource." };
    case "MISSING_PROOF":
      return {
        text: "Joignez le certificat de licence ou la facture : sans preuve, vous ne pourrez pas répondre à une réclamation.",
        action: ctx.license
          ? { label: "Joindre une preuve", href: `/vault?q=${encodeURIComponent(ctx.license.assetName)}` }
          : undefined,
      };
    case "PLATFORM_MISMATCH":
      return { text: "Vérifiez la plateforme de la ressource, ou associez la bonne licence ci-dessous." };
    case "LICENSE_RESTRICTED":
      return { text: "Relisez les conditions de cette licence (projet unique, usage éditorial…) avant de livrer." };
  }
}
