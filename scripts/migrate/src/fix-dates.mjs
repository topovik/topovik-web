import mysql from 'mysql2/promise';
import pg from 'pg';

/**
 * Strapi 5 ignores/overrides publishedAt on REST create with status=published.
 * Re-apply real WordPress post_date_gmt onto articles (and pages) in Postgres.
 */

const MYSQL = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'wordpress',
  dateStrings: true,
};

const PG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5434),
  user: process.env.PGUSER || 'topovik',
  password: process.env.PGPASSWORD || 'topovik',
  database: process.env.PGDATABASE || 'topovik',
};

function gmtToTs(value) {
  const s = String(value || '').trim();
  if (!s || s.startsWith('0000')) return null;
  // WP stores GMT as 'YYYY-MM-DD HH:MM:SS' — use as-is for timestamp without time zone
  return s;
}

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL);
  const [posts] = await mysqlConn.query(`
    SELECT ID, post_date_gmt, post_modified_gmt, post_status, post_type
    FROM wp_posts
    WHERE post_type IN ('post', 'page')
      AND post_status IN ('publish', 'draft', 'pending')
  `);
  await mysqlConn.end();

  console.log(`Loaded ${posts.length} WP rows`);

  const client = new pg.Client(PG);
  await client.connect();

  let articlesPublished = 0;
  let articlesDraft = 0;
  let pagesUpdated = 0;

  for (const post of posts) {
    const created = gmtToTs(post.post_date_gmt);
    const modified = gmtToTs(post.post_modified_gmt) || created;
    if (!created) continue;

    if (post.post_type === 'post') {
      const draftRes = await client.query(
        `UPDATE articles
         SET created_at = $1::timestamp,
             updated_at = $2::timestamp
         WHERE legacy_wp_id = $3 AND published_at IS NULL`,
        [created, modified, post.ID]
      );
      articlesDraft += draftRes.rowCount;

      // Any row that is currently published gets the real WP date
      // (including drafts that were accidentally published during media import)
      const pubRes = await client.query(
        `UPDATE articles
         SET published_at = $1::timestamp,
             created_at = $1::timestamp,
             updated_at = $2::timestamp
         WHERE legacy_wp_id = $3 AND published_at IS NOT NULL`,
        [created, modified, post.ID]
      );
      articlesPublished += pubRes.rowCount;
    }

    if (post.post_type === 'page') {
      const r1 = await client.query(
        `UPDATE pages
         SET created_at = $1::timestamp, updated_at = $2::timestamp
         WHERE legacy_wp_id = $3 AND published_at IS NULL`,
        [created, modified, post.ID]
      );
      const r2 = await client.query(
        `UPDATE pages
         SET published_at = $1::timestamp, created_at = $1::timestamp, updated_at = $2::timestamp
         WHERE legacy_wp_id = $3 AND published_at IS NOT NULL`,
        [created, modified, post.ID]
      );
      pagesUpdated += r1.rowCount + r2.rowCount;
    }
  }

  // WP drafts with 0000-00-00 dates were wrongly published during import —
  // unpublish them so they don't float to the top of the feed as "today".
  const unpub = await client.query(
    `UPDATE articles a
     SET published_at = NULL
     WHERE a.published_at IS NOT NULL
       AND a.legacy_wp_id = ANY($1::int[])`,
    [
      posts
        .filter((p) => p.post_type === 'post' && !gmtToTs(p.post_date_gmt))
        .map((p) => p.ID),
    ]
  );

  const sample = await client.query(
    `SELECT legacy_wp_id, left(title, 40) AS title, published_at, created_at
     FROM articles
     WHERE legacy_wp_id IN (19903, 19870, 4187) AND published_at IS NOT NULL
     ORDER BY legacy_wp_id`
  );
  const counts = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE published_at::date = CURRENT_DATE) AS today,
       COUNT(*) FILTER (WHERE published_at < TIMESTAMP '2025-01-01') AS historic,
       COUNT(*) AS total_published
     FROM articles WHERE published_at IS NOT NULL`
  );

  await client.end();

  console.log({
    articlesPublished,
    articlesDraft,
    pagesUpdated,
    unpublishedInvalidDates: unpub.rowCount,
    counts: counts.rows[0],
    sample: sample.rows,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
