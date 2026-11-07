import mysql from 'mysql2/promise';
import pg from 'pg';

/**
 * Re-apply WordPress post_views_count onto Strapi articles by legacy_wp_id.
 * Safe to re-run; does not touch likes/dislikes or content.
 */

const MYSQL = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'wordpress',
};

const PG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5434),
  user: process.env.PGUSER || 'topovik',
  password: process.env.PGPASSWORD || 'topovik',
  database: process.env.PGDATABASE || 'topovik',
};

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL);
  const [rows] = await mysqlConn.query(`
    SELECT p.ID AS post_id, COALESCE(CAST(pm.meta_value AS UNSIGNED), 0) AS views
    FROM wp_posts p
    LEFT JOIN wp_postmeta pm
      ON pm.post_id = p.ID AND pm.meta_key = 'post_views_count'
    WHERE p.post_type = 'post'
      AND p.post_status IN ('publish', 'draft', 'pending')
  `);
  await mysqlConn.end();

  console.log(`Loaded ${rows.length} WP posts with view counts`);

  const client = new pg.Client(PG);
  await client.connect();

  let updated = 0;
  let missing = 0;
  let unchanged = 0;

  for (const row of rows) {
    const views = Number(row.views) || 0;
    const res = await client.query(
      `UPDATE articles
       SET views = $1
       WHERE legacy_wp_id = $2 AND views IS DISTINCT FROM $1`,
      [views, row.post_id]
    );
    if (res.rowCount > 0) {
      updated += res.rowCount;
      continue;
    }
    const exists = await client.query(
      `SELECT 1 FROM articles WHERE legacy_wp_id = $1 LIMIT 1`,
      [row.post_id]
    );
    if (exists.rowCount === 0) missing += 1;
    else unchanged += 1;
  }

  const stats = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE published_at IS NOT NULL) AS published,
      COALESCE(SUM(views) FILTER (WHERE published_at IS NOT NULL), 0) AS sum_views,
      COALESCE(MAX(views) FILTER (WHERE published_at IS NOT NULL), 0) AS max_views
    FROM articles
  `);

  await client.end();

  console.log(
    JSON.stringify(
      {
        updated,
        unchanged,
        missing,
        published: Number(stats.rows[0].published),
        sumViews: Number(stats.rows[0].sum_views),
        maxViews: Number(stats.rows[0].max_views),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
