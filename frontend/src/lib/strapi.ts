import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { STRAPI_URL } from "@/lib/config";
import { articleHref } from "@/lib/paths";
import type {
  Article,
  Category,
  Comment,
  Page,
  StrapiListResponse,
  Tag,
} from "@/lib/types";

type Query = Record<string, string | number | boolean | undefined>;

function toQuery(params: Query = {}) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    q.set(key, String(value));
  }
  return q.toString();
}

async function strapiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${STRAPI_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    // Docker/CI build often has no CMS on the network; callers inside "use cache"
    // must catch themselves — rethrow a stable Error for .catch() handlers.
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Strapi unreachable ${path}: ${cause}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strapi ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

const articlePopulate = [
  "populate[category][fields][0]=name",
  "populate[category][fields][1]=slug",
  "populate[cover][fields][0]=url",
  "populate[cover][fields][1]=alternativeText",
  "populate[cover][fields][2]=width",
  "populate[cover][fields][3]=height",
  "populate[cover][fields][4]=formats",
  "populate[cover][fields][5]=provider_metadata",
  "populate[tags][fields][0]=name",
  "populate[tags][fields][1]=slug",
  "populate[seo]=true",
].join("&");

export async function getCategories() {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.categories);

  try {
    const data = await strapiFetch<StrapiListResponse<Category>>(
      `/api/categories?pagination[pageSize]=50&sort=order:asc,name:asc`
    );
    return data.data.filter((c) => c.slug && !c.slug.startsWith("category-"));
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.categories, CACHE_TAGS.category(slug));

  try {
    const q = toQuery({
      "filters[slug][$eq]": slug,
      "pagination[pageSize]": 1,
    });
    const data = await strapiFetch<StrapiListResponse<Category>>(`/api/categories?${q}`);
    return data.data[0] || null;
  } catch {
    return null;
  }
}

export async function getTagBySlug(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.tags, CACHE_TAGS.tag(slug));

  try {
    const q = toQuery({
      "filters[slug][$eq]": slug,
      "pagination[pageSize]": 1,
    });
    const data = await strapiFetch<StrapiListResponse<Tag>>(`/api/tags?${q}`);
    return data.data[0] || null;
  } catch {
    return null;
  }
}

export async function getTags() {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.tags);

  try {
    const data = await strapiFetch<StrapiListResponse<Tag>>(
      `/api/tags?pagination[pageSize]=200&sort=name:asc`,
    );
    return data.data.filter((t) => Boolean(t.slug));
  } catch {
    return [];
  }
}

export async function getPages() {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages);

  try {
    const data = await strapiFetch<StrapiListResponse<Page>>(
      `/api/pages?status=published&pagination[pageSize]=50&sort=title:asc&populate[seo]=true`,
    );
    return data.data.filter((p) => Boolean(p.slug));
  } catch {
    return [];
  }
}

/** All published articles for sitemap / feed (paginated). */
export async function getAllArticles(pageSize = 100) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.articles);

  try {
    const articles: Article[] = [];
    let page = 1;
    let pageCount = 1;

    while (page <= pageCount) {
      const data = await strapiFetch<StrapiListResponse<Article>>(
        `/api/articles?${[
          "status=published",
          `pagination[page]=${page}`,
          `pagination[pageSize]=${pageSize}`,
          "sort=publishedAt:desc",
          articlePopulate,
        ].join("&")}`,
      );
      articles.push(...data.data);
      pageCount = data.meta.pagination.pageCount || 1;
      page += 1;
      if (page > 200) break;
    }

    return articles;
  } catch {
    return [];
  }
}

export async function getArticles(
  opts: {
    page?: number;
    pageSize?: number;
    categorySlug?: string;
    tagSlug?: string;
    search?: string;
  } = {}
) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.articles, CACHE_TAGS.home);
  if (opts.categorySlug) cacheTag(CACHE_TAGS.category(opts.categorySlug));
  if (opts.tagSlug) cacheTag(CACHE_TAGS.tag(opts.tagSlug));

  const page = opts.page || 1;
  const pageSize = opts.pageSize || 12;
  const params = [
    `status=published`,
    `pagination[page]=${page}`,
    `pagination[pageSize]=${pageSize}`,
    `sort=publishedAt:desc`,
    articlePopulate,
  ];

  if (opts.categorySlug) {
    params.push(`filters[category][slug][$eq]=${encodeURIComponent(opts.categorySlug)}`);
  }
  if (opts.tagSlug) {
    params.push(`filters[tags][slug][$eq]=${encodeURIComponent(opts.tagSlug)}`);
  }
  if (opts.search) {
    params.push(`filters[title][$containsi]=${encodeURIComponent(opts.search)}`);
  }

  try {
    return await strapiFetch<StrapiListResponse<Article>>(
      `/api/articles?${params.join("&")}`,
    );
  } catch {
    return {
      data: [],
      meta: { pagination: { page, pageSize, pageCount: 0, total: 0 } },
    };
  }
}

