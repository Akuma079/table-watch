// Crée (ou met à jour) le bucket privé des preuves de licence.
// Usage : npm run storage:setup
import { createClient } from "@supabase/supabase-js";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES } from "../src/lib/documents";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET_LICENSES || "license-documents";
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (fichier .env).");
  process.exit(1);
}

const storage = createClient(url, key, { auth: { persistSession: false } }).storage;
const options = {
  public: false,
  fileSizeLimit: DOCUMENT_MAX_BYTES,
  allowedMimeTypes: [...DOCUMENT_MIME_TYPES],
};

async function main() {
  const { data: existing } = await storage.getBucket(bucket);
  const { error } = existing ? await storage.updateBucket(bucket, options) : await storage.createBucket(bucket, options);
  if (error) throw error;
  console.log(`Bucket « ${bucket} » ${existing ? "mis à jour" : "créé"} : privé, 15 Mo max, PDF/PNG/JPEG/WebP.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
