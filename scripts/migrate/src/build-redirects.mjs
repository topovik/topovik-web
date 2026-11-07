import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

/**
 * Build SEO redirect map from WordPress permalinks.
 * Canonical article URL: /{categorySlug}/{postSlug}
 * Also emit 301 sources for trailing slash and legacy "%20" artifact.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../out');

const MYSQL = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'wordpress',
};

const SKIP_PAGES = new Set(['signin', 'registration', 'zabyli-parol', 'password-reset']);

function decodeSlug(slug) {
  let value = String(slug || '').trim();
  try {
    if (/%[0-9a-f]{2}/i.test(value)) value = decodeURIComponent(value);
  } catch {
    /* keep */
  }
  return value;
}

function add(map, from, to, type) {
  if (!from || !to) return;
  if (!map.has(from)) map.set(from, { from, to, type });
}

async function main() {
  const conn = await mysql.createConnection(MYSQL);
  const redirects = new Map();

  const [posts] = await conn.query(`
    SELECT p.ID, p.post_name, p.post_status,
      (
        SELECT t.slug FROM wp_term_relationships tr
        JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'category'
        JOIN wp_terms t ON t.term_id = tt.term_id
        WHERE tr.object_id = p.ID
        ORDER BY tt.term_id ASC
        LIMIT 1
      ) AS cat_slug
    FROM wp_posts p
    WHERE p.post_type = 'post' AND p.post_status IN ('publish','draft','pending')
  `);

  for (const p of posts) {
    const cat = p.cat_slug || 'other';
    const slug = p.post_name;
    // Always keep query permalink used by WP when pretty slug missing
    add(redirects, `/?p=${p.ID}`, slug ? `/${cat}/${slug}` : `/?p=${p.ID}`, 'wp-query');
    add(redirects, `/?p=${p.ID}/`, slug ? `/${cat}/${slug}` : `/?p=${p.ID}`, 'wp-query');

    if (!slug) continue;

    const to = `/${cat}/${slug}`;
    add(redirects, to, to, 'article-canonical');
    add(redirects, `${to}/`, to, 'article-trailing');
    add(redirects, `${to}/%20`, to, 'article-space-artifact');
    add(redirects, `${to}/%20/`, to, 'article-space-artifact');
    add(redirects, `${to}/ `, to, 'article-space-artifact');
  }

  const [cats] = await conn.query(`
    SELECT t.slug FROM wp_terms t
    JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'category'
  `);
  for (const c of cats) {
    const slug = c.slug;
    if (!slug || slug.includes('%')) {
      // percent-encoded uncategoriezed etc. — decode for target if possible
      let decoded = decodeSlug(slug);
      // keep archive at /category/{original-or-decoded}
    }
    const raw = c.slug;
    const to = `/category/${raw.includes('%') ? decodeSlug(raw).replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || raw : raw}`;
    // Prefer preserving exact WP category_base URL for latin slugs
    if (!raw.includes('%')) {
      add(redirects, `/category/${raw}`, `/category/${raw}`, 'category');
      add(redirects, `/category/${raw}/`, `/category/${raw}`, 'category');
    } else {
      add(redirects, `/category/${raw}`, to, 'category-encoded');
      add(redirects, `/category/${raw}/`, to, 'category-encoded');
    }
  }

  const [tags] = await conn.query(`
    SELECT t.slug FROM wp_terms t
    JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'post_tag' AND tt.count > 0
  `);
  for (const t of tags) {
    if (!t.slug || t.slug.includes('%')) continue; // keep only SEO-safe latin tag URLs
    add(redirects, `/tag/${t.slug}`, `/tag/${t.slug}`, 'tag');
    add(redirects, `/tag/${t.slug}/`, `/tag/${t.slug}`, 'tag');
  }

  const [pages] = await conn.query(`
    SELECT post_name FROM wp_posts
    WHERE post_type = 'page' AND post_status = 'publish'
  `);
  for (const page of pages) {
    const slug = page.post_name;
    if (!slug || slug.includes('%')) continue;
    if (SKIP_PAGES.has(slug)) {
      add(redirects, `/${slug}`, '/', 'drop-auth-page');
      add(redirects, `/${slug}/`, '/', 'drop-auth-page');
      continue;
    }
    add(redirects, `/${slug}`, `/${slug}`, 'page');
    add(redirects, `/${slug}/`, `/${slug}`, 'page');
  }

  await conn.end();

  const list = [...redirects.values()];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'redirects.json'), JSON.stringify(list, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, 'redirects.csv'),
    ['from,to,type', ...list.map((r) => `"${r.from}","${r.to}","${r.type}"`)].join('\n')
  );
  console.log(`Wrote ${list.length} redirects`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