/** Live typeahead search — no "use cache", no article body (keeps JSON small). */
export async function searchArticles(query: string, pageSize = 8) {
  const q = query.trim();
  if (!q) {
    return {
      data: [] as Article[],
      meta: { pagination: { page: 1, pageSize, pageCount: 0, total: 0 } },
    };
  }

  const params = [
    `status=published`,
    `pagination[page]=1`,
    `pagination[pageSize]=${pageSize}`,
    `sort=publishedAt:desc`,
    `filters[title][$containsi]=${encodeURIComponent(q)}`,
    `fields[0]=title`,
    `fields[1]=slug`,
    `fields[2]=documentId`,
    `fields[3]=publishedAt`,
    `populate[category][fields][0]=name`,
    `populate[category][fields][1]=slug`,
    `populate[cover][fields][0]=url`,
    `populate[cover][fields][1]=alternativeText`,
    `populate[cover][fields][2]=width`,
    `populate[cover][fields][3]=height`,
    `populate[cover][fields][4]=formats`,
    `populate[cover][fields][5]=provider_metadata`,
  ];

  return strapiFetch<StrapiListResponse<Article>>(
    `/api/articles?${params.join("&")}`,
  );
}

export async function getArticleByPath(categorySlug: string, slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag(
    CACHE_TAGS.articles,
    CACHE_TAGS.article(categorySlug, slug),
    CACHE_TAGS.category(categorySlug)
  );

  try {
    const params = [
      `status=published`,
      `filters[slug][$eq]=${encodeURIComponent(slug)}`,
      `filters[category][slug][$eq]=${encodeURIComponent(categorySlug)}`,
      `pagination[pageSize]=1`,
      articlePopulate,
    ];
    const data = await strapiFetch<StrapiListResponse<Article>>(
      `/api/articles?${params.join("&")}`,
    );
    return data.data[0] || null;
  } catch {
    return null;
  }
}

export async function getArticleByLegacyPath(legacyPath: string) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.articles);

  try {
    const params = [
      `status=published`,
      `filters[legacyPath][$eq]=${encodeURIComponent(legacyPath)}`,
      `pagination[pageSize]=1`,
      articlePopulate,
    ];
    const data = await strapiFetch<StrapiListResponse<Article>>(
      `/api/articles?${params.join("&")}`,
    );
    return data.data[0] || null;
  } catch {
    return null;
  }
}

/** Resolve by current slug, or by WP legacy path (for redirects). */
export async function resolveArticleFromParams(categorySlug: string, slug: string) {
  const direct = await getArticleByPath(categorySlug, slug);
  if (direct) return { article: direct, redirectTo: null as string | null };

  const legacy = await getArticleByLegacyPath(`/${categorySlug}/${slug}`);
  if (!legacy) return null;

  const canonical = articleHref(legacy);
  const current = `/${categorySlug}/${slug}`;
  return {
    article: legacy,
    redirectTo: canonical !== current ? canonical : null,
  };
}

export async function getFeaturedArticles(limit = 6) {
  const data = await getArticles({ pageSize: limit });
  return data.data;
}

/** Site-wide top articles by view count (matches old WP popular sidebar). */
export async function getPopularArticles(limit = 5) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.articles, CACHE_TAGS.home);

  try {
    const data = await strapiFetch<StrapiListResponse<Article>>(
      `/api/articles?${[
        "status=published",
        `pagination[pageSize]=${limit}`,
        "sort=views:desc",
        articlePopulate,
      ].join("&")}`,
    );
    return data.data;
  } catch {
    return [];
  }
}

/** Older / newer neighbours by publish date — prefer same category. */
export async function getAdjacentArticles(article: Article) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.articles);
  if (article.category?.slug) cacheTag(CACHE_TAGS.category(article.category.slug));

  const publishedAt = article.publishedAt;
  if (!publishedAt) return { prev: null, next: null };

  const categoryFilter = article.category?.slug
    ? `filters[category][slug][$eq]=${encodeURIComponent(article.category.slug)}`
    : null;

  const base = [`status=published`, `pagination[pageSize]=1`, articlePopulate];
  if (categoryFilter) base.push(categoryFilter);

  try {
    const [older, newer] = await Promise.all([
      strapiFetch<StrapiListResponse<Article>>(
        `/api/articles?${[
          ...base,
          `filters[publishedAt][$lt]=${encodeURIComponent(publishedAt)}`,
          `filters[documentId][$ne]=${encodeURIComponent(article.documentId)}`,
          `sort=publishedAt:desc`,
        ].join("&")}`,
      ),
      strapiFetch<StrapiListResponse<Article>>(
        `/api/articles?${[
          ...base,
          `filters[publishedAt][$gt]=${encodeURIComponent(publishedAt)}`,
          `filters[documentId][$ne]=${encodeURIComponent(article.documentId)}`,
          `sort=publishedAt:asc`,
        ].join("&")}`,
      ),
    ]);

    return {
      prev: older.data[0] || null,
      next: newer.data[0] || null,
    };
  } catch {
    return { prev: null, next: null };
  }
}

