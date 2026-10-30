import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanupOrphanDocuments, type CleanupBucket } from "./storage-cleanup";

const NOW = new Date("2026-10-30T12:00:00Z");

function fakeBucket(files: Record<string, string>) {
  const removed: string[] = [];
  const bucket: CleanupBucket = {
    async list(prefix) {
      const depth = prefix ? prefix.split("/").length : 0;
      const names = new Map<string, string | null>();
      for (const [path, created] of Object.entries(files)) {
        if (prefix && !path.startsWith(`${prefix}/`)) continue;
        const parts = path.split("/");
        names.set(parts[depth], parts.length === depth + 1 ? created : null);
      }
      return {
        data: [...names].map(([name, created]) => ({ name, id: created ? `id-${name}` : null, created_at: created })),
        error: null,
      };
    },
    async remove(paths) {
      removed.push(...paths);
      return { error: null };
    },
  };
  return { bucket, removed };
}

test("supprime les fichiers non rattachés de plus de 24 h, garde les autres", async () => {
  const { bucket, removed } = fakeBucket({
    "ws1/u1/vieux-orphelin.pdf": "2026-10-28T10:00:00Z",
    "ws1/u2/vieux-rattache.pdf": "2026-10-28T10:00:00Z",
    "ws1/u3/recent.pdf": "2026-10-30T08:00:00Z",
    "ws2/u4/autre-espace.pdf": "2026-10-01T08:00:00Z",
  });
  const r = await cleanupOrphanDocuments({
    bucket,
    referenced: async (paths) => new Set(paths.filter((p) => p.includes("rattache"))),
    now: NOW,
  });
  assert.equal(r.scanned, 4);
  assert.deepEqual(removed.sort(), ["ws1/u1/vieux-orphelin.pdf", "ws2/u4/autre-espace.pdf"]);
});

test("mode simulation : rien n'est supprimé", async () => {
  const { bucket, removed } = fakeBucket({ "ws1/u1/a.pdf": "2026-10-01T00:00:00Z" });
  const r = await cleanupOrphanDocuments({ bucket, referenced: async () => new Set(), now: NOW, dryRun: true });
  assert.deepEqual(r.removed, ["ws1/u1/a.pdf"]);
  assert.equal(removed.length, 0);
});
