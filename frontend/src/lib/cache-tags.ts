/** Shared Next.js cache tags — keep in sync with CMS revalidate payloads. */

export const CACHE_TAGS = {
  home: "home",
  articles: "articles",
  categories: "categories",
  tags: "tags",
  pages: "pages",
  article: (categorySlug: string, slug: string) => `article:${categorySlug}:${slug}`,
  category: (slug: string) => `category:${slug}`,
  tag: (slug: string) => `tag:${slug}`,
  page: (slug: string) => `page:${slug}`,
  comments: (articleDocumentId: string) => `comments:${articleDocumentId}`,
} as const;
