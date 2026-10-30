"use server";

import type { MediaSource } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_ASSETS_PER_PROJECT } from "@/lib/asset-parse";
import { hasFeature, limitMessage, limitReached } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireWorkspaceRole } from "@/server/auth";
import { getMediaQueue } from "@/server/queue/queues";
import { checkCompliance } from "@/server/services/compliance";
import { normalizeAssetName } from "@/server/services/normalize";
import { newPassportToken, passportUrl } from "@/server/passport/data";
import { fieldErrors, str } from "./form";
import type { FormState } from "./types";

const PLATFORMS = [
  "ARTLIST",
  "ENVATO_ELEMENTS",
  "EPIDEMIC_SOUND",
  "ARTGRID",
  "MUSICBED",
  "SOUNDSTRIPE",
  "STORYBLOCKS",
  "SHUTTERSTOCK",
  "ADOBE_STOCK",
  "POND5",
  "OTHER",
] as const;

const assetInput = z.object({
  assetName: z.string().trim().min(1, "Titre requis.").max(200),
  author: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
  platform: z
    .union([z.literal(""), z.enum(PLATFORMS)])
    .optional()
    .transform((v) => v || null),
  assetType: z.enum(["MUSIC", "SFX", "STOCK_VIDEO", "IMAGE", "FONT", "OTHER"]).default("MUSIC"),
  sourceUrl: z
    .union([z.literal(""), z.string().trim().url().max(500)])
    .optional()
    .transform((v) => v || null),
});
type AssetInput = z.infer<typeof assetInput>;

function parseAssets(raw: string) {
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : [];
  } catch {
    json = null;
  }
  return z.array(assetInput).max(MAX_ASSETS_PER_PROJECT, `${MAX_ASSETS_PER_PROJECT} ressources maximum.`).safeParse(json);
}

