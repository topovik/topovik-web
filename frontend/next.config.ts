import type { NextConfig } from "next";
import path from "node:path";

const strapiUrl = (
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://127.0.0.1:1337"
).replace(/\/$/, "");

/**
 * Redis for `"use cache"` data only (set REDIS_CACHE=1 at build + runtime).
 * Do NOT put full-page ISR HTML in Redis (`cacheHandler`) — homepage is ~1.7MB
 * and Redis HIT still cost ~15–20s TTFB deserializing it.
 * Args to `"use cache"` must stay primitives (documentId/slug), not full Article.
 */
const useRedisCache = process.env.REDIS_CACHE === "1";

const redisUseCacheHandler = path.join(
  __dirname,
  "cache-handlers/use-cache-redis.js",
);

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  ...(useRedisCache
    ? {
        cacheHandlers: {
          default: redisUseCacheHandler,
          remote: redisUseCacheHandler,
        },
      }
    : {}),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  trailingSlash: false,
  images: {
    // Local Strapi (127.0.0.1:1337) — required for next/image in dev/monorepo.
    dangerouslyAllowLocalIP: true,
    // Keep srcset lean: default Next goes up to 3840w which bloats HTML + LCP picks.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    localPatterns: [
      { pathname: "/uploads/**" },
      { pathname: "/logo.png" },
      { pathname: "/icon-192.png" },
      { pathname: "/icon-512.png" },
    ],
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "1337", pathname: "/uploads/**" },
      { protocol: "http", hostname: "localhost", port: "1337", pathname: "/uploads/**" },
      { protocol: "https", hostname: "topovik.com", pathname: "/**" },
    ],
  },
  // /uploads is handled by app/uploads/[...path]/route.ts (proxy + hash fallback).
  // Keep a fallback rewrite only if the route is unavailable.
  async rewrites() {
    return {
      fallback: [
        {
          source: "/uploads/:path*",
          destination: `${strapiUrl}/uploads/:path*`,
        },
      ],
    };
  },
  async redirects() {
    return [
      { source: "/signin", destination: "/", permanent: true },
      { source: "/registration", destination: "/", permanent: true },
      { source: "/zabyli-parol", destination: "/", permanent: true },
      // New articles: drop SEO-year "2026" from slugs
      {
        source: "/technologies/15-luchshikh-besplatnykh-nejjrosetejj-v-2026-godu",
        destination: "/technologies/15-luchshikh-besplatnykh-nejjrosetejj",
        permanent: true,
      },
      {
        source: "/cinema/20-serialov-kotorye-stoit-posmotret-v-2026-godu",
        destination: "/cinema/20-serialov-kotorye-stoit-posmotret",
        permanent: true,
      },
      {
        source: "/games/15-luchshikh-igr-na-telefon-v-2026-godu",
        destination: "/games/15-luchshikh-igr-na-telefon",
        permanent: true,
      },
      {
        source: "/bussiness/10-idejj-biznesa-na-storone-v-2026-godu",
        destination: "/bussiness/10-idejj-biznesa-na-storone",
        permanent: true,
      },
      {
        source: "/travel/kak-puteshestvovat-deshevo-v-2026-godu-12-rabochikh-sposobov",
        destination: "/travel/kak-puteshestvovat-deshevo-12-rabochikh-sposobov",
        permanent: true,
      },
      {
        source: "/music/15-podkastov-i-plejlistov-kotorye-stoit-vklyuchit-v-2026",
        destination: "/music/15-podkastov-i-plejlistov-kotorye-stoit-vklyuchit",
        permanent: true,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
