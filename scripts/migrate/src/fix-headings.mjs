/**
 * Fix article/page content headings in Strapi:
 * unwrap nested bold inside real headings only
 *   `## **Title**` / `<h2><strong>Title</strong></h2>` → `## Title` / `<h2>Title</h2>`
 *
 * Does NOT promote standalone **bold** paragraphs to headings (too many CTAs / item labels).
 *
 * Usage:
 *   bun src/fix-headings.mjs            # dry-run (Postgres)
 *   bun src/fix-headings.mjs --apply    # write via Postgres
 *   bun src/fix-headings.mjs --api --apply  # write via Strapi API
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const USE_API = process.argv.includes('--api');

const PG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5434),
  user: process.env.PGUSER || 'topovik',
  password: process.env.PGPASSWORD || 'topovik',
  database: process.env.PGDATABASE || 'topovik',
};

const STRAPI_URL = (process.env.STRAPI_URL || 'http://127.0.0.1:1337').replace(/\/$/, '');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_TOKEN =
  process.env.STRAPI_TOKEN ||
  fs.readFileSync(path.join(__dirname, '../.api-token'), 'utf8').trim();

/** Strip wrapping bold markers / tags from a heading title. */
function unwrapBold(text) {
  let t = String(text).trim();
  // Nested / repeated wrappers
  for (let i = 0; i < 3; i++) {
    const next = t
      .replace(/^<strong>([\s\S]*)<\/strong>$/i, '$1')
      .replace(/^<b>([\s\S]*)<\/b>$/i, '$1')
      .replace(/^\*\*([^*][\s\S]*?)\*\*$/, '$1')
      .replace(/^__([^_][\s\S]*?)__$/, '$1')
      .trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

/**
 * Normalize content (Markdown with occasional leftover HTML).
 * Returns { content, changes: string[] }
 */
export function fixHeadings(content) {
  if (!content) return { content: content || '', changes: [] };
  let out = String(content);
  const changes = [];

  // 1) Markdown ATX headings with nested bold.
  // Covers: ## **Title** | ## **Title**<iframe…> | ## **Title (unclosed)
  out = out.replace(/^(#{1,6})[ \t]+(.+)$/gm, (full, hashes, rest) => {
    const body = String(rest).trimEnd();

    // Opening ** / __ right after hashes
    const open = body.match(/^(?:\*\*|__)([\s\S]*)$/);
    if (!open) return full;

    let inner = open[1];
    // Prefer matching closer ** / __; keep trailing markup after closer
    const closeIdxStar = inner.search(/\*\*/);
    const closeIdxUnder = inner.search(/__/);
    let closeIdx = -1;
    let delimLen = 2;
    if (closeIdxStar >= 0 && (closeIdxUnder < 0 || closeIdxStar <= closeIdxUnder)) {
      closeIdx = closeIdxStar;
    } else if (closeIdxUnder >= 0) {
      closeIdx = closeIdxUnder;
    }

    let title;
    let trailing = '';
    if (closeIdx >= 0) {
      title = inner.slice(0, closeIdx);
      trailing = inner.slice(closeIdx + delimLen);
    } else {
      // Unclosed bold in heading — drop the opener
      title = inner;
    }

    title = unwrapBold(title).replace(/\s+/g, ' ').trim();
    // Drop empty/broken headings like "## **"
    if (!title) {
      changes.push(`atx-empty: ${full.slice(0, 40)}`);
      return trailing.trim() ? trailing.trim() : '';
    }

    // Keep a gap before trailing HTML glued to the closing **
    if (trailing && !/^\s/.test(trailing) && /^</.test(trailing)) {
      trailing = `\n\n${trailing}`;
    }

    const next = `${hashes} ${title}${trailing}`;
    if (next !== full) {
      changes.push(`atx-bold: ${full.slice(0, 60)} → ${next.slice(0, 60)}`);
    }
    return next;
  });

  // 2) HTML headings with nested strong/b: <h2><strong>Title</strong></h2>
  out = out.replace(
    /<h([1-6])(\b[^>]*)>\s*<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>\s*<\/h\1>/gi,
    (full, level, attrs, title) => {
      const clean = unwrapBold(title);
      const next = `<h${level}${attrs}>${clean}</h${level}>`;
      if (next !== full) changes.push(`html-h-bold: h${level} ${clean.slice(0, 40)}`);
      return next;
    }
  );

  if (out !== content) {
    out = out.replace(/\n{3,}/g, '\n\n').trim();
  }

  return { content: out, changes };
}

async function processTable(client, table) {
  const { rows } = await client.query(
    `SELECT id, title, content FROM ${table} WHERE content IS NOT NULL AND content <> ''`
  );

  let touched = 0;
  let changeCount = 0;
  const samples = [];

  for (const row of rows) {
    const { content, changes } = fixHeadings(row.content);
    if (!changes.length || content === row.content) continue;
    touched += 1;
    changeCount += changes.length;
    if (samples.length < 12) {
      samples.push({
        table,
        id: row.id,
        title: String(row.title || '').slice(0, 60),
        changes: changes.slice(0, 5),
        preview: content.slice(0, 200),
      });
    }
    if (APPLY) {
      await client.query(`UPDATE ${table} SET content = $1, updated_at = NOW() WHERE id = $2`, [
        content,
        row.id,
      ]);
    }
  }

  return { total: rows.length, touched, changeCount, samples };
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

async function processViaApi(uidPlural) {
  let page = 1;
  const pageSize = 100;
  let total = 0;
  let touched = 0;
  let changeCount = 0;
  const samples = [];
  const errors = [];

  while (true) {
    const q = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
      'status': 'published',
      'fields[0]': 'title',
      'fields[1]': 'content',
      'fields[2]': 'slug',
    });
    // Also include drafts
    const qAll = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
      'publicationState': 'preview',
      'fields[0]': 'title',
      'fields[1]': 'content',
      'fields[2]': 'slug',
    });
    const json = await strapi('GET', `/api/${uidPlural}?${qAll}`);
    const rows = json.data || [];
    total = json.meta?.pagination?.total ?? total;

    for (const row of rows) {
      const before = row.content || '';
      const { content, changes } = fixHeadings(before);
      if (!changes.length || content === before) continue;
      touched += 1;
      changeCount += changes.length;
      if (samples.length < 12) {
        samples.push({
          documentId: row.documentId,
          title: String(row.title || '').slice(0, 60),
          changes: changes.slice(0, 5),
        });
      }
      if (APPLY) {
        try {
          await strapi('PUT', `/api/${uidPlural}/${row.documentId}`, {
            data: { content },
          });
        } catch (err) {
          errors.push({ documentId: row.documentId, error: String(err.message || err) });
        }
      }
    }

    const pageCount = json.meta?.pagination?.pageCount || 1;
    if (page >= pageCount || !rows.length) break;
    page += 1;
  }

  return { total, touched, changeCount, samples, errors };
}

async function main() {
  if (USE_API) {
    const articles = await processViaApi('articles');
    const pages = await processViaApi('pages');
    console.log(
      JSON.stringify({ mode: APPLY ? 'apply-api' : 'dry-run-api', articles, pages }, null, 2)
    );
    return;
  }

  const client = new pg.Client(PG);
  await client.connect();

  const articles = await processTable(client, 'articles');
  const pages = await processTable(client, 'pages');

  const stats = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE content ~ '(^|\\n)#{1,6} \\*\\*') AS md_h_with_bold,
       COUNT(*) FILTER (WHERE content ~* '<h[1-6][^>]*>\\s*<(strong|b)>') AS html_h_with_bold,
       COUNT(*) FILTER (WHERE content ~ '^#{1,6} ') AS has_md_headings,
       COUNT(*) AS total
     FROM articles WHERE content IS NOT NULL AND content <> ''`
  );

  await client.end();

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        articles,
        pages,
        statsAfter: stats.rows[0],
      },
      null,
      2
    )
  );
}

const isDirect =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('fix-headings.mjs');

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
