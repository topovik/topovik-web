type RevalidatePayload = {
  tags?: string[];
  paths?: string[];
  /** `/uploads/...` paths to pre-warm via next/image */
  images?: string[];
};

type MediaLike = {
  url?: string;
  formats?: { medium?: { url?: string } | null } | null;
};

type EntryLike = {
  documentId?: string;
  slug?: string;
  legacyPath?: string | null;
  approved?: boolean;
  cover?: MediaLike | null;
  category?: { slug?: string } | string | number | null;
  tags?: Array<{ slug?: string } | string | number> | null;
  article?:
    | {
        documentId?: string;
        slug?: string;
        legacyPath?: string | null;
        category?: { slug?: string } | string | number | null;
      }
    | string
    | number
    | null;
};

function mediaPaths(cover?: MediaLike | null): string[] {
  if (!cover) return [];
  const out: string[] = [];
  for (const url of [cover.formats?.medium?.url, cover.url]) {
    if (!url) continue;
    if (url.startsWith('/uploads/')) out.push(url);
    else {
      try {
        const u = new URL(url);
        if (u.pathname.startsWith('/uploads/')) out.push(u.pathname);
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

const DRAFT_PUBLISH_UIDS = new Set([
  'api::article.article',
  'api::page.page',
]);

const ALWAYS_WRITE_UIDS = new Set([
  'api::category.category',
  'api::tag.tag',
  'api::comment.comment',
]);

function categorySlug(value: EntryLike['category']): string | undefined {
  if (!value || typeof value === 'string' || typeof value === 'number') return undefined;
  return value.slug || undefined;
}

function articlePath(entry: EntryLike): string | undefined {
  if (entry.legacyPath) return entry.legacyPath;
  const cat = categorySlug(entry.category) || 'other';
  if (!entry.slug) return undefined;
  return `/${cat}/${entry.slug}`;
}

function unique(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

export function shouldRevalidate(uid: string, action: string) {
  if (DRAFT_PUBLISH_UIDS.has(uid)) {
    return ['publish', 'unpublish', 'delete'].includes(action);
  }
  if (ALWAYS_WRITE_UIDS.has(uid)) {
    return ['create', 'update', 'delete'].includes(action);
  }
  return false;
}

export function buildRevalidatePayload(uid: string, entry: EntryLike | null | undefined): RevalidatePayload {
  if (!entry) {
    if (uid === 'api::article.article') {
      return { tags: ['articles', 'home'], paths: ['/', '/page/[page]'] };
    }
    if (uid === 'api::category.category') return { tags: ['categories'], paths: ['/'] };
    if (uid === 'api::tag.tag') return { tags: ['tags'] };
    if (uid === 'api::page.page') return { tags: ['pages'] };
    if (uid === 'api::comment.comment') return { tags: ['articles'] };
    return {};
  }

  if (uid === 'api::article.article') {
    const cat = categorySlug(entry.category) || 'other';
    const tagSlugs = (entry.tags || [])
      .map((t) => (t && typeof t === 'object' ? t.slug : undefined))
      .filter((s): s is string => Boolean(s));

    return {
      tags: unique([
        'articles',
        'home',
        entry.slug ? `article:${cat}:${entry.slug}` : undefined,
        `category:${cat}`,
        ...tagSlugs.map((s) => `tag:${s}`),
      ]),
      // `/page/[page]` and category paging share article listings — bust route cache too.
      paths: unique([
        '/',
        articlePath(entry),
        `/category/${cat}`,
        '/page/[page]',
        `/category/${cat}/page/[page]`,
        ...tagSlugs.map((s) => `/tag/${s}`),
      ]),
      images: unique(mediaPaths(entry.cover)),
    };
  }

  if (uid === 'api::category.category') {
    return {
      tags: unique(['categories', entry.slug ? `category:${entry.slug}` : undefined, 'articles', 'home']),
      paths: unique(['/', entry.slug ? `/category/${entry.slug}` : undefined]),
    };
  }

  if (uid === 'api::tag.tag') {
    return {
      tags: unique(['tags', entry.slug ? `tag:${entry.slug}` : undefined, 'articles']),
      paths: unique([entry.slug ? `/tag/${entry.slug}` : undefined]),
    };
  }

  if (uid === 'api::page.page') {
    return {
      tags: unique(['pages', entry.slug ? `page:${entry.slug}` : undefined]),
      paths: unique([entry.slug ? `/${entry.slug}` : undefined]),
    };
  }

  if (uid === 'api::comment.comment') {
    const article =
      entry.article && typeof entry.article === 'object' ? entry.article : null;
    const articleId =
      article?.documentId ||
      (typeof entry.article === 'string' ? entry.article : undefined);
    const cat = categorySlug(article?.category) || 'other';
    const path = article
      ? article.legacyPath || (article.slug ? `/${cat}/${article.slug}` : undefined)
      : undefined;

    return {
      tags: unique([
        articleId ? `comments:${articleId}` : undefined,
        article?.slug ? `article:${cat}:${article.slug}` : undefined,
      ]),
      paths: unique([path]),
    };
  }

  return {};
}

export async function notifyFrontendRevalidate(
  strapi: { log: { warn: (msg: string) => void; info: (msg: string) => void; error: (msg: string, err?: unknown) => void } },
  payload: RevalidatePayload
) {
  const tags = payload.tags || [];
  const paths = payload.paths || [];
  const images = payload.images || [];
  if (!tags.length && !paths.length && !images.length) return;

  const frontendUrl = (process.env.FRONTEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    strapi.log.warn('REVALIDATE_SECRET is not set; skip frontend revalidation');
    return;
  }

  try {
    const res = await fetch(`${frontendUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tags, paths, images }),
    });

    if (!res.ok) {
      const text = await res.text();
      strapi.log.error(`Frontend revalidate failed: ${res.status} ${text.slice(0, 200)}`);
      return;
    }

    strapi.log.info(`Frontend revalidated tags=[${tags.join(',')}] paths=[${paths.join(',')}]`);
  } catch (err) {
    strapi.log.error('Frontend revalidate request failed', err);
  }
}
