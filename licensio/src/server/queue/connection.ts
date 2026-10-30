import IORedis from "ioredis";

// BullMQ exige maxRetriesPerRequest: null sur les connexions des workers.
export function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
}
