/**
 * Restore readable latinized names for files mangled by sanitize (Cyrillic → _).
 * Uses flatten-wp-content-mapping.json (+ optional fallback map).
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
    } else {
      out += ch;
    }
  }
  return out;
}

function niceName(relPath, hash) {
  const base = path.basename(relPath.split('?')[0].split('#')[0]);
  const ext = path.extname(base).toLowerCase() || '.jpg';
  let stem = path.basename(base, path.extname(base));
  stem = translit(stem)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
  if (!stem || /^[_-]+$/.test(stem)) stem = 'image';
  return `${stem}_${hash}${ext}`;
}

function isUgly(name) {
  const stem = name.replace(/\.[^.]+$/, '');
  // mostly punctuation/underscores, or starts with _-/
  const letters = (stem.match(/[A-Za-zА-Яа-я0-9]/g) || []).length;
  const junk = (stem.match(/[_-]/g) || []).length;
  return stem.startsWith('_') || stem.startsWith('-') || (junk >= 6 && letters < junk);
}

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 5434),
  database: process.env.DATABASE_NAME || 'topovik',
  user: process.env.DATABASE_USERNAME || 'topovik',
  password: process.env.DATABASE_PASSWORD || 'topovik',
});

const mappingPath = path.join(OUT, 'flatten-wp-content-mapping.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

/** oldDest -> newDest */
const renames = new Map();
const used = new Set(fs.readdirSync(UPLOADS).filter((n) => {
  const p = path.join(UPLOADS, n);
  return fs.statSync(p).isFile();
}));

let renamed = 0;
let skipped = 0;

for (const [rel, oldDest] of Object.entries(mapping)) {
  if (!isUgly(oldDest)) {
    skipped += 1;
    continue;
  }
  const oldPath = path.join(UPLOADS, oldDest);
  if (!fs.existsSync(oldPath)) {
    skipped += 1;
    continue;
  }
  const hash = crypto.createHash('md5').update(rel).digest('hex').slice(0, 10);
  let next = niceName(rel, hash);
  // ensure unique
  if (used.has(next) && next !== oldDest) {
    next = niceName(rel, hash + 'x');
  }
  if (next === oldDest) {
    skipped += 1;
    continue;
  }
  renames.set(oldDest, next);
  if (!DRY) {
    fs.renameSync(oldPath, path.join(UPLOADS, next));
  }
  used.delete(oldDest);
  used.add(next);
  renamed += 1;
}

// Rewrite article contents
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
      await pool.query(`UPDATE articles SET content = $2, updated_at = NOW() WHERE id = $1`, [
        row.id,
        c,
      ]);
    }
    articlesUpdated += 1;
  }
}

const report = {
  dry: DRY,
  renamed,
  skipped,
  articlesUpdated,
  samples: [...renames.entries()].slice(0, 20),
};
fs.writeFileSync(path.join(OUT, 'rename-ugly-uploads.json'), JSON.stringify(report, null, 2));
// update mapping file to new dests
if (!DRY) {
  const nextMap = {};
  for (const [rel, oldDest] of Object.entries(mapping)) {
    nextMap[rel] = renames.get(oldDest) || oldDest;
  }
  fs.writeFileSync(mappingPath, JSON.stringify(nextMap, null, 2));
}
console.log(JSON.stringify({ ...report, samples: report.samples }, null, 2));
await pool.end();
