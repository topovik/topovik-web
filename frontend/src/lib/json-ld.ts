import { coverUrl } from "@/lib/media";
import { articleHref } from "@/lib/paths";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  articleCanonicalPath,
  articleDescription,
  pageCanonicalPath,
  plainTextExcerpt,
} from "@/lib/seo";
import { SOCIAL_LINKS } from "@/lib/social";
import type { Article, Category, Page, Tag } from "@/lib/types";

export type JsonLd = Record<string, unknown>;

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = siteOrigin();
  if (!path || path === "/") return `${origin}/`;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function orgId() {
  return absoluteUrl("/#organization");
}

function websiteId() {
  return absoluteUrl("/#website");
}

export function organizationJsonLd(): JsonLd {
  return {
    "@type": "Organization",
    "@id": orgId(),
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo.png"),
    },
    description: SITE_DESCRIPTION,
    sameAs: SOCIAL_LINKS.map((item) => item.href),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": websiteId(),
    name: SITE_NAME,
    alternateName: SITE_TITLE,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "ru-RU",
    publisher: { "@id": orgId() },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function articleJsonLd(article: Article): JsonLd {
  const path = articleCanonicalPath(article);
  const url = absoluteUrl(path);
  const description = articleDescription(article);
  const image = coverUrl(article.cover, "original");
  const published = article.publishedAt || article.createdAt || undefined;
  // Never emit dateModified earlier than datePublished (migration quirks).
  const modifiedRaw = article.updatedAt || published;
  const modified =
    published && modifiedRaw && modifiedRaw < published
      ? published
      : modifiedRaw;

  const data: JsonLd = {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.seo?.metaTitle || article.title,
    name: article.title,
    description,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    inLanguage: "ru-RU",
    isPartOf: { "@id": websiteId() },
    publisher: { "@id": orgId() },
    author: { "@id": orgId() },
  };

  if (published) data.datePublished = published;
  if (modified) data.dateModified = modified;
  if (image) {
    data.image = [absoluteUrl(image)];
  }
  if (article.category) {
    data.articleSection = article.category.name;
  }
  if (article.tags?.length) {
    data.keywords = article.tags.map((tag) => tag.name).join(", ");
  }
  if (article.readingMinutes) {
    data.timeRequired = `PT${Math.max(1, Math.round(article.readingMinutes))}M`;
  }

  return data;
}

export function collectionPageJsonLd({
  name,
  description,
  path,
  articles,
}: {
  name: string;
  description?: string;
  path: string;
  articles?: Article[];
}): JsonLd {
  const url = absoluteUrl(path);
  const data: JsonLd = {
    "@type": "CollectionPage",
    "@id": url,
    name,
    url,
    isPartOf: { "@id": websiteId() },
    inLanguage: "ru-RU",
  };

  if (description) data.description = description;

  if (articles?.length) {
    data.mainEntity = {
      "@type": "ItemList",
      numberOfItems: articles.length,
      itemListElement: articles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(articleHref(article)),
        name: article.title,
      })),
    };
  }

  return data;
}

export function webPageJsonLd({
  page,
  type = "WebPage",
}: {
  page: Page;
  type?: "WebPage" | "AboutPage" | "ContactPage";
}): JsonLd {
  const path = pageCanonicalPath(page);
  const url = absoluteUrl(path);
  const description = page.seo?.metaDescription || undefined;

  const data: JsonLd = {
    "@type": type,
    "@id": url,
    name: page.seo?.metaTitle || page.title,
    url,
    isPartOf: { "@id": websiteId() },
    inLanguage: "ru-RU",
    publisher: { "@id": orgId() },
  };

  if (description) data.description = description;
  return data;
}

export function categoryCollectionJsonLd(
  category: Category,
  articles?: Article[],
  opts?: { page?: number; pageCount?: number },
) {
  const page = opts?.page && opts.page > 1 ? opts.page : 1;
  const path =
    page > 1
      ? `/category/${category.slug}/page/${page}`
      : `/category/${category.slug}`;
  const baseDescription =
    plainTextExcerpt(category.description) ||
    `Подборки в рубрике «${category.name}»`;
  const name =
    page > 1 ? `${category.name} — страница ${page}` : category.name;
  const description =
    page > 1
      ? `${baseDescription} — страница ${page}${
          opts?.pageCount ? ` из ${opts.pageCount}` : ""
        }`
      : baseDescription;

  return collectionPageJsonLd({
    name,
    description,
    path,
    articles,
  });
}

export function tagCollectionJsonLd(tag: Tag, articles?: Article[]) {
  return collectionPageJsonLd({
    name: `#${tag.name}`,
    description: `Материалы с тегом «${tag.name}» на ${SITE_NAME}`,
    path: `/tag/${tag.slug}`,
    articles,
  });
}

export function homeJsonLd(articles?: Article[]) {
  return collectionPageJsonLd({
    name: SITE_TITLE,
    description: SITE_DESCRIPTION,
    path: "/",
    articles,
  });
}

/** Combine entities into a single @graph document. */
export function jsonLdGraph(...nodes: JsonLd[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}
