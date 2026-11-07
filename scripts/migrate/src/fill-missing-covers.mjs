/**
 * For articles without cover: take the first content /uploads image,
 * register it in Strapi files (with medium derivative), and link as cover.
 *
 *   bun src/fill-missing-covers.mjs --dry-run
 *   bun src/fill-missing-covers.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const require = createRequire(import.meta.url);
const sharp = require(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../cms/node_modules/sharp'
));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const UPLOADS = path.join(ROOT, 'cms/public/uploads');
const DRY = process.argv.includes('--dry-run');
const MEDIUM_WIDTH = 750;

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 5434),
  database: process.env.DATABASE_NAME || 'topovik',
  user: process.env.DATABASE_USERNAME || 'topovik',
  password: process.env.DATABASE_PASSWORD || 'topovik',
});

function docId() {
  return crypto.randomBytes(16).toString('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 24);
}

function mimeForExt(ext) {
  const e = ext.toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

function firstContentImage(content) {
  const md = [...String(content || '').matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)];
  for (const m of md) {
    const url = m[1];
    if (!url.includes('/uploads/')) continue;
    let p = url.slice(url.indexOf('/uploads/')).split('?')[0];
    const base = path.basename(p);
    if (/^(medium|thumbnail|small|large)_/i.test(base)) continue;
    if (!/\.(jpe?g|png|webp|gif)$/i.test(base)) continue;
    return `/uploads/${base}`;
  }
  for (const m of String(content || '').matchAll(/\/uploads\/([A-Za-z0-9._-]+\.(?:jpe?g|png|webp|gif))/gi)) {
    const base = m[1];
    if (/^(medium|thumbnail|small|large)_/i.test(base)) continue;
    return `/uploads/${base}`;
  }
  return null;
}

async function ensureMedium(absPath, hash, ext, mime, width, height) {
  if (ext.toLowerCase() === '.gif') return null;
  if (width < MEDIUM_WIDTH && height < MEDIUM_WIDTH) return null;

  const outName = `medium_${hash}${ext}`;
  const outPath = path.join(UPLOADS, outName);
  if (!fs.existsSync(outPath) && !DRY) {
    let pipeline = sharp(absPath, { animated: false, pages: 1 }).resize({
      width: MEDIUM_WIDTH,
      height: MEDIUM_WIDTH,
      fit: 'inside',
      withoutEnlargement: true,
    });
    const lower = ext.toLowerCase();
    if (lower === '.jpg' || lower === '.jpeg') pipeline = pipeline.jpeg({ quality: 86, mozjpeg: true });
    else if (lower === '.webp') pipeline = pipeline.webp({ quality: 86 });
    else if (lower === '.png') pipeline = pipeline.png({ compressionLevel: 8 });
    else return null;
    await pipeline.toFile(outPath);
  }
  if (!fs.existsSync(outPath) && !DRY) return null;

  const meta = DRY && !fs.existsSync(outPath)
    ? { width: Math.min(width, MEDIUM_WIDTH), height: Math.round((Math.min(width, MEDIUM_WIDTH) / width) * height), size: 0 }
    : await sharp(outPath).metadata().then(async (m) => ({
        width: m.width || 0,
        height: m.height || 0,
        size: fs.statSync(outPath).size,
      }));

  return {
    ext,
    url: `/uploads/${outName}`,
    hash: `medium_${hash}`,
    mime,
    name: outName,
    path: null,
    size: Number((meta.size / 1024).toFixed(2)),
    width: meta.width,
    height: meta.height,
  };
}

async function ensureFileRecord(url, alt) {
  const { rows } = await pool.query(`SELECT id FROM files WHERE url = $1 LIMIT 1`, [url]);
  if (rows[0]) return rows[0].id;

  const base = path.basename(url);
  const abs = path.join(UPLOADS, base);
  if (!fs.existsSync(abs)) return null;

  const ext = path.extname(base);
  const hash = base.slice(0, -ext.length);
  const mime = mimeForExt(ext);
  const stat = fs.statSync(abs);
  const meta = await sharp(abs).metadata();
  const width = meta.width || null;
  const height = meta.height || null;
  const formatsMedium = await ensureMedium(abs, hash, ext, mime, width || 0, height || 0);
  const formats = formatsMedium ? { medium: formatsMedium } : null;
  const now = new Date();

  if (DRY) {
    console.log(`  [dry] would create file ${url}`);
    return -1;
  }

  const { rows: inserted } = await pool.query(
    `INSERT INTO files (
      document_id, name, alternative_text, width, height, formats, hash, ext, mime,
      size, url, provider, folder_path, created_at, updated_at, published_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,'local','/1',$12,$12,$12
    ) RETURNING id`,
    [
      docId(),
      base,
      alt || null,
      width,
      height,
      formats ? JSON.stringify(formats) : null,
      hash,
      ext,
      mime,
      Number((stat.size / 1024).toFixed(2)),
      url,
      now,
    ]
  );
  const fileId = inserted[0].id;
  await pool.query(
    `INSERT INTO files_folder_lnk (file_id, folder_id, file_ord)
     VALUES ($1, 1, $2)
     ON CONFLICT (file_id, folder_id) DO NOTHING`,
    [fileId, fileId]
  );
  return fileId;
}

async function linkCover(articleId, fileId) {
  const { rows } = await pool.query(
    `SELECT id FROM files_related_mph
     WHERE related_id = $1 AND related_type = 'api::article.article' AND field = 'cover'
     LIMIT 1`,
    [articleId]
  );
  if (rows[0]) return false;
  if (DRY) return true;
  await pool.query(
    `INSERT INTO files_related_mph (file_id, related_id, related_type, field, "order")
     VALUES ($1, $2, 'api::article.article', 'cover', 1)`,
    [fileId, articleId]
  );
  return true;
}

async function main() {
  const { rows } = await pool.query(`
    SELECT a.id, a.document_id, a.title, a.content, a.published_at
    FROM articles a
    LEFT JOIN files_related_mph fr
      ON fr.related_id = a.id
     AND fr.field = 'cover'
     AND fr.related_type = 'api::article.article'
    WHERE fr.id IS NULL
    ORDER BY a.document_id, a.published_at DESC NULLS LAST
  `);

  const byDoc = new Map();
  for (const row of rows) {
    if (!byDoc.has(row.document_id)) byDoc.set(row.document_id, []);
    byDoc.get(row.document_id).push(row);
  }

  const report = {
    dry: DRY,
    docsMissingCover: byDoc.size,
    filled: 0,
    skippedNoImage: 0,
    skippedMissingFile: 0,
    errors: [],
    samples: [],
  };

  for (const [documentId, versions] of byDoc) {
    try {
      const preferred =
        versions.find((v) => v.published_at && firstContentImage(v.content)) ||
        versions.find((v) => firstContentImage(v.content)) ||
        versions[0];
      const img = firstContentImage(preferred.content);
      if (!img) {
        report.skippedNoImage += 1;
        continue;
      }
      const abs = path.join(UPLOADS, path.basename(img));
      if (!fs.existsSync(abs)) {
        report.skippedMissingFile += 1;
        report.errors.push({ documentId, title: preferred.title, img, reason: 'not on disk' });
        continue;
      }

      const fileId = await ensureFileRecord(img, preferred.title);
      if (!fileId) {
        report.skippedMissingFile += 1;
        continue;
      }

      let linked = 0;
      for (const v of versions) {
        if (await linkCover(v.id, fileId === -1 ? 0 : fileId)) linked += 1;
      }
      if (linked || DRY) {
        report.filled += 1;
        if (report.samples.length < 12) {
          report.samples.push({
            title: preferred.title,
            img,
            versions: versions.length,
            published: versions.some((v) => v.published_at),
          });
        }
      }
    } catch (err) {
      report.errors.push({ documentId, error: String(err) });
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