/**
 * Recommendations mix:
 * 1) same tags (shared interests)
 * 2) same category, recent
 * 3) site-wide popular by views as fill
 * Current article is always excluded.
 */
export async function getRecommendedArticles(article: Article, limit = 16) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.articles);
  if (article.category?.slug) cacheTag(CACHE_TAGS.category(article.category.slug));
  for (const tag of article.tags || []) cacheTag(CACHE_TAGS.tag(tag.slug));

  const exclude = article.documentId;
  const tagSlugs = (article.tags || []).map((t) => t.slug).filter(Boolean);
  const fetchSize = Math.max(limit * 2, 12);
  const emptyList: StrapiListResponse<Article> = {
    data: [],
    meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } },
  };

  const byTagsPromise = tagSlugs.length
    ? (() => {
        const tagParams = [
          `status=published`,
          `pagination[pageSize]=${fetchSize}`,
          `sort=publishedAt:desc`,
          `filters[documentId][$ne]=${encodeURIComponent(exclude)}`,
          articlePopulate,
        ];
        tagSlugs.slice(0, 4).forEach((slug, i) => {
          tagParams.push(
            `filters[$or][${i}][tags][slug][$eq]=${encodeURIComponent(slug)}`
          );
        });
        return strapiFetch<StrapiListResponse<Article>>(
          `/api/articles?${tagParams.join("&")}`
        );
      })()
    : Promise.resolve(emptyList);

  const byCategoryPromise = article.category?.slug
    ? getArticles({
        pageSize: fetchSize,
        categorySlug: article.category.slug,
      })
    : Promise.resolve(emptyList);

  const byViewsPromise = strapiFetch<StrapiListResponse<Article>>(
    `/api/articles?${[
      `status=published`,
      `pagination[pageSize]=${fetchSize}`,
      `sort=views:desc`,
      `filters[documentId][$ne]=${encodeURIComponent(exclude)}`,
      articlePopulate,
    ].join("&")}`
  );

  const [byTags, byCategory, byViews] = await Promise.all([
    byTagsPromise.catch(() => emptyList),
    byCategoryPromise.catch(() => emptyList),
    byViewsPromise.catch(() => emptyList),
  ]);
  const seen = new Set<string>([exclude]);
  const picked: Article[] = [];

  const scoreOf = (item: Article) => {
    const tagOverlap = (item.tags || []).filter((t) =>
      tagSlugs.includes(t.slug)
    ).length;
    const sameCategory =
      item.category?.slug && item.category.slug === article.category?.slug
        ? 1
        : 0;
    return (
      tagOverlap * 10 +
      sameCategory * 5 +
      Math.min(item.views || 0, 10_000) / 2000
    );
  };

  const take = (list: Article[]) => {
    const ranked = [...list].sort((a, b) => scoreOf(b) - scoreOf(a));
    for (const item of ranked) {
      if (picked.length >= limit) break;
      if (seen.has(item.documentId)) continue;
      seen.add(item.documentId);
      picked.push(item);
    }
  };

  // Priority order: shared tags → same category → popular elsewhere
  take(byTags.data);
  take(byCategory.data);
  take(byViews.data);

  return picked.slice(0, limit);
}

export async function getPageBySlug(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages, CACHE_TAGS.page(slug));

  try {
    const params = [
      `status=published`,
      `filters[slug][$eq]=${encodeURIComponent(slug)}`,
      `pagination[pageSize]=1`,
      `populate[seo]=true`,
    ];
    const data = await strapiFetch<StrapiListResponse<Page>>(
      `/api/pages?${params.join("&")}`,
    );
    return data.data[0] || null;
  } catch {
    return null;
  }
}

export async function getApprovedComments(articleDocumentId: string) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.comments(articleDocumentId));

  try {
    const params = [
      `filters[article][documentId][$eq]=${encodeURIComponent(articleDocumentId)}`,
      `filters[approved][$eq]=true`,
      `sort=createdAt:asc`,
      `pagination[pageSize]=100`,
    ];
    const data = await strapiFetch<StrapiListResponse<Comment>>(
      `/api/comments?${params.join("&")}`,
    );
    return data.data;
  } catch {
    return [];
  }
}

export { articleHref, STRAPI_URL };
