/**
 * Singular `cacheHandler` — ISR / route handlers / optimized images.
 * Based on https://github.com/vercel/next.js/tree/canary/examples/cache-handler-redis
 */
const { createClient } = require("redis");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");

const CACHE_PREFIX = "nextjs:cache:";
const TAG_PREFIX = "nextjs:tag:";
const NEXT_CACHE_TAGS_HEADER = "x-next-cache-tags";

function serialize(entry) {
  return JSON.stringify(entry, (_key, value) => {
    if (value instanceof Map) {
      return { __type: "Map", value: Array.from(value.entries()) };
    }
    return value;
  });
}

function deserialize(text) {
  return JSON.parse(text, (_key, value) => {
    if (value && value.__type === "Map") {
      return new Map(value.value);
    }
    if (value && value.type === "Buffer" && Array.isArray(value.data)) {
      return Buffer.from(value.data);
    }
    return value;
  });
}

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  disableOfflineQueue: true,
});

client.on("error", (error) => {
  if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
    console.warn("Redis client error:", error);
  }
});

const connection =
  process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
    ? Promise.resolve()
    : client.connect().catch((error) => {
        console.warn("Failed to connect to Redis:", error);
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

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    const redis = await getClient();
    if (!redis) return null;

    let entry;
    try {
      entry = await redis.get(CACHE_PREFIX + key);
    } catch (error) {
      if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
        console.warn("Redis get failed:", error);
      }
      return null;
    }

    return entry ? deserialize(entry) : null;
  }

  async set(key, data, ctx) {
    const redis = await getClient();
    if (!redis || !data) return;

    const headerTags = (data.headers?.[NEXT_CACHE_TAGS_HEADER] ?? "")
      .split(",")
      .filter(Boolean);
    const tags = [...new Set([...(ctx?.tags ?? []), ...headerTags])];

    const expire = ctx?.cacheControl?.expire;
    const options = Number.isFinite(expire)
      ? { expiration: { type: "EX", value: Math.max(1, Math.ceil(expire)) } }
      : {};

    const value = serialize({ value: data, lastModified: Date.now(), tags });

    try {
      await redis.set(CACHE_PREFIX + key, value, options);
      await Promise.all(tags.map((tag) => redis.sAdd(TAG_PREFIX + tag, key)));
    } catch (error) {
      if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
        console.warn("Redis set failed:", error);
      }
    }
  }

  async revalidateTag(tags) {
    const redis = await getClient();
    if (!redis) {
      throw new Error(
        "Redis is unavailable, so the tag revalidation was not recorded",
      );
    }

    for (const tag of [tags].flat()) {
      const tagKey = TAG_PREFIX + tag;
      const keys = await redis.sMembers(tagKey);

      if (keys.length) {
        await redis.del(keys.map((key) => CACHE_PREFIX + key));
      }

      await redis.del(tagKey);
    }
  }

  resetRequestCache() {}
};
