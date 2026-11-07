import type { Article } from "@/lib/types";

/** Current canonical URL from category + slug (not the WP legacy path). */
export function articleHref(article: Pick<Article, "slug" | "category">) {
  const cat = article.category?.slug || "other";
  return `/${cat}/${article.slug}`;
}

export function categoryHref(slug: string, page = 1) {
  if (page <= 1) return `/category/${slug}`;
  return `/category/${slug}/page/${page}`;
}
