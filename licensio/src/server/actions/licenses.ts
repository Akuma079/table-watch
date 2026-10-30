"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MAX_FILES, isAllowedDocumentType } from "@/lib/documents";
import { limitMessage, limitReached } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { safeNextPath } from "@/lib/redirect";
import { ForbiddenError, requireWorkspaceRole } from "@/server/auth";
import { getDocumentQueue } from "@/server/queue/queues";
import { auditWorkspaceProjects } from "@/server/services/compliance";
import { normalizeAssetName } from "@/server/services/normalize";
import {
  createDocumentUploadUrl,
  getDocumentInfo,
  removeDocuments,
  workspacePrefix,
} from "@/server/storage";
import { fieldErrors, str } from "./form";
import type { FormState } from "./types";

// ───────── Envoi des fichiers (appelé par la zone de dépôt, avant l'enregistrement) ─────────

export type PrepareUploadResult = { path: string; signedUrl: string } | { error: string };

export async function prepareDocumentUpload(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<PrepareUploadResult> {
  let ctx;
  try {
    ctx = await requireWorkspaceRole("MEMBER");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  if (!isAllowedDocumentType(input.mimeType)) return { error: "Format accepté : PDF, PNG, JPEG ou WebP." };
  if (!(input.size > 0) || input.size > DOCUMENT_MAX_BYTES) return { error: "Fichier vide ou trop lourd (15 Mo max)." };

  try {
    return await createDocumentUploadUrl(ctx.workspace.id, input.fileName);
  } catch (e) {
    console.error("[storage] createSignedUploadUrl", e);
    return { error: "Le stockage est indisponible. Réessayez dans un instant." };
  }
}

// Fichier retiré de la zone de dépôt avant l'enregistrement de la licence.
export async function discardDocumentUpload(path: string) {
  const ctx = await requireWorkspaceRole("MEMBER");
  if (!path.startsWith(workspacePrefix(ctx.workspace.id))) return;
  // Ne jamais supprimer un fichier déjà rattaché à une licence.
  const used = await prisma.licenseDocument.findUnique({ where: { storagePath: path }, select: { id: true } });
  if (!used) await removeDocuments([path]).catch((e) => console.error("[storage] remove", e));
}

// ───────── Création d'une licence ─────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

const documentInput = z.object({
  storagePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
  kind: z.enum(["LICENSE_CERTIFICATE", "INVOICE", "RECEIPT", "OTHER"]),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const licenseInput = z
  .object({
    assetName: z.string().trim().min(1, "Indiquez le titre de la ressource.").max(200),
    author: optionalText(200),
    assetType: z.enum(["MUSIC", "SFX", "STOCK_VIDEO", "IMAGE", "FONT", "OTHER"]),
    platform: z.enum(
      [
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
      ],
      { message: "Choisissez une plateforme." },
    ),
    platformOther: optionalText(100),
    licenseType: z.enum(["PERSONAL", "COMMERCIAL", "EXTENDED", "RESTRICTED"], {
      message: "Choisissez un type de licence.",
    }),
    purchaseDate: z.string().min(1, "Indiquez la date d'achat.").pipe(isoDate),
    expiresAt: z.union([z.literal("").transform(() => null), isoDate]),
    licenseKey: optionalText(200),
    sourceUrl: z.union([z.literal("").transform(() => null), z.string().trim().url("Lien invalide.").max(500)]),
    notes: optionalText(2000),
    documents: z.array(documentInput).max(DOCUMENT_MAX_FILES, `${DOCUMENT_MAX_FILES} fichiers maximum.`),
  })
  .superRefine((d, ctx) => {
    if (d.platform === "OTHER" && !d.platformOther) {
      ctx.addIssue({ code: "custom", path: ["platformOther"], message: "Précisez la plateforme." });
    }
    if (d.purchaseDate.getTime() > Date.now()) {
      ctx.addIssue({ code: "custom", path: ["purchaseDate"], message: "La date d'achat est dans le futur." });
    }
    if (d.expiresAt && d.expiresAt < d.purchaseDate) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "L'expiration précède la date d'achat." });
    }
  });

// Chaque fichier doit appartenir à l'espace actif et exister réellement dans le bucket ;
// taille et type sont relus côté Storage.
async function verifiedDocuments(docs: z.infer<typeof documentInput>[], workspaceId: string, userId: string) {
  const prefix = workspacePrefix(workspaceId);
  const documents = [];
  for (const doc of docs) {
    const info = doc.storagePath.startsWith(prefix) ? await getDocumentInfo(doc.storagePath) : null;
    if (!info) return { error: `Le fichier « ${doc.fileName} » est introuvable. Ajoutez-le à nouveau.` };
    documents.push({
      kind: doc.kind,
      fileName: doc.fileName,
      storagePath: doc.storagePath,
      mimeType: info.contentType,
      sizeBytes: info.size,
      uploadedById: userId,
    });
  }
  return { documents };
}

async function enqueueOcr(documentIds: string[]) {
  if (process.env.PROCESSING_QUEUE_ENABLED !== "true" || documentIds.length === 0) return;
  await prisma.licenseDocument.updateMany({ where: { id: { in: documentIds } }, data: { ocrStatus: "QUEUED" } });
  await getDocumentQueue().addBulk(
    documentIds.map((id) => ({ name: "ocr", data: { documentId: id }, opts: { jobId: `ocr:${id}` } })),
  );
}

const TEXT_FIELDS = [
  "assetName",
  "author",
  "assetType",
  "platform",
  "platformOther",
  "licenseType",
  "purchaseDate",
  "expiresAt",
  "licenseKey",
  "sourceUrl",
  "notes",
] as const;

function parseDocuments(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return null;
  }
}

