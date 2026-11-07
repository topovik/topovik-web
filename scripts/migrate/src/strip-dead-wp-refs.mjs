import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 5434),
  database: process.env.DATABASE_NAME || 'topovik',
  user: process.env.DATABASE_USERNAME || 'topovik',
  password: process.env.DATABASE_PASSWORD || 'topovik',
});

const { rows } = await pool.query(
  `SELECT id, content FROM articles WHERE content LIKE '%wp-content/uploads%'`
);
let cleaned = 0;
for (const row of rows) {
  let c = row.content;
  c = c.replace(
    /!\[[^\]]*\]\((?:https?:\/\/(?:www\.)?topovik\.com)?(?:\/uploads)?\/wp-content\/uploads\/[^)\s]+\)/gi,
    ''
  );
  c = c.replace(/<img\b[^>]*wp-content\/uploads[^>]*>/gi, '');
  c = c.replace(
    /(?:https?:\/\/(?:www\.)?topovik\.com)?(?:\/uploads)?\/wp-content\/uploads\/[^\s"'\\)<>]+/gi,
    ''
  );
  if (c !== row.content) {
    await pool.query(`UPDATE articles SET content = $2, updated_at = NOW() WHERE id = $1`, [
      row.id,
      c,
    ]);
    cleaned += 1;
  }
}
const { rows: left } = await pool.query(
  `SELECT COUNT(*)::int AS n FROM articles WHERE content LIKE '%wp-content%'`
);
console.log({ cleaned, stillWithWp: left[0].n });
await pool.end();
