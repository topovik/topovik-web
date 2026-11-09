import type { MetadataRoute } from "next";
import { CATEGORY_PAGE_SIZE } from "@/lib/categories";
import { absoluteUrl } from "@/lib/json-ld";
import { articleModifiedAt } from "@/lib/media";
import { categoryHref } from "@/lib/paths";
import { articleCanonicalPath, pageCanonicalPath } from "@/lib/seo";
import {
  getAllArticles,
  getCategories,
  getPages,
  getTags,
} from "@/lib/strapi";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories, tags, pages] = await Promise.all([
    getAllArticles().catch(() => []),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getPages().catch(() => []),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: absoluteUrl("/about"),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: absoluteUrl("/ads"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/feed.xml"),
      changeFrequency: "hourly",
      priority: 0.2,
    },
  ];

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: absoluteUrl(articleCanonicalPath(article)),
    lastModified: articleModifiedAt(article) || undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const countsByCategory = new Map<string, number>();
  for (const article of articles) {
    const slug = article.category?.slug;
    if (!slug) continue;
    countsByCategory.set(slug, (countsByCategory.get(slug) || 0) + 1);
  }

  const categoryEntries: MetadataRoute.Sitemap = categories.flatMap(
    (category) => {
      const total = countsByCategory.get(category.slug) || 0;
      const pageCount = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
      const entries: MetadataRoute.Sitemap = [
        {
          url: absoluteUrl(categoryHref(category.slug)),
          changeFrequency: "daily",
          priority: 0.6,
        },
      ];

      for (let page = 2; page <= pageCount; page++) {
        entries.push({
          url: absoluteUrl(categoryHref(category.slug, page)),
          changeFrequency: "daily",
          priority: 0.5,
        });
      }

      return entries;
    },
  );

  const tagEntries: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: absoluteUrl(`/tag/${tag.slug}`),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const pageEntries: MetadataRoute.Sitemap = pages
    .filter((page) => !["about", "ads"].includes(page.slug))
    .map((page) => ({
      url: absoluteUrl(pageCanonicalPath(page)),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    }));

  return [
    ...staticRoutes,
    ...pageEntries,
    ...categoryEntries,
    ...tagEntries,
    ...articleEntries,
  ];
}
