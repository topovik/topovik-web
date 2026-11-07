import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { htmlToMarkdown } from './html-to-markdown.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(__dirname, '../out');

const STRAPI_URL = (process.env.STRAPI_URL || 'http://127.0.0.1:1337').replace(/\/$/, '');
const API_TOKEN =
  process.env.STRAPI_TOKEN ||
  fs.readFileSync(path.join(__dirname, '../.api-token'), 'utf8').trim();

const MYSQL = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'wordpress',
};

const SKIP_AUTH_SLUGS = new Set([
  'signin',
  'registration',
  'zabyli-parol',
  'password-reset',
  'wp-login',
]);

const MEDIA_PUBLIC_PREFIX = process.env.MEDIA_PUBLIC_PREFIX || '/uploads';

fs.mkdirSync(OUT_DIR, { recursive: true });

function estimateReadingMinutes(content) {
  const raw = String(content || '');
  const images = (raw.match(/!\[[^\]]*]\([^)]*\)/g) || []).length;
  const text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text ? text.split(' ').filter(Boolean).length : 0;
  return Math.max(1, Math.round(words / 180 + images / 6) || 1);
}

async function strapi(method, route, body) {
  const res = await fetch(`${STRAPI_URL}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${route} -> ${res.status} non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${route} -> ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

async function findByLegacy(uidPlural, legacyWpId) {
  const q = new URLSearchParams({
    'filters[legacyWpId][$eq]': String(legacyWpId),
    'pagination[pageSize]': '1',
  });
  const json = await strapi('GET', `/api/${uidPlural}?${q}`);
  return json.data?.[0] || null;
}

function rewriteContent(html) {
  // Strapi richtext expects Markdown; WP content arrives as HTML.
  return htmlToMarkdown(html);
}

const CYR_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function transliterate(input) {
  return String(input)
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase();
      const mapped = CYR_MAP[lower];
      if (mapped == null) return ch;
      return ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .join('');
}

function cleanSlug(slug, fallback = 'item') {
  let value = String(slug || '').trim();

  // Preserve exact WP latin slugs for SEO (do not normalize further)
  if (/^[A-Za-z0-9-_.~]+$/.test(value)) {
    return value;
  }

  try {
    // WordPress sometimes stores percent-encoded UTF-8 in term slugs
    if (/%[0-9a-f]{2}/i.test(value)) {
      value = decodeURIComponent(value);
    }
  } catch {
    // keep raw
  }

  // Only rewrite when slug is not already a valid Strapi uid (Cyrillic / encoded)
  value = transliterate(value)
    .toLowerCase()
    .replace(/%20/g, '')
    .replace(/[^a-z0-9-_.~]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return value || fallback;
}

function metaMap(rows) {
  const map = {};
  for (const row of rows) {
    map[row.meta_key] = row.meta_value;
  }
  return map;
}

async function main() {
  console.log('Connecting MySQL...', MYSQL.host, MYSQL.port);
  const conn = await mysql.createConnection({ ...MYSQL, multipleStatements: false });

  const authorsPath = path.join(OUT_DIR, 'authors.json');
  const authors = fs.existsSync(authorsPath)
    ? JSON.parse(fs.readFileSync(authorsPath, 'utf8'))
    : {};

  const report = {
    categories: 0,
    tags: 0,
    articles: 0,
    drafts: 0,
    pages: 0,
    comments: 0,
    skippedPages: [],
    errors: [],
    redirects: [],
  };

  // --- Categories ---
  const [categories] = await conn.query(`
    SELECT t.term_id, t.name, t.slug, tt.description, tt.count
    FROM wp_terms t
    JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'category'
    ORDER BY t.name
  `);

  const categoryIdByWp = new Map();
  for (const cat of categories) {
    try {
      let existing = await findByLegacy('categories', cat.term_id);
      const payload = {
        data: {
          name: cat.name,
          slug: cleanSlug(cat.slug, `category-${cat.term_id}`),
          description: cat.description || '',
          order: 0,
          legacyWpId: cat.term_id,
        },
      };
      if (existing) {
        await strapi('PUT', `/api/categories/${existing.documentId}`, payload);
      } else {
        existing = (await strapi('POST', '/api/categories', payload)).data;
      }
      categoryIdByWp.set(cat.term_id, existing);
      report.categories += 1;
      report.redirects.push({
        from: `/category/${cleanSlug(cat.slug)}`,
        to: `/category/${cleanSlug(cat.slug)}`,
        type: 'category',
      });
      report.redirects.push({
        from: `/category/${cleanSlug(cat.slug)}/`,
        to: `/category/${cleanSlug(cat.slug)}`,
        type: 'category',
      });
    } catch (err) {
      report.errors.push(`category ${cat.slug}: ${err.message}`);
    }
  }
  console.log(`Categories: ${report.categories}`);

  // --- Tags ---
  const [tags] = await conn.query(`
    SELECT t.term_id, t.name, t.slug
    FROM wp_terms t
    JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'post_tag' AND tt.count > 0
    ORDER BY t.name
  `);

  const tagIdByWp = new Map();
  for (const tag of tags) {
    try {
      let existing = await findByLegacy('tags', tag.term_id);
      const payload = {
        data: {
          name: tag.name,
          slug: cleanSlug(tag.slug, `tag-${tag.term_id}`),
          legacyWpId: tag.term_id,
        },
      };
      if (existing) {
        await strapi('PUT', `/api/tags/${existing.documentId}`, payload);
      } else {
        existing = (await strapi('POST', '/api/tags', payload)).data;
      }
      tagIdByWp.set(tag.term_id, existing);
      report.tags += 1;
      report.redirects.push({
        from: `/tag/${cleanSlug(tag.slug)}`,
        to: `/tag/${cleanSlug(tag.slug)}`,
        type: 'tag',
      });
      report.redirects.push({
        from: `/tag/${cleanSlug(tag.slug)}/`,
        to: `/tag/${cleanSlug(tag.slug)}`,
        type: 'tag',
      });
    } catch (err) {
      report.errors.push(`tag ${tag.slug}: ${err.message}`);
    }
  }
  console.log(`Tags: ${report.tags}`);

  // --- Term relations helper ---
  async function termsForPost(postId) {
    const [rows] = await conn.query(
      `
      SELECT t.term_id, tt.taxonomy, t.slug
      FROM wp_term_relationships tr
      JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
      JOIN wp_terms t ON t.term_id = tt.term_id
      WHERE tr.object_id = ?
    `,
      [postId]
    );
    const cats = rows.filter((r) => r.taxonomy === 'category');
    const postTags = rows.filter((r) => r.taxonomy === 'post_tag');
    return { cats, postTags };
  }

  async function postMeta(postId) {
    const [rows] = await conn.query(
      `SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key IN (
        'post_views_count','votes_like_count','votes_dislike_count','votes_count','_thumbnail_id',
        '_wp_attached_file'
      )`,
      [postId]
    );
    return metaMap(rows);
  }

  async function aioseo(postId) {
    try {
      const [rows] = await conn.query(
        `SELECT title, description, canonical_url, og_image_url, og_title, og_description
         FROM wp_aioseo_posts WHERE post_id = ? LIMIT 1`,
        [postId]
      );
      return rows[0] || null;
    } catch {
      return null;
    }
  }

  // --- Articles ---
  const [posts] = await conn.query(`
    SELECT ID, post_author, post_date_gmt, post_content, post_title, post_excerpt,
           post_status, post_name, post_modified_gmt, guid
    FROM wp_posts
    WHERE post_type = 'post' AND post_status IN ('publish','draft','pending')
    ORDER BY ID
  `);

  const articleByWp = new Map();

  for (const post of posts) {
    try {
      const slug = cleanSlug(post.post_name, `post-${post.ID}`);
      const { cats, postTags } = await termsForPost(post.ID);
      const primaryCat = cats[0] ? categoryIdByWp.get(cats[0].term_id) : null;
      const catSlug = cats[0] ? cleanSlug(cats[0].slug) : 'other';
      const meta = await postMeta(post.ID);
      const seoRow = await aioseo(post.ID);
      const author = authors[String(post.post_author)] || authors[post.post_author];

      const tagDocs = postTags
        .map((t) => tagIdByWp.get(t.term_id))
        .filter(Boolean)
        .map((t) => t.documentId);

      const publishedAt =
        post.post_status === 'publish' && post.post_date_gmt && !String(post.post_date_gmt).startsWith('0000')
          ? new Date(post.post_date_gmt).toISOString()
          : null;

      const seo = seoRow
        ? {
            metaTitle: seoRow.title || seoRow.og_title || post.post_title,
            metaDescription: seoRow.description || seoRow.og_description || post.post_excerpt || '',
            canonicalPath: `/${catSlug}/${slug}`,
          }
        : {
            metaTitle: post.post_title,
            metaDescription: post.post_excerpt || '',
            canonicalPath: `/${catSlug}/${slug}`,
          };

      const content = rewriteContent(post.post_content || '');
      const payload = {
        data: {
          title: post.post_title || `Post ${post.ID}`,
          slug,
          content,
          readingMinutes: estimateReadingMinutes(content),
          views: Number(meta.post_views_count || 0),
          likes: Number(meta.votes_like_count || 0),
          dislikes: Number(meta.votes_dislike_count || 0),
          legacyWpId: post.ID,
          legacyPath: `/${catSlug}/${slug}`,
          category: primaryCat?.documentId || null,
          tags: tagDocs,
          seo,
          ...(publishedAt
            ? { publishedAt }
            : {}),
        },
      };

      // Strapi 5 draftAndPublish: status via query param on create/update
      const statusQuery = post.post_status === 'publish' ? '?status=published' : '';

      let existing = await findByLegacy('articles', post.ID);
      let saved;
      if (existing) {
        saved = (await strapi('PUT', `/api/articles/${existing.documentId}${statusQuery}`, payload)).data;
      } else {
        saved = (await strapi('POST', `/api/articles${statusQuery}`, payload)).data;
      }

      articleByWp.set(post.ID, { ...saved, categorySlug: catSlug, slug });
      if (post.post_status === 'publish') report.articles += 1;
      else report.drafts += 1;

      report.redirects.push({
        from: `/${catSlug}/${slug}`,
        to: `/${catSlug}/${slug}`,
        type: 'article',
        legacyWpId: post.ID,
      });
      report.redirects.push({
        from: `/${catSlug}/${slug}/`,
        to: `/${catSlug}/${slug}`,
        type: 'article',
      });
      report.redirects.push({
        from: `/${catSlug}/${slug}/%20`,
        to: `/${catSlug}/${slug}`,
        type: 'article-space-artifact',
      });
      report.redirects.push({
        from: `/${catSlug}/${slug}/%20/`,
        to: `/${catSlug}/${slug}`,
        type: 'article-space-artifact',
      });

      if (report.articles % 25 === 0) {
        console.log(`  articles progress: ${report.articles}+${report.drafts}`);
      }
    } catch (err) {
      report.errors.push(`post ${post.ID}: ${err.message}`);
      console.error(`post ${post.ID}:`, err.message);
    }
  }
  console.log(`Articles published=${report.articles} drafts=${report.drafts}`);

  // --- Pages ---
  const [pages] = await conn.query(`
    SELECT ID, post_content, post_title, post_excerpt, post_status, post_name, post_date_gmt
    FROM wp_posts
    WHERE post_type = 'page' AND post_status = 'publish'
    ORDER BY ID
  `);

  for (const page of pages) {
    const slug = cleanSlug(page.post_name);
    if (SKIP_AUTH_SLUGS.has(slug)) {
      report.skippedPages.push(slug);
      report.redirects.push({ from: `/${slug}`, to: '/', type: 'drop-auth-page' });
      continue;
    }
    try {
      const seoRow = await aioseo(page.ID);
      const publishedAt =
        page.post_date_gmt && !String(page.post_date_gmt).startsWith('0000')
          ? new Date(page.post_date_gmt).toISOString()
          : new Date().toISOString();

      const payload = {
        data: {
          title: page.post_title,
          slug,
          content: rewriteContent(page.post_content || ''),
          legacyWpId: page.ID,
          seo: {
            metaTitle: seoRow?.title || page.post_title,
            metaDescription: seoRow?.description || page.post_excerpt || '',
            canonicalPath: `/${slug}`,
          },
          publishedAt,
        },
      };

      let existing = await findByLegacy('pages', page.ID);
      if (existing) {
        await strapi('PUT', `/api/pages/${existing.documentId}?status=published`, payload);
      } else {
        await strapi('POST', '/api/pages?status=published', payload);
      }
      report.pages += 1;
      report.redirects.push({ from: `/${slug}`, to: `/${slug}`, type: 'page' });
      report.redirects.push({ from: `/${slug}/`, to: `/${slug}`, type: 'page' });
    } catch (err) {
      report.errors.push(`page ${slug}: ${err.message}`);
    }
  }
  console.log(`Pages: ${report.pages}`);

  // --- Comments ---
  const [comments] = await conn.query(`
    SELECT comment_ID, comment_post_ID, comment_author, comment_author_email,
           comment_date_gmt, comment_content, comment_approved, comment_parent
    FROM wp_comments
    WHERE comment_approved = '1' AND comment_type IN ('','comment')
    ORDER BY comment_ID
  `);

  const commentByWp = new Map();
  // first pass: top-level
  for (const c of comments.filter((x) => Number(x.comment_parent) === 0)) {
    const article = articleByWp.get(c.comment_post_ID);
    if (!article) continue;
    try {
      let existing = await findByLegacy('comments', c.comment_ID);
      const payload = {
        data: {
          content: c.comment_content,
          authorName: c.comment_author || 'Гость',
          authorEmail: c.comment_author_email || null,
          approved: true,
          legacyWpId: c.comment_ID,
          article: article.documentId,
          parent: null,
        },
      };
      if (existing) {
        existing = (await strapi('PUT', `/api/comments/${existing.documentId}`, payload)).data;
      } else {
        existing = (await strapi('POST', '/api/comments', payload)).data;
      }
      commentByWp.set(c.comment_ID, existing);
      report.comments += 1;
    } catch (err) {
      report.errors.push(`comment ${c.comment_ID}: ${err.message}`);
    }
  }
  // replies
  for (const c of comments.filter((x) => Number(x.comment_parent) !== 0)) {
    const article = articleByWp.get(c.comment_post_ID);
    const parent = commentByWp.get(Number(c.comment_parent));
    if (!article) continue;
    try {
      let existing = await findByLegacy('comments', c.comment_ID);
      const payload = {
        data: {
          content: c.comment_content,
          authorName: c.comment_author || 'Гость',
          authorEmail: c.comment_author_email || null,
          approved: true,
          legacyWpId: c.comment_ID,
          article: article.documentId,
          parent: parent?.documentId || null,
        },
      };
      if (existing) {
        existing = (await strapi('PUT', `/api/comments/${existing.documentId}`, payload)).data;
      } else {
        existing = (await strapi('POST', '/api/comments', payload)).data;
      }
      commentByWp.set(c.comment_ID, existing);
      report.comments += 1;
    } catch (err) {
      report.errors.push(`comment ${c.comment_ID}: ${err.message}`);
    }
  }
  console.log(`Comments: ${report.comments}`);

  await conn.end();

  // unique redirects
  const seen = new Set();
  const redirects = [];
  for (const r of report.redirects) {
    const key = `${r.from}->${r.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    redirects.push(r);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'redirects.json'), JSON.stringify(redirects, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, 'redirects.csv'),
    ['from,to,type', ...redirects.map((r) => `"${r.from}","${r.to}","${r.type}"`)].join('\n')
  );

  console.log('Done.');
  console.log(JSON.stringify({ ...report, redirects: redirects.length, errors: report.errors.length }, null, 2));
  if (report.errors.length) {
    console.log('First errors:', report.errors.slice(0, 10));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
