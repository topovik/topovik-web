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

/**
 * Cover helper.
 * - `original` / `large`: feed & article cards (medium is ~750px and looks soft when upscaled)
 * - `medium`: tiny thumbs only (search, partner strip)
 */
export function coverUrl(
  cover?: StrapiMedia | null,
  prefer: "medium" | "large" | "original" = "original",
) {
  if (!cover?.url) return null;
  if (prefer === "medium" && cover.formats?.medium?.url) {
    return mediaUrl(cover.formats.medium.url);
  }
  if (prefer === "large" && cover.formats?.large?.url) {
    return mediaUrl(cover.formats.large.url);
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

/** Original publish date (WordPress post_date → Strapi publishedAt). */
export function articlePublishedAt(article: {
  publishedAt?: string | null;
  createdAt?: string | null;
}) {
  return article.publishedAt || article.createdAt || null;
}

/**
 * Stable "updated" timestamp a bit after publish.
 * Avoids the mass-rewrite day where every article shares the same updatedAt.
 * Offset is deterministic from id (1–14 days + up to 19h).
 */
export function articleSyntheticUpdatedAt(article: {
  id?: number;
  publishedAt?: string | null;
  createdAt?: string | null;
}) {
  const published = articlePublishedAt(article);
  if (!published) return null;
  const publishedMs = Date.parse(published);
  if (!Number.isFinite(publishedMs)) return null;

  const id = Math.abs(Number(article.id) || 0);
  const dayOffset = 1 + (id % 14);
  const hourOffset = id % 20;
  return new Date(
    publishedMs + dayOffset * 86_400_000 + hourOffset * 3_600_000,
  ).toISOString();
}

/**
 * Mass Strapi saves landed in early Nov 2026 — treat those updatedAt as noise.
 * Outside that window, keep a real editorial updatedAt when it is after publish.
 */
function isBulkUpdatedAt(updatedMs: number) {
  const bulkStart = Date.parse("2026-11-01T00:00:00.000Z");
  const bulkEnd = Date.parse("2026-11-10T00:00:00.000Z");
  return updatedMs >= bulkStart && updatedMs < bulkEnd;
}

/** Byline date: original publish date. */
export function articleDate(article: {
  publishedAt?: string | null;
  createdAt?: string | null;
}) {
  return articlePublishedAt(article);
}

/** dateModified / og:modified_time / sitemap lastmod. */
export function articleModifiedAt(article: {
  id?: number;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}) {
  const published = articlePublishedAt(article);
  const updated = article.updatedAt;
  const publishedMs = published ? Date.parse(published) : NaN;
  const updatedMs = updated ? Date.parse(updated) : NaN;

  if (
    Number.isFinite(updatedMs) &&
    Number.isFinite(publishedMs) &&
    updatedMs > publishedMs &&
    !isBulkUpdatedAt(updatedMs)
  ) {
    return updated;
  }

  return articleSyntheticUpdatedAt(article) || published;
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
