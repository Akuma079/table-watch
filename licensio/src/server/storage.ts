import "server-only";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

// Les objets sont rangés par espace de travail : <workspaceId>/<uuid>/<fichier>.
// Le préfixe permet de vérifier qu'un chemin envoyé par le navigateur appartient bien
// à l'espace actif avant de l'enregistrer ou de le supprimer.
export function workspacePrefix(workspaceId: string) {
  return `${workspaceId}/`;
}

export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "document"}${ext ? `.${ext}` : ""}`;
}

function licensesBucket() {
  return createAdminClient().storage.from(serverEnv().SUPABASE_BUCKET_LICENSES);
}

// URL d'envoi à usage unique (valable 2 h) : le navigateur envoie le fichier directement
// à Supabase, sans passer par le serveur Next (pas de limite de taille de requête).
export async function createDocumentUploadUrl(workspaceId: string, fileName: string) {
  const path = `${workspacePrefix(workspaceId)}${randomUUID()}/${safeFileName(fileName)}`;
  const { data, error } = await licensesBucket().createSignedUploadUrl(path);
  if (error) throw error;
  return { path, signedUrl: data.signedUrl };
}

// Métadonnées réelles de l'objet (taille, type) : on ne se fie pas à ce que déclare le navigateur.
export async function getDocumentInfo(path: string) {
  const { data, error } = await licensesBucket().info(path);
  if (error || !data) return null;
  return { size: data.size ?? 0, contentType: data.contentType ?? "application/octet-stream" };
}

// URL de lecture temporaire. `downloadAs` force le téléchargement sous ce nom ;
// sinon le navigateur affiche le fichier (aperçu du PDF).
export async function createDocumentReadUrl(path: string, downloadAs?: string) {
  const { data, error } = await licensesBucket().createSignedUrl(path, 60, downloadAs ? { download: downloadAs } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeDocuments(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await licensesBucket().remove(paths);
  if (error) throw error;
}
