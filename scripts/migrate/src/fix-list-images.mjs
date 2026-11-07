/**
 * Unwrap images that migrated from WP as list items:
 *   `-   ![](url)` / `* ![alt](url)` / lone `*` before an image
 * into bare markdown images (no ul/li when rendered).
 *
 * Also strips leftover HTML: <ul><li><img…></li></ul>
 *
 * Usage:
 *   bun src/fix-list-images.mjs            # dry-run
 *   bun src/fix-list-images.mjs --apply    # write via Postgres
 */
import pg from 'pg';

const APPLY = process.argv.includes('--apply');

const PG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5434),
  user: process.env.PGUSER || 'topovik',
  password: process.env.PGPASSWORD || 'topovik',
  database: process.env.PGDATABASE || 'topovik',
};

/** Markdown image / linked-image token (no nested brackets assumed). */
const MD_IMG =
  '(?:!?\\[[^\\]]*\\]\\([^\\)]+\\)|!\\[[^\\]]*\\]\\([^\\)]+\\)|\\[!\\[[^\\]]*\\]\\([^\\)]+\\)\\]\\([^\\)]+\\))';

/**
 * Normalize content. Returns { content, changes: string[] }
 */
export function fixListImages(content) {
  if (!content) return { content: content || '', changes: [] };
  let out = String(content);
  const changes = [];

  // 1) HTML: <ul>…</ul> whose <li> only wrap images (optionally linked)
  out = out.replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi, (block) => {
    const lis = [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
    if (!lis.length) return block;
    const unwrapped = [];
    for (const [, inner] of lis) {
      const trimmed = String(inner)
        .replace(/<\/?p\b[^>]*>/gi, '')
        .replace(/<br\s*\/?>/gi, '')
        .trim();
      if (!/^<(?:a\b[^>]*>\s*)?img\b/i.test(trimmed)) return block;
      // Keep only the img (and optional wrapping <a>)
      const keep = trimmed.match(/^(?:<a\b[^>]*>\s*)?<img\b[^>]*(?:\/?>|>[\s\S]*?<\/img>)(?:\s*<\/a>)?/i);
      if (!keep) return block;
      const rest = trimmed.slice(keep[0].length).replace(/\s+/g, '');
      if (rest) return block;
      unwrapped.push(keep[0]);
    }
    changes.push(`html-ul-images: ${unwrapped.length}`);
    return `\n\n${unwrapped.join('\n\n')}\n\n`;
  });

  // 2) Markdown bullet that is only an image (same line)
  //    -   ![](url)
  //    * ![alt](url "title")
  //    - [![alt](img)](href)
  out = out.replace(
    new RegExp(`^([ \\t]{0,3})[-*][ \\t]+(${MD_IMG})[ \\t]*$`, 'gm'),
    (full, _indent, img) => {
      changes.push(`md-bullet-img: ${img.slice(0, 80)}`);
      return img;
    }
  );

  // 3) Lone bullet marker on its own line, image on the next non-empty line
  //    *
  //
  //    ![alt](url)
  out = out.replace(
    new RegExp(
      `^([ \\t]{0,3})[-*][ \\t]*\\n+(?:[ \\t]*\\n)*(${MD_IMG})[ \\t]*$`,
      'gm'
    ),
    (full, _indent, img) => {
      changes.push(`md-lone-bullet-img: ${img.slice(0, 80)}`);
      return img;
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
    const { content, changes } = fixListImages(row.content);
    if (!changes.length || content === row.content) continue;
    touched += 1;
    changeCount += changes.length;
    if (samples.length < 16) {
      samples.push({
        table,
        id: row.id,
        title: String(row.title || '').slice(0, 60),
        changes: changes.slice(0, 6),
        before: row.content.match(/^.*[-*].*!\[.*$/m)?.[0]?.slice(0, 120),
        after: content.match(/^.*!\[.*$/m)?.[0]?.slice(0, 120),
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

async function main() {
  const client = new pg.Client(PG);
  await client.connect();

  const articles = await processTable(client, 'articles');
  const pages = await processTable(client, 'pages');

  const stats = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE content ~ E'(^|\\n)[ \\t]*[-*][ \\t]+!') AS md_bullet_bang,
       COUNT(*) FILTER (WHERE content ILIKE '%<ul%') AS has_ul,
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
  process.argv[1]?.endsWith('fix-list-images.mjs');

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