// Une même ressource déclarée deux fois (même nom, même plateforme) n'est gardée qu'une fois.
function dedupe(assets: AssetInput[], existing: { normalizedName: string; platform: string | null }[] = []) {
  const seen = new Set(existing.map((a) => `${a.normalizedName}|${a.platform ?? ""}`));
  return assets
    .map((a) => ({ ...a, normalizedName: normalizeAssetName(a.assetName) }))
    .filter((a) => {
      const key = `${a.normalizedName}|${a.platform ?? ""}`;
      if (!a.normalizedName || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mediaSource(url: string): MediaSource {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return "YOUTUBE";
  if (/^drive\.google\.com$/.test(host)) return "GOOGLE_DRIVE";
  return "OTHER_URL";
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

const projectInput = z.object({
  name: z.string().trim().min(2, "Donnez un nom au projet.").max(160),
  clientName: z
    .string()
    .trim()
    .max(160)
    .transform((v) => v || null),
  usage: z.enum(["PERSONAL", "COMMERCIAL", "BROADCAST"], { message: "Choisissez l'usage de la vidéo." }),
  publishedAt: z.union([z.literal("").transform(() => null), isoDate]),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null),
  mediaUrl: z.union([z.literal("").transform(() => null), z.string().trim().url("Lien invalide.").max(500)]),
});

const PROJECT_FIELDS = ["name", "clientName", "usage", "publishedAt", "description", "mediaUrl"] as const;

async function memberContext() {
  try {
    return { ctx: await requireWorkspaceRole("MEMBER") };
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(PROJECT_FIELDS.map((k) => [k, str(formData, k)]));
  const { ctx, error } = await memberContext();
  if (!ctx) return { error, values };

  const projectCount = await prisma.project.count({ where: { workspaceId: ctx.workspace.id } });
  if (limitReached(ctx.workspace.plan, "projects", projectCount)) {
    return { error: limitMessage(ctx.workspace.plan, "projects"), values };
  }

  const parsed = projectInput.safeParse(values);
  const assets = parseAssets(str(formData, "assets"));
  if (!parsed.success || !assets.success) {
    return {
      error: assets.success ? "Certains champs sont à corriger." : "La liste des ressources contient une ligne invalide.",
      fieldErrors: parsed.success ? {} : fieldErrors(parsed.error),
      values,
    };
  }
  const data = parsed.data;

  const project = await prisma.project.create({
    data: {
      workspaceId: ctx.workspace.id,
      createdById: ctx.user.id,
      name: data.name,
      clientName: data.clientName,
      usage: data.usage,
      publishedAt: data.publishedAt,
      description: data.description,
      assets: { create: dedupe(assets.data) },
      media: data.mediaUrl ? { create: { source: mediaSource(data.mediaUrl), externalUrl: data.mediaUrl } } : undefined,
    },
    include: { media: { select: { id: true } } },
  });

  if (process.env.PROCESSING_QUEUE_ENABLED === "true" && project.media.length > 0) {
    const media = project.media[0];
    await prisma.mediaFile.update({ where: { id: media.id }, data: { processingStatus: "QUEUED" } });
    await getMediaQueue().add("process", { mediaFileId: media.id }, { jobId: `media:${media.id}` });
  }

  await checkCompliance(project.id, ctx.workspace.id);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

// Informations générales du projet. Les ressources se gèrent depuis la page du projet.
// Usage et date de diffusion changent le résultat : le projet est ré-audité.
export async function updateProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(PROJECT_FIELDS.map((k) => [k, str(formData, k)]));
  const { ctx, error } = await memberContext();
  if (!ctx) return { error, values };
  const project = await prisma.project.findFirst({
    where: { id: str(formData, "projectId"), workspaceId: ctx.workspace.id },
    select: { id: true, media: { where: { source: { not: "UPLOAD" } }, select: { id: true, externalUrl: true } } },
  });
  if (!project) return { error: "Projet introuvable.", values };

  const parsed = projectInput.safeParse(values);
  if (!parsed.success) return { error: "Certains champs sont à corriger.", fieldErrors: fieldErrors(parsed.error), values };
  const data = parsed.data;

  const currentUrl = project.media[0]?.externalUrl ?? null;
  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: { name: data.name, clientName: data.clientName, usage: data.usage, publishedAt: data.publishedAt, description: data.description },
    }),
    // Lien de la vidéo modifié : l'ancien lien est remplacé.
    ...(data.mediaUrl !== currentUrl
      ? [
          prisma.mediaFile.deleteMany({ where: { id: { in: project.media.map((m) => m.id) } } }),
          ...(data.mediaUrl
            ? [prisma.mediaFile.create({ data: { projectId: project.id, source: mediaSource(data.mediaUrl), externalUrl: data.mediaUrl } })]
            : []),
        ]
      : []),
  ]);

  await checkCompliance(project.id, ctx.workspace.id);
  refresh(project.id);
  redirect(`/projects/${project.id}?updated=1`);
}

async function projectOf(projectId: string, workspaceId: string) {
  return prisma.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } });
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function addProjectAssets(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, error } = await memberContext();
  if (!ctx) return { error };
  const projectId = str(formData, "projectId");
  if (!(await projectOf(projectId, ctx.workspace.id))) return { error: "Projet introuvable." };

  const assets = parseAssets(str(formData, "assets"));
  if (!assets.success) return { error: "La liste des ressources contient une ligne invalide." };
  const existing = await prisma.projectAsset.findMany({
    where: { projectId },
    select: { normalizedName: true, platform: true },
  });
  if (existing.length + assets.data.length > MAX_ASSETS_PER_PROJECT) {
    return { error: `${MAX_ASSETS_PER_PROJECT} ressources maximum par projet.` };
  }
  const fresh = dedupe(assets.data, existing);
  if (fresh.length === 0) return { error: "Ces ressources sont déjà dans le projet." };

  await prisma.projectAsset.createMany({ data: fresh.map((a) => ({ ...a, projectId })) });
  await checkCompliance(projectId, ctx.workspace.id);
  refresh(projectId);
  return { success: `${fresh.length} ressource${fresh.length > 1 ? "s ajoutées" : " ajoutée"}.` };
}

export async function removeProjectAsset(formData: FormData) {
  const ctx = await requireWorkspaceRole("MEMBER");
  const asset = await prisma.projectAsset.findFirst({
    where: { id: str(formData, "assetId"), project: { workspaceId: ctx.workspace.id } },
    select: { id: true, projectId: true },
  });
  if (!asset) return;
  await prisma.projectAsset.delete({ where: { id: asset.id } });
  await checkCompliance(asset.projectId, ctx.workspace.id);
  refresh(asset.projectId);
}

