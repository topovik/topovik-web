import type { Metadata } from "next";
import { mediaUrl } from "@/lib/media";
import { articleHref } from "@/lib/paths";
import type { Article, Page, StrapiMedia } from "@/lib/types";

export const SITE_NAME = "Topovik";
export const SITE_DESCRIPTION =
  "Журнал подборок: кино, технологии, путешествия, юмор и не только.";
export const SITE_TITLE = "Topovik — подборки и топы";

type OgImageInput = {
  url?: string | null;
  media?: StrapiMedia | null;
  alt?: string;
};

type OgImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

/** Absolute URL for OG/Twitter — social scrapers are unreliable with relative paths. */
function absoluteOgUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = siteOrigin();
  return `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SITE_TITLE,
} as const satisfies OgImage;

/** Prefer CMS canonicalPath; fall back to computed path. Always site-relative. */
export function resolveCanonicalPath(
  seoCanonical: string | null | undefined,
  fallback: string,
) {
  const raw = (seoCanonical || fallback || "/").trim();
  if (!raw) return fallback.startsWith("/") ? fallback : `/${fallback}`;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const { pathname, search } = new URL(raw);
      return `${pathname || "/"}${search || ""}`;
    } catch {
      return fallback.startsWith("/") ? fallback : `/${fallback}`;
    }
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function articleCanonicalPath(article: Article) {
  const href = articleHref(article);
  const seoPath = article.seo?.canonicalPath;
  // After slug renames, CMS canonical often still equals legacyPath — prefer the live href.
  if (seoPath && seoPath !== article.legacyPath) {
    return resolveCanonicalPath(seoPath, href);
  }
  return href;
}

export function pageCanonicalPath(page: Page) {
  return resolveCanonicalPath(page.seo?.canonicalPath, `/${page.slug}`);
}

/** Strip HTML / light markdown / entities for meta descriptions. */
export function plainTextExcerpt(html?: string | null, max = 160) {
  if (!html) return undefined;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return undefined;
  if (text.length <= max) return text;

  const sliced = text.slice(0, max - 1);
  const cut = sliced.lastIndexOf(" ");
  return `${(cut > max * 0.5 ? sliced.slice(0, cut) : sliced).trim()}…`;
}

export function articleDescription(article: Article) {
  return (
    article.seo?.metaDescription ||
    plainTextExcerpt(article.content) ||
    (article.category
      ? `${article.title} — подборка в рубрике «${article.category.name}» на ${SITE_NAME}`
      : `${article.title} — подборка на ${SITE_NAME}`)
  );
}

export function ogImages(input?: OgImageInput | null): OgImage[] {
  const url = mediaUrl(input?.media?.url || input?.url);
  if (!url) return [{ ...DEFAULT_OG_IMAGE }];
  return [
    {
      url: absoluteOgUrl(url),
      width: input?.media?.width || undefined,
      height: input?.media?.height || undefined,
      alt: input?.alt || SITE_NAME,
    },
  ];
}

export function pageSocial({
  title,
  description,
  url,
  images,
  type = "website",
}: {
  title: string;
  description?: string;
  url?: string;
  images?: OgImage[];
  type?: "website" | "article";
}): Pick<Metadata, "openGraph" | "twitter"> {
  const ogImagesValue = (images?.length ? images : [{ ...DEFAULT_OG_IMAGE }]).map(
    (img) => ({
      ...img,
      url: absoluteOgUrl(img.url),
    }),
  );
  return {
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "ru_RU",
      type,
      images: ogImagesValue,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImagesValue.map((img) => img.url),
    },
  };
}
