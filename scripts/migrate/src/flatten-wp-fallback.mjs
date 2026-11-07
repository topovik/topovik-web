import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const UPLOADS = path.join(ROOT, 'cms/public/uploads');
const WP = path.join(ROOT, 'old/wp-content/uploads');
const WP_PATH_RE =
  /(?:https?:\/\/(?:www\.)?topovik\.com)?(?:\/uploads)?\/wp-content\/uploads\/([^\s"'\\)<>]+)/gi;

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 5434),
  database: process.env.DATABASE_NAME || 'topovik',
  user: process.env.DATABASE_USERNAME || 'topovik',
  password: process.env.DATABASE_PASSWORD || 'topovik',
});

function sanitizeBase(name) {
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  const clean =
    stem
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'file';
  return { stem: clean, ext: ext.toLowerCase() || '' };
}

function targetName(relPath) {
  const base = path.basename(relPath.split('?')[0].split('#')[0]);
  const { stem, ext } = sanitizeBase(base);
  const hash = crypto.createHash('md5').update(relPath).digest('hex').slice(0, 10);
  return `${stem}_${hash}${ext}`;
}

function findFallback(rel) {
  const abs = path.join(WP, rel);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  const dir = path.dirname(abs);
  const base = path.basename(abs);
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  if (!fs.existsSync(dir)) return null;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pickLargest = (files) =>
    files
      .map((n) => path.join(dir, n))
      .filter((p) => fs.statSync(p).isFile())
      .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0] || null;

  const re = new RegExp(`^${esc(stem)}(-\\d+x\\d+)?${esc(ext)}$`, 'i');
  const hit = pickLargest(fs.readdirSync(dir).filter((n) => re.test(n)));
  if (hit) return hit;

  const m = stem.match(/^(.*)-(\d+)$/);
  if (m) {
    const re2 = new RegExp(`^${esc(m[1])}(-\\d+x\\d+)?${esc(ext)}$`, 'i');
    return pickLargest(fs.readdirSync(dir).filter((n) => re2.test(n)));
  }
  return null;
}

const { rows } = await pool.query(
  `SELECT id, content FROM articles WHERE content LIKE '%wp-content/uploads%'`
);
const mapping = new Map();
let fixed = 0;
let stillMissing = 0;
let articles = 0;
const missing = [];

for (const row of rows) {
  const refs = new Set();
  for (const m of row.content.matchAll(WP_PATH_RE)) {
    let rel = (m[1] || '')
      .replace(/\\/g, '')
      .split('?')[0]
      .split('#')[0]
      .replace(/[.,;:!?]+$/, '');
    if (rel) refs.add(rel);
  }
  for (const rel of refs) {
    if (mapping.has(rel)) continue;
    const src = findFallback(rel);
    if (!src) {
      stillMissing += 1;
      missing.push(rel);
      continue;
    }
    const dest = targetName(rel);
    const dst = path.join(UPLOADS, dest);
    if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    mapping.set(rel, dest);
    fixed += 1;
  }
  const next = row.content.replace(WP_PATH_RE, (full, relRaw) => {
    let rel = (relRaw || '')
      .replace(/\\/g, '')
      .split('?')[0]
      .split('#')[0]
      .replace(/[.,;:!?]+$/, '');
    const dest = mapping.get(rel);
    return dest ? `/uploads/${dest}` : full;
  });
  if (next !== row.content) {
    await pool.query(`UPDATE articles SET content = $2, updated_at = NOW() WHERE id = $1`, [
      row.id,
      next,
    ]);
    articles += 1;
  }
}

const { rows: left } = await pool.query(
  `SELECT COUNT(*)::int AS n FROM articles WHERE content LIKE '%wp-content/uploads%'`
);
console.log(
  JSON.stringify(
    {
      fixed,
      stillMissing,
      articlesUpdated: articles,
      articlesStillWithWp: left[0].n,
      mapped: mapping.size,
      missingSample: missing.slice(0, 20),
    },
    null,
    2
  )
);
await pool.end();