// Associe une licence précise à une ressource (titres différents, versions…).
// Valeur vide : retour à la correspondance automatique.
export async function linkAssetLicense(formData: FormData) {
  const ctx = await requireWorkspaceRole("MEMBER");
  const asset = await prisma.projectAsset.findFirst({
    where: { id: str(formData, "assetId"), project: { workspaceId: ctx.workspace.id } },
    select: { id: true, projectId: true },
  });
  if (!asset) return;

  const licenseId = str(formData, "licenseId");
  if (licenseId) {
    const license = await prisma.license.findFirst({ where: { id: licenseId, workspaceId: ctx.workspace.id } });
    if (!license) return;
    await prisma.projectAsset.update({ where: { id: asset.id }, data: { licenseId, matchMethod: "MANUAL" } });
  } else {
    await prisma.projectAsset.update({ where: { id: asset.id }, data: { licenseId: null, matchMethod: null } });
  }
  await checkCompliance(asset.projectId, ctx.workspace.id);
  refresh(asset.projectId);
}

// Licence à utilité restreinte : un membre confirme que ses conditions couvrent ce projet.
// La validation porte sur la licence associée à ce moment-là, et sur elle seule.
export async function setRestrictedApproval(formData: FormData) {
  const ctx = await requireWorkspaceRole("MEMBER");
  const asset = await prisma.projectAsset.findFirst({
    where: { id: str(formData, "assetId"), project: { workspaceId: ctx.workspace.id } },
    select: { id: true, projectId: true, license: { select: { id: true, licenseType: true } } },
  });
  if (!asset) return;

  if (str(formData, "approve") === "1") {
    if (asset.license?.licenseType !== "RESTRICTED") return;
    await prisma.projectAsset.update({
      where: { id: asset.id },
      data: { restrictedApprovedLicenseId: asset.license.id, restrictedApprovedAt: new Date(), restrictedApprovedById: ctx.user.id },
    });
  } else {
    await prisma.projectAsset.update({
      where: { id: asset.id },
      data: { restrictedApprovedLicenseId: null, restrictedApprovedAt: null, restrictedApprovedById: null },
    });
  }
  await checkCompliance(asset.projectId, ctx.workspace.id);
  refresh(asset.projectId);
}

export async function runProjectAudit(formData: FormData) {
  const ctx = await requireWorkspaceRole("VIEWER");
  const projectId = str(formData, "projectId");
  if (!(await projectOf(projectId, ctx.workspace.id))) return;
  await checkCompliance(projectId, ctx.workspace.id);
  refresh(projectId);
}

export async function deleteProject(formData: FormData) {
  const ctx = await requireWorkspaceRole("MEMBER");
  const project = await projectOf(str(formData, "projectId"), ctx.workspace.id);
  if (!project) return;
  const { name } = await prisma.project.delete({ where: { id: project.id }, select: { name: true } });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects?deleted=${encodeURIComponent(name.slice(0, 120))}`);
}

// ───────── Passeport de Droits ─────────

export type PassportLinkResult = { url: string } | { error: string };

// Active le lien public (en le créant au besoin) et renvoie son URL pour la copier.
export async function enablePassport(projectId: string): Promise<PassportLinkResult> {
  const { ctx, error } = await memberContext();
  if (!ctx) return { error: error ?? "Accès refusé." };
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: ctx.workspace.id },
    select: { id: true, passportToken: true },
  });
  if (!project) return { error: "Projet introuvable." };
  if (!hasFeature(ctx.workspace.plan, "passport")) {
    return { error: "Le Passeport de Droits est inclus dans les forfaits Creator et Agence." };
  }

  const token = project.passportToken ?? newPassportToken();
  await prisma.project.update({ where: { id: project.id }, data: { passportToken: token, passportEnabled: true } });
  revalidatePath(`/projects/${project.id}`);
  return { url: passportUrl(token) };
}

export async function disablePassport(formData: FormData) {
  const ctx = await requireWorkspaceRole("MEMBER");
  const project = await projectOf(str(formData, "projectId"), ctx.workspace.id);
  if (!project) return;
  await prisma.project.update({ where: { id: project.id }, data: { passportEnabled: false } });
  revalidatePath(`/projects/${project.id}`);
}

// Nouveau jeton : l'ancien lien cesse aussitôt de fonctionner (lien transmis par erreur…).
export async function regeneratePassport(formData: FormData) {
  const ctx = await requireWorkspaceRole("MEMBER");
  const project = await projectOf(str(formData, "projectId"), ctx.workspace.id);
  if (!project || !hasFeature(ctx.workspace.plan, "passport")) return;
  await prisma.project.update({
    where: { id: project.id },
    data: { passportToken: newPassportToken(), passportEnabled: true },
  });
  revalidatePath(`/projects/${project.id}`);
}
