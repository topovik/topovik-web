/**
 * Aggressively rename remaining dash/underscore-heavy upload filenames.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.join(__dirname, '../out');
const UPLOADS = path.join(ROOT, 'cms/public/uploads');
const DRY = process.argv.includes('--dry-run');

const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function translit(s) {
  let out = '';
  for (const ch of s) {
    const low = ch.toLowerCase();
    if (TR[low] !== undefined) {
      const t = TR[low];
      out += ch === low ? t : t.charAt(0).toUpperCase() + t.slice(1);
    } else out += ch;
  }
  return out;
}

function slugify(stem) {
  let s = translit(stem)
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 100);
  // if still junk (only digits/empty), mark empty
  const letters = (s.match(/[a-z]/g) || []).length;
  if (!s || letters < 2) return '';
  return s;
}

function isUgly(name) {
  const stem = path.basename(name, path.extname(name));
  if (/^[-_]+/.test(stem)) return true;
  if ((stem.match(/[-_]{2,}/g) || []).length >= 2) return true;
  const letters = (stem.match(/[A-Za-zА-Яа-я]/g) || []).length;
  const junk = (stem.match(/[-_]/g) || []).length;
  if (junk >= 4 && letters < 3) return true;
  if (junk >= 6 && letters < junk) return true;
  return false;
}

function niceFromSource(sourceName, hash, ext) {
  let stem = path.basename(sourceName, path.extname(sourceName));
  // strip leading junk dashes that WP used as "names"
  const onlyJunk = /^[-_\s.]+(\d+)?[-_\s.]*$/.test(stem);
  let slug = slugify(stem);
  if (!slug) {
    const num = (stem.match(/(\d+)/g) || []).pop();
    slug = num ? `image-${num}` : 'image';
  }
  if (onlyJunk) {
    const num = (stem.match(/(\d+)/g) || []).pop();
    slug = num ? `image-${num}` : 'image';
  }
  return `${slug}_${hash}${ext.toLowerCase()}`;
}

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 5434),
  database: process.env.DATABASE_NAME || 'topovik',
  user: process.env.DATABASE_USERNAME || 'topovik',
  password: process.env.DATABASE_PASSWORD || 'topovik',
});

const mapping = JSON.parse(
  fs.readFileSync(path.join(OUT, 'flatten-wp-content-mapping.json'), 'utf8')
);

/** dest filename -> preferred source label */
const sourceByDest = new Map();
for (const [rel, dest] of Object.entries(mapping)) {
  sourceByDest.set(dest, path.basename(rel));
}

// Strapi media library originals
const { rows: fileRows } = await pool.query(`SELECT name, url FROM files`);
for (const row of fileRows) {
  const dest = path.basename(row.url || '');
  if (dest && row.name) sourceByDest.set(dest, row.name);
}

const used = new Set(
  fs.readdirSync(UPLOADS).filter((n) => fs.statSync(path.join(UPLOADS, n)).isFile())
);

/** old -> new */
const renames = new Map();
let renamed = 0;

for (const name of [...used]) {
  if (!isUgly(name)) continue;
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  // prefer trailing 10-char hash already in name
  const hm = stem.match(/_([a-f0-9]{10})$/i);
  const hash = hm ? hm[1] : crypto.createHash('md5').update(name).digest('hex').slice(0, 10);
  const source = sourceByDest.get(name) || stem;
  let next = niceFromSource(source, hash, ext);

  if (next === name) continue;
  // unique
  let candidate = next;
  let i = 2;
  while (used.has(candidate) && candidate !== name) {
    candidate = niceFromSource(source, `${hash}${i}`, ext);
    i += 1;
  }
  next = candidate;
  renames.set(name, next);
  if (!DRY) {
    fs.renameSync(path.join(UPLOADS, name), path.join(UPLOADS, next));
  }
  used.delete(name);
  used.add(next);
  renamed += 1;
}

// rewrite content + files.url
const { rows } = await pool.query(
  `SELECT id, content FROM articles WHERE content LIKE '%/uploads/%'`
);
let articlesUpdated = 0;
for (const row of rows) {
  let c = row.content;
  let changed = false;
  for (const [from, to] of renames) {
    if (!c.includes(from)) continue;
    c = c.split(`/uploads/${from}`).join(`/uploads/${to}`);
    changed = true;
  }
  if (changed) {
    if (!DRY) {
      await pool.query(`UPDATE articles SET content=$2, updated_at=NOW() WHERE id=$1`, [
        row.id,
        c,
      ]);
    }
    articlesUpdated += 1;
  }
}

let filesUpdated = 0;
if (!DRY) {
  for (const [from, to] of renames) {
    const r = await pool.query(
      `UPDATE files SET url = $2, hash = $3, updated_at = NOW()
       WHERE url = $1 RETURNING id`,
      [`/uploads/${from}`, `/uploads/${to}`, path.basename(to, path.extname(to))]
    );
    // also formats.medium urls
    await pool.query(
      `UPDATE files
       SET formats = jsonb_set(
         COALESCE(formats, '{}'::jsonb),
         '{medium,url}',
         to_jsonb(replace(COALESCE(formats->'medium'->>'url', ''), $1, $2)),
         true
       )
       WHERE formats->'medium'->>'url' LIKE '%' || $1`,
      [from, to]
    );
    // rename medium file on disk if present
    const mediumFrom = `medium_${path.basename(from, path.extname(from))}${path.extname(from)}`;
    // medium uses hash prefix medium_<hash> - hash changed; find by old hash
    const oldHash = path.basename(from, path.extname(from));
    const newHash = path.basename(to, path.extname(to));
    for (const prefix of ['medium_']) {
      for (const f of fs.readdirSync(UPLOADS)) {
        if (!f.startsWith(prefix)) continue;
        // medium_<oldFileHash>.ext where old file hash is last part of strapi hash
        // Our flatten files aren't in files table usually; covers are.
        if (f.includes(from.replace(path.extname(from), '')) || f === `medium_${from}`) {
          const destMed = f.replace(from, to);
          if (f !== destMed && fs.existsSync(path.join(UPLOADS, f))) {
            fs.renameSync(path.join(UPLOADS, f), path.join(UPLOADS, destMed));
          }
        }
      }
    }
    if (r.rowCount) filesUpdated += r.rowCount;
  }

  // refresh mapping
  const nextMap = {};
  for (const [rel, dest] of Object.entries(mapping)) {
    nextMap[rel] = renames.get(dest) || dest;
  }
  fs.writeFileSync(path.join(OUT, 'flatten-wp-content-mapping.json'), JSON.stringify(nextMap, null, 2));
}

const left = fs
  .readdirSync(UPLOADS)
  .filter((n) => fs.statSync(path.join(UPLOADS, n)).isFile() && isUgly(n));

const report = {
  dry: DRY,
  renamed,
  articlesUpdated,
  filesUpdated,
  remainingUgly: left.length,
  samples: [...renames.entries()].slice(0, 25),
  remainingSample: left.slice(0, 20),
};
fs.writeFileSync(path.join(OUT, 'fix-remaining-ugly-names.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await pool.end();
