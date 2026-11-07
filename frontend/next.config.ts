import type { NextConfig } from "next";

const strapiUrl = (
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://127.0.0.1:1337"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
