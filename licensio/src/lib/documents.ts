// Règles des preuves (licences, factures), partagées par le navigateur et le serveur.
// Le bucket applique les mêmes limites (scripts/setup-storage.ts) : c'est lui qui fait
// foi, puisque le navigateur envoie les fichiers directement à Supabase Storage.
export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export const DOCUMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";
export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_MAX_FILES = 5;

export function isAllowedDocumentType(mime: string): mime is (typeof DOCUMENT_MIME_TYPES)[number] {
  return (DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}
