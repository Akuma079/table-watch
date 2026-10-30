// Supprime les preuves envoyées dans le bucket mais jamais rattachées à une licence
// depuis plus de 24 h. En production, la route /api/cron/storage-cleanup le fait chaque jour.
// Usage : npm run storage:cleanup [-- --dry-run]
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { cleanupOrphanDocuments } from "../src/server/storage-cleanup";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET_LICENSES || "license-documents";
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (fichier .env).");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

async function main() {
  const result = await cleanupOrphanDocuments({
    bucket: createClient(url!, key!, { auth: { persistSession: false } }).storage.from(bucket),
    referenced: async (paths) => {
      const rows = await prisma.licenseDocument.findMany({ where: { storagePath: { in: paths } }, select: { storagePath: true } });
      return new Set(rows.map((r) => r.storagePath));
    },
    dryRun,
  });
  for (const p of result.removed) console.log(`${dryRun ? "[simulation] " : ""}supprimé : ${p}`);
  console.log(`${result.removed.length} fichier(s) orphelin(s) ${dryRun ? "à supprimer" : "supprimé(s)"} sur ${result.scanned}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
