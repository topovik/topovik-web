import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/json-ld";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/search", "/api/"],
      },
    ],
    // No `host` — Googlebot ignores Host: (Yandex-only); GSC flags it as a warning.
    sitemap: `${origin}/sitemap.xml`,
  };
}
