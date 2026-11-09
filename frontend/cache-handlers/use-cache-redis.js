/**
 * Plural `cacheHandlers` — backs `'use cache'` / `'use cache: remote'`.
 * Based on https://github.com/vercel/next.js/tree/canary/examples/cache-handler-redis
 */
const { createClient } = require("redis");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");

const ENTRY_PREFIX = "nextjs:use-cache:";
const TAG_PREFIX = "nextjs:use-cache-tag:";
/** Refuse oversized keys (full Article args) — miss instead of melting Redis/CPU. */
const MAX_KEY_BYTES = 2048;

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  disableOfflineQueue: true,
});

client.on("error", (error) => {
  if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
    console.warn("Redis client error (use cache):", error);
  }
});

const connection =
  process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
    ? Promise.resolve()
    : client.connect().catch((error) => {
        console.warn("Failed to connect to Redis (use cache):", error);
      });

const CONNECT_TIMEOUT_MS = 1000;
const ready = Promise.race([
  connection,
  new Promise((resolve) => setTimeout(resolve, CONNECT_TIMEOUT_MS).unref()),
]);

async function getClient() {
  await ready;
  return client.isReady ? client : null;
}

module.exports = {
  async get(cacheKey) {
    if (Buffer.byteLength(String(cacheKey), "utf8") > MAX_KEY_BYTES) {
      return undefined;
    }

    const redis = await getClient();
    if (!redis) return undefined;

    let stored;
    try {
      stored = await redis.get(ENTRY_PREFIX + cacheKey);
    } catch (error) {
      if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
        console.warn("Redis get failed (use cache):", error);
      }
      return undefined;
    }
    if (!stored) return undefined;

    const data = JSON.parse(stored);

    if (Date.now() > data.timestamp + data.expire * 1000) {
      return undefined;
    }

    if (data.tags.length) {
      let revalidatedAt;
      try {
        revalidatedAt = await redis.mGet(
          data.tags.map((tag) => TAG_PREFIX + tag),
        );
      } catch (error) {
        if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
          console.warn("Redis tag lookup failed (use cache):", error);
        }
        return undefined;
      }

      if (
        revalidatedAt.some(
          (time) => time !== null && Number(time) > data.timestamp,
        )
      ) {
        return undefined;
      }
    }

    return {
      value: new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from(data.value, "base64"));
          controller.close();
        },
      }),
      tags: data.tags,
      stale: data.stale,
      timestamp: data.timestamp,
      expire: data.expire,
      revalidate: data.revalidate,
    };
  },

  async set(cacheKey, pendingEntry) {
    if (Buffer.byteLength(String(cacheKey), "utf8") > MAX_KEY_BYTES) {
      // Drain so the stream doesn't hang, but do not store.
      try {
        const entry = await pendingEntry;
        const reader = entry.value.getReader();
        try {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } finally {
          reader.releaseLock();
        }
      } catch {
        /* ignore */
      }
      return;
    }

    const redis = await getClient();
    if (!redis) return;

    const entry = await pendingEntry;

    const reader = entry.value.getReader();
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

    const options = Number.isFinite(entry.expire)
      ? {
          expiration: {
            type: "EX",
            value: Math.max(1, Math.ceil(entry.expire)),
          },
        }
      : {};

    const value = JSON.stringify({
      value: bytes.toString("base64"),
      tags: entry.tags,
      stale: entry.stale,
      timestamp: entry.timestamp,
      expire: entry.expire,
      revalidate: entry.revalidate,
    });

    try {
      await redis.set(ENTRY_PREFIX + cacheKey, value, options);
    } catch (error) {
      if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
        console.warn("Redis set failed (use cache):", error);
      }
    }
  },

  async refreshTags() {},

  async getExpiration(tags) {
    if (!tags.length) return 0;

    const redis = await getClient();
    if (!redis) return Date.now();

    let values;
    try {
      values = await redis.mGet(tags.map((tag) => TAG_PREFIX + tag));
    } catch (error) {
      if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
        console.warn("Redis tag lookup failed (use cache):", error);
      }
      return Date.now();
    }

    const timestamps = values.filter(Boolean).map(Number);
    return timestamps.length ? Math.max(...timestamps) : 0;
  },

  async updateTags(tags) {
    const redis = await getClient();
    if (!redis) {
      throw new Error(
        "Redis is unavailable, so the tag revalidation was not recorded",
      );
    }

    const now = String(Date.now());
    await Promise.all(tags.map((tag) => redis.set(TAG_PREFIX + tag, now)));
  },
};
