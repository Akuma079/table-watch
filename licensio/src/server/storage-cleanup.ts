// Suppression des fichiers envoyés dans le bucket des preuves mais jamais rattachés à une
// licence (formulaire abandonné, onglet fermé…). Sans dépendance à Next : utilisé par la
// route planifiée /api/cron/storage-cleanup et par `npm run storage:cleanup`.

export const ORPHAN_MAX_AGE_HOURS = 24;
const PAGE = 1000;

type Entry = { name: string; id: string | null; created_at?: string | null };
export type CleanupBucket = {
  list(prefix: string, options: { limit: number; offset: number }): Promise<{ data: Entry[] | null; error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
};

async function listAll(bucket: CleanupBucket, prefix: string) {
  const out: Entry[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

// Arborescence <workspaceId>/<uuid>/<fichier> : les dossiers sont listés sans `id`.
async function* walk(bucket: CleanupBucket, prefix = "", depth = 0): AsyncGenerator<{ path: string; createdAt: Date | null }> {
  for (const entry of await listAll(bucket, prefix)) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      if (depth < 4) yield* walk(bucket, path, depth + 1);
    } else {
      yield { path, createdAt: entry.created_at ? new Date(entry.created_at) : null };
    }
  }
}

export async function cleanupOrphanDocuments(input: {
  bucket: CleanupBucket;
  // Renvoie, parmi ces chemins, ceux qui sont rattachés à une licence.
  referenced: (paths: string[]) => Promise<Set<string>>;
  now?: Date;
  dryRun?: boolean;
}) {
  const cutoff = (input.now ?? new Date()).getTime() - ORPHAN_MAX_AGE_HOURS * 3600 * 1000;
  let scanned = 0;
  const candidates: string[] = [];
  for await (const file of walk(input.bucket)) {
    scanned++;
    // Date inconnue : on ne prend pas le risque.
    if (file.createdAt && file.createdAt.getTime() < cutoff) candidates.push(file.path);
  }

  const orphans: string[] = [];
  for (let i = 0; i < candidates.length; i += 500) {
    const batch = candidates.slice(i, i + 500);
    const used = await input.referenced(batch);
    orphans.push(...batch.filter((p) => !used.has(p)));
  }

  if (!input.dryRun) {
    for (let i = 0; i < orphans.length; i += 100) {
      const { error } = await input.bucket.remove(orphans.slice(i, i + 100));
      if (error) throw error;
    }
  }
  return { scanned, removed: orphans };
}
