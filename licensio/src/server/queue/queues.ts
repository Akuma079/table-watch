import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";

export const MEDIA_QUEUE = "media-processing";
export const DOCUMENT_QUEUE = "document-ocr";

export type MediaJobData = { mediaFileId: string };
export type DocumentJobData = { documentId: string };

// Instances paresseuses : importer ce module ne doit pas ouvrir de connexion Redis
// (ex. pendant `next build`).
let mediaQueue: Queue<MediaJobData> | undefined;
let documentQueue: Queue<DocumentJobData> | undefined;

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
};

export function getMediaQueue() {
  mediaQueue ??= new Queue<MediaJobData>(MEDIA_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions,
  });
  return mediaQueue;
}

export function getDocumentQueue() {
  documentQueue ??= new Queue<DocumentJobData>(DOCUMENT_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions,
  });
  return documentQueue;
}