export async function createLicense(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(TEXT_FIELDS.map((k) => [k, str(formData, k)]));
  let ctx;
  try {
    ctx = await requireWorkspaceRole("MEMBER");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message, values };
    throw e;
  }

  const licenseCount = await prisma.license.count({ where: { workspaceId: ctx.workspace.id } });
  if (limitReached(ctx.workspace.plan, "licenses", licenseCount)) {
    return { error: limitMessage(ctx.workspace.plan, "licenses"), values };
  }

  const parsed = licenseInput.safeParse({ ...values, documents: parseDocuments(str(formData, "documents")) });
  if (!parsed.success) {
    return { error: "Certains champs sont à corriger.", fieldErrors: fieldErrors(parsed.error), values };
  }
  const data = parsed.data;

  const checked = await verifiedDocuments(data.documents, ctx.workspace.id, ctx.user.id);
  if ("error" in checked) return { error: checked.error, values };
  const documents = checked.documents;

  const license = await prisma.license.create({
    data: {
      workspaceId: ctx.workspace.id,
      createdById: ctx.user.id,
      assetName: data.assetName,
      normalizedName: normalizeAssetName(data.assetName),
      author: data.author,
      assetType: data.assetType,
      platform: data.platform,
      platformOther: data.platform === "OTHER" ? data.platformOther : null,
      licenseType: data.licenseType,
      purchaseDate: data.purchaseDate,
      expiresAt: data.expiresAt,
      licenseKey: data.licenseKey,
      sourceUrl: data.sourceUrl,
      notes: data.notes,
      documents: { create: documents },
    },
    include: { documents: { select: { id: true } } },
  });

  await enqueueOcr(license.documents.map((d) => d.id));
  // Une nouvelle licence peut couvrir des ressources déjà déclarées dans des projets.
  await auditWorkspaceProjects(ctx.workspace.id);

  revalidatePath("/vault");
  revalidatePath("/projects", "layout");
  revalidatePath("/dashboard");
  const back = safeNextPath(str(formData, "returnTo"), "");
  redirect(back.startsWith("/projects/") ? `${back}?licenseAdded=1` : `/vault?added=${license.id}`);
}

// ───────── Suppression ─────────

export async function deleteLicense(formData: FormData) {
  const ctx = await requireWorkspaceRole("MEMBER");
  const license = await prisma.license.findFirst({
    where: { id: str(formData, "licenseId"), workspaceId: ctx.workspace.id },
    include: { documents: { select: { storagePath: true } } },
  });
  if (!license) return;

  await prisma.license.delete({ where: { id: license.id } });
  // Après la base : un fichier orphelin vaut mieux qu'une licence pointant vers un fichier supprimé.
  await removeDocuments(license.documents.map((d) => d.storagePath)).catch((e) =>
    console.error("[storage] remove", e),
  );
  await auditWorkspaceProjects(ctx.workspace.id);
  revalidatePath("/vault");
  revalidatePath("/projects", "layout");
  revalidatePath("/dashboard");
}

// ───────── Preuves ajoutées à une licence existante ─────────

export async function attachLicenseDocuments(_prev: FormState, formData: FormData): Promise<FormState> {
  let ctx;
  try {
    ctx = await requireWorkspaceRole("MEMBER");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  const license = await prisma.license.findFirst({
    where: { id: str(formData, "licenseId"), workspaceId: ctx.workspace.id },
    select: { id: true, _count: { select: { documents: true } } },
  });
  if (!license) return { error: "Licence introuvable." };

  const parsed = z
    .array(documentInput)
    .min(1, "Ajoutez au moins un fichier.")
    .max(DOCUMENT_MAX_FILES - license._count.documents, `${DOCUMENT_MAX_FILES} fichiers maximum par licence.`)
    .safeParse(parseDocuments(str(formData, "documents")));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const checked = await verifiedDocuments(parsed.data, ctx.workspace.id, ctx.user.id);
  if ("error" in checked) return { error: checked.error };

  const created = await prisma.$transaction(
    checked.documents.map((d) => prisma.licenseDocument.create({ data: { ...d, licenseId: license.id }, select: { id: true } })),
  );
  await enqueueOcr(created.map((d) => d.id));
  await auditWorkspaceProjects(ctx.workspace.id);
  revalidatePath("/vault");
  revalidatePath("/projects", "layout");
  revalidatePath("/dashboard");
  return { success: `${created.length} preuve${created.length > 1 ? "s ajoutées" : " ajoutée"}.` };
}
