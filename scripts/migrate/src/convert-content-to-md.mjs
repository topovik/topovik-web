import pg from 'pg';
import { htmlToMarkdown } from './html-to-markdown.mjs';

const PG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5434),
  user: process.env.PGUSER || 'topovik',
  password: process.env.PGPASSWORD || 'topovik',
  database: process.env.PGDATABASE || 'topovik',
};

async function convertTable(client, table) {
  const { rows } = await client.query(
    `SELECT id, content FROM ${table} WHERE content IS NOT NULL AND content <> ''`
  );

  let updated = 0;
  let skipped = 0;
  let shrunk = 0;

  for (const row of rows) {
    const before = row.content;
    const after = htmlToMarkdown(before);
    if (after === before) {
      skipped += 1;
      continue;
    }
    if (after.length < before.length) shrunk += 1;
    await client.query(`UPDATE ${table} SET content = $1, updated_at = NOW() WHERE id = $2`, [
      after,
      row.id,
    ]);
    updated += 1;
  }

  return { total: rows.length, updated, skipped, shrunk };
}

async function main() {
  const client = new pg.Client(PG);
  await client.connect();

  const articles = await convertTable(client, 'articles');
  const pages = await convertTable(client, 'pages');

  const sample = await client.query(
    `SELECT legacy_wp_id, left(title, 40) AS title, left(content, 350) AS content
     FROM articles
     WHERE published_at IS NOT NULL AND content IS NOT NULL AND content <> ''
     ORDER BY published_at DESC
     LIMIT 2`
  );

  const stats = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE content ~* '<p[ >]') AS still_html_p,
       COUNT(*) FILTER (WHERE content ~* 'style=') AS still_style,
       COUNT(*) FILTER (WHERE content ~* '&nbsp;') AS still_nbsp,
       COUNT(*) FILTER (WHERE content ~ '^#{1,6} ') AS has_md_headings,
       COUNT(*) AS total
     FROM articles WHERE content IS NOT NULL AND content <> ''`
  );

  await client.end();

  console.log({ articles, pages, stats: stats.rows[0], sample: sample.rows });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
