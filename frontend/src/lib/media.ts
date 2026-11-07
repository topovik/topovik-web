import { STRAPI_URL } from "@/lib/config";
import type { StrapiMedia } from "@/lib/types";

/** Resolve media URL for browser: keep site-relative /uploads proxied via Next rewrites. */
export function mediaUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // Point absolute Strapi localhost URLs to same-origin proxy when possible
    try {
      const u = new URL(url);
      if (u.pathname.startsWith("/uploads/")) return u.pathname;
    } catch {
      /* keep */
    }
    return url;
  }
  if (url.startsWith("/uploads/")) return url;
  if (url.startsWith("/")) return `${STRAPI_URL}${url}`;
  return `${STRAPI_URL}/uploads/${url.replace(/^\//, "")}`;
}

/** Cover helper: lists use medium when present; article pages keep original. */
export function coverUrl(
  cover?: StrapiMedia | null,
  prefer: "medium" | "original" = "original",
) {
  if (!cover?.url) return null;
  if (prefer === "medium" && cover.formats?.medium?.url) {
    return mediaUrl(cover.formats.medium.url);
  }
  return mediaUrl(cover.url);
}

/** Blur-up data URL generated once in Strapi (provider_metadata.placeholder). */
export function coverBlur(cover?: StrapiMedia | null) {
  const value = cover?.provider_metadata?.placeholder;
  return typeof value === "string" && value.startsWith("data:image/")
    ? value
    : null;
}

export function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Date of content freshness: last update, else creation. */
export function articleDate(article: {
  updatedAt?: string | null;
  createdAt?: string | null;
}) {
  return article.updatedAt || article.createdAt || null;
}

export function formatCount(n?: number | null) {
  const value = Number(n || 0);
  return new Intl.NumberFormat("ru-RU").format(value);
}

/** Format stored CMS reading time for UI. */
export function formatReadingMinutes(minutes?: number | null) {
  const n = Math.max(1, Number(minutes) || 1);
  const mod10 = n % 10;
  const mod100 = n % 100;
  const unit =
    mod10 === 1 && mod100 !== 11
      ? "минута"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "минуты"
        : "минут";
  return `${n} ${unit}`;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}
