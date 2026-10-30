import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/server";
import { cleanupOrphanDocuments } from "@/server/storage-cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Tâche planifiée (vercel.json, tous les jours) : supprime les preuves envoyées mais jamais
// enregistrées depuis plus de 24 h. Vercel envoie « Authorization: Bearer $CRON_SECRET ».
export async function GET(req: NextRequest) {
  const env = serverEnv();
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await cleanupOrphanDocuments({
    bucket: createAdminClient().storage.from(env.SUPABASE_BUCKET_LICENSES),
    referenced: async (paths) => {
      const rows = await prisma.licenseDocument.findMany({ where: { storagePath: { in: paths } }, select: { storagePath: true } });
      return new Set(rows.map((r) => r.storagePath));
    },
  });
  console.log(`[storage-cleanup] ${result.removed.length} fichier(s) orphelin(s) supprimé(s) sur ${result.scanned}`);
  return NextResponse.json({ scanned: result.scanned, removed: result.removed.length });
}
