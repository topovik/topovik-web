/**
 * Move referenced WP media into cms/public/uploads root and rewrite article HTML/MD.
 * Then remove cms/public/uploads/wp-content symlink.
 *
 * Usage: bun src/flatten-wp-content.mjs [--dry-run]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(__dirname, '../out');
const UPLOADS = path.join(ROOT, 'cms/public/uploads');
const WP_UPLOADS = path.join(ROOT, 'old/wp-content/uploads');
const WP_LINK = path.join(UPLOADS, 'wp-content');
const DRY = process.argv.includes('--dry-run');

fs.mkdirSync(OUT_DIR, { recursive: true });

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 5434),
  database: process.env.DATABASE_NAME || 'topovik',
  user: process.env.DATABASE_USERNAME || 'topovik',
  password: process.env.DATABASE_PASSWORD || 'topovik',
});

/** Match any wp-content/uploads/... path variant in content. */
const WP_PATH_RE =
  /(?:https?:\/\/(?:www\.)?topovik\.com)?(?:\/uploads)?\/wp-content\/uploads\/([^\s"'\\)<>]+)/gi;

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

function sanitizeBase(name) {
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  const clean =
    translit(stem)
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 100) || 'file';
  return { stem: clean, ext: ext.toLowerCase() || '' };
}

function targetName(relPath) {
  const base = path.basename(relPath.split('?')[0].split('#')[0]);
  const { stem, ext } = sanitizeBase(base);
  const hash = crypto.createHash('md5').update(relPath).digest('hex').slice(0, 10);
  return `${stem}_${hash}${ext}`;
}

function collectRefs(text) {
  const found = new Set();
  if (!text) return found;
  for (const m of text.matchAll(WP_PATH_RE)) {
    let rel = m[1] || '';
    rel = rel.replace(/\\/g, '').split('?')[0].split('#')[0];
    // trim trailing punctuation that sometimes sticks to markdown
    rel = rel.replace(/[.,;:!?]+$/, '');
    if (rel) found.add(rel);
  }
  return found;
}

function rewriteContent(text, mapping) {
  if (!text) return text;
  return text.replace(WP_PATH_RE, (full, relRaw) => {
    let rel = (relRaw || '').replace(/\\/g, '').split('?')[0].split('#')[0];
    rel = rel.replace(/[.,;:!?]+$/, '');
    const dest = mapping.get(rel);
    if (!dest) return full;
    return `/uploads/${dest}`;
  });
}

async function main() {
  const report = {
    dry: DRY,
    uniqueRefs: 0,
    copied: 0,
    alreadyPresent: 0,
    missing: [],
    articlesUpdated: 0,
    bytesCopied: 0,
    errors: [],
  };

  const { rows } = await pool.query(
    `SELECT id, content FROM articles WHERE content LIKE '%wp-content/uploads%'`
  );

  const allRefs = new Set();
  for (const row of rows) {
    for (const r of collectRefs(row.content)) allRefs.add(r);
  }
  report.uniqueRefs = allRefs.size;

  /** relPath -> dest filename */
  const mapping = new Map();
  const usedDest = new Set(fs.readdirSync(UPLOADS).filter((n) => n !== 'wp-content'));

  for (const rel of [...allRefs].sort()) {
    const dest = targetName(rel);
    const src = path.join(WP_UPLOADS, rel);
    const dst = path.join(UPLOADS, dest);

    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      report.missing.push(rel);
      continue;
    }

    mapping.set(rel, dest);

    if (fs.existsSync(dst)) {
      report.alreadyPresent += 1;
      usedDest.add(dest);
      continue;
    }

    const size = fs.statSync(src).size;
    if (!DRY) {
      fs.copyFileSync(src, dst);
      usedDest.add(dest);
    }
    report.copied += 1;
    report.bytesCopied += size;
  }

  // Rewrite articles
  for (const row of rows) {
    const next = rewriteContent(row.content, mapping);
    if (next === row.content) continue;
    // Only update if at least one mapped path was rewritten, or leave missing as-is
    if (!DRY) {
      await pool.query(`UPDATE articles SET content = $2, updated_at = NOW() WHERE id = $1`, [
        row.id,
        next,
      ]);
    }
    report.articlesUpdated += 1;
  }

  // Remove wp-content symlink/dir from cms uploads
  if (!DRY && fs.existsSync(WP_LINK)) {
    const st = fs.lstatSync(WP_LINK);
    if (st.isSymbolicLink() || st.isDirectory()) {
      fs.rmSync(WP_LINK, { recursive: true, force: true });
      report.removedWpContentLink = true;
    }
  } else if (DRY && fs.existsSync(WP_LINK)) {
    report.removedWpContentLink = 'would-remove';
  }

  // Remaining refs check (sample)
  if (!DRY) {
    const { rows: left } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM articles WHERE content LIKE '%wp-content/uploads%'`
    );
    report.articlesStillWithWp = left[0]?.n ?? null;
  }

  report.copiedMB = Math.round((report.bytesCopied / 1024 / 1024) * 10) / 10;
  report.missingCount = report.missing.length;

  const outPath = path.join(OUT_DIR, 'flatten-wp-content.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        ...report,
        missingSample: report.missing.slice(0, 40),
        mappingSample: [...mapping.entries()].slice(0, 20),
      },
      null,
      2
    )
  );
  // full mapping for debugging
  fs.writeFileSync(
    path.join(OUT_DIR, 'flatten-wp-content-mapping.json'),
    JSON.stringify(Object.fromEntries(mapping), null, 2)
  );

  console.log(
    JSON.stringify(
      {
        ...report,
        missing: report.missing.slice(0, 15),
      },
      null,
      2
    )
  );
  console.log(`Report: ${outPath}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
