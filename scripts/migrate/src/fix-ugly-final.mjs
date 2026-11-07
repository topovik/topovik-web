import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const UPLOADS = path.join(ROOT, 'cms/public/uploads');
const OUT = path.join(ROOT, 'scripts/migrate/out');
const mapping = JSON.parse(
  fs.readFileSync(path.join(OUT, 'flatten-wp-content-mapping.json'), 'utf8')
);

const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function translit(s) {
  let o = '';
  for (const ch of s) {
    const l = ch.toLowerCase();
    if (TR[l] !== undefined) {
      const t = TR[l];
      o += ch === l ? t : t[0].toUpperCase() + t.slice(1);
    } else o += ch;
  }
  return o;
}

function slugify(stem) {
  const s = translit(stem)
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80);
  return (s.match(/[a-z]/g) || []).length >= 2 ? s : '';
}

function isUgly(name) {
  const stem = path.basename(name, path.extname(name));
  if (/^[-_]+/.test(stem) || /^_/.test(stem)) return true;
  if ((stem.match(/[-_]{2,}/g) || []).length >= 2) return true;
  const letters = (stem.match(/[A-Za-zА-Яа-я]/g) || []).length;
  const junk = (stem.match(/[-_]/g) || []).length;
  return (junk >= 4 && letters < 3) || (junk >= 6 && letters < junk);
}

const hashToRel = new Map();
for (const rel of Object.keys(mapping)) {
  hashToRel.set(crypto.createHash('md5').update(rel).digest('hex').slice(0, 10), rel);
}

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 5434,
  database: 'topovik',
  user: 'topovik',
  password: 'topovik',
});

const { rows: fileRows } = await pool.query('SELECT name, url FROM files');
const urlToName = new Map(fileRows.map((r) => [path.basename(r.url || ''), r.name]));

const used = new Set(
  fs.readdirSync(UPLOADS).filter((n) => fs.statSync(path.join(UPLOADS, n)).isFile())
);
const renames = new Map();

for (const name of [...used]) {
  if (!isUgly(name)) continue;
  const ext = path.extname(name).toLowerCase() || '.jpg';
  const stem = path.basename(name, path.extname(name));
  const hm = stem.match(/([a-f0-9]{10})$/i);
  const hash = hm
    ? hm[1].toLowerCase()
    : crypto.createHash('md5').update(name).digest('hex').slice(0, 10);

  let slug = '';
  const rel = hashToRel.get(hash);
  if (rel) slug = slugify(path.basename(rel, path.extname(rel)));
  if (!slug && urlToName.has(name)) {
    slug = slugify(path.basename(urlToName.get(name), path.extname(urlToName.get(name))));
  }
  if (!slug) {
    if (/^\d{5,}/.test(stem)) slug = 'photo';
    else {
      const nums = stem.match(/\d+/g);
      slug = nums?.length ? `image-${nums[nums.length - 1]}` : 'image';
    }
  }

  let next = `${slug}_${hash}${ext}`;
  let i = 2;
  while (used.has(next) && next !== name) {
    next = `${slug}-${i}_${hash}${ext}`;
    i += 1;
  }
  if (next === name) continue;
  fs.renameSync(path.join(UPLOADS, name), path.join(UPLOADS, next));
  used.delete(name);
  used.add(next);
  renames.set(name, next);
}

let articlesUpdated = 0;
const { rows } = await pool.query(
  `SELECT id, content FROM articles WHERE content LIKE '%/uploads/%'`
);
for (const row of rows) {
  let c = row.content;
  let ch = false;
  for (const [from, to] of renames) {
    if (c.includes(from)) {
      c = c.split(`/uploads/${from}`).join(`/uploads/${to}`);
      ch = true;
    }
  }
  if (ch) {
    await pool.query(`UPDATE articles SET content=$2, updated_at=NOW() WHERE id=$1`, [
      row.id,
      c,
    ]);
    articlesUpdated += 1;
  }
}

for (const [from, to] of renames) {
  await pool.query(`UPDATE files SET url=$2, updated_at=NOW() WHERE url=$1`, [
    `/uploads/${from}`,
    `/uploads/${to}`,
  ]);
}

const nextMap = {};
for (const [rel, dest] of Object.entries(mapping)) {
  nextMap[rel] = renames.get(dest) || dest;
}
fs.writeFileSync(path.join(OUT, 'flatten-wp-content-mapping.json'), JSON.stringify(nextMap, null, 2));

const left = [...used].filter(isUgly).sort();
console.log(
  JSON.stringify(
    {
      renamed: renames.size,
      articlesUpdated,
      remainingUgly: left.length,
      samples: [...renames.entries()].slice(0, 35),
      remaining: left.slice(0, 25),
    },
    null,
    2
  )
);
await pool.end();
