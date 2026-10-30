// Process séparé de Next : `npm run worker`.
import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { computeAudioFingerprint } from "@/server/processing/fingerprint";
import { extractLicenseFields } from "@/server/processing/ocr";
import { createRedisConnection } from "./connection";
import { DOCUMENT_QUEUE, MEDIA_QUEUE, type DocumentJobData, type MediaJobData } from "./queues";

const mediaWorker = new Worker<MediaJobData>(
  MEDIA_QUEUE,
  async (job) => {
    const media = await prisma.mediaFile.update({
      where: { id: job.data.mediaFileId },
      data: { processingStatus: "PROCESSING", processingError: null },
    });
    const { fingerprint } = await computeAudioFingerprint({
      mediaFileId: media.id,
      storagePath: media.storagePath,
      externalUrl: media.externalUrl,
    });
    await prisma.mediaFile.update({
      where: { id: media.id },
      data: { processingStatus: "DONE", fingerprint },
    });
  },
  { connection: createRedisConnection(), concurrency: 2 },
);

const documentWorker = new Worker<DocumentJobData>(
  DOCUMENT_QUEUE,
  async (job) => {
    const doc = await prisma.licenseDocument.update({
      where: { id: job.data.documentId },
      data: { ocrStatus: "PROCESSING" },
    });
    const { text, fields } = await extractLicenseFields({
      documentId: doc.id,
      storagePath: doc.storagePath,
      mimeType: doc.mimeType,
    });
    await prisma.licenseDocument.update({
      where: { id: doc.id },
      data: { ocrStatus: "DONE", ocrText: text, ocrFields: fields },
    });
  },
  { connection: createRedisConnection(), concurrency: 2 },
);

// Échec définitif (toutes les tentatives épuisées) : on le note en base.
mediaWorker.on("failed", async (job, err) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  await prisma.mediaFile.update({
    where: { id: job.data.mediaFileId },
    data: { processingStatus: "FAILED", processingError: err.message.slice(0, 500) },
  });
});
documentWorker.on("failed", async (job) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  await prisma.licenseDocument.update({ where: { id: job.data.documentId }, data: { ocrStatus: "FAILED" } });
});

async function shutdown() {
  await Promise.all([mediaWorker.close(), documentWorker.close()]);
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[worker] à l'écoute de « ${MEDIA_QUEUE} » et « ${DOCUMENT_QUEUE} »`);
