/**
 * Keep Strapi uploads as original + medium only.
 * - Prefer higher-quality WP source for the original when same/better dimensions
 * - Regenerate medium @750px from the chosen original
 * - Drop thumbnail/small/large files and formats metadata
 *
 * Usage: bun src/cleanup-upload-formats.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import pg from 'pg';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(__dirname, '../out');
const UPLOADS = path.join(ROOT, 'cms/public/uploads');
const WP_UPLOADS = path.join(ROOT, 'old/wp-content/uploads');
const MEDIUM_WIDTH = 750;
const DRY = process.argv.includes('--dry-run');

const require = createRequire(path.join(ROOT, 'cms/package.json'));
const sharp = require('sharp');

fs.mkdirSync(OUT_DIR, { recursive: true });

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 5434),
  database: process.env.DATABASE_NAME || 'topovik',
  user: process.env.DATABASE_USERNAME || 'topovik',
  password: process.env.DATABASE_PASSWORD || 'topovik',
});

function identifyDims(filePath) {
  try {
    const out = execFileSync('identify', ['-format', '%wx%h\n', filePath], {
      encoding: 'utf8',
    });
    const line = out.trim().split(/\n/)[0] || '';
    const [w, h] = line.split('x').map((n) => Number(n));
    if (w > 0 && h > 0) return { width: w, height: h };
  } catch {
    /* ignore */
  }
  return { width: 0, height: 0 };
}

function indexWpByName() {
  const map = new Map();
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile()) {
        const prev = map.get(ent.name);
        const size = fs.statSync(full).size;
        if (!prev || size > prev.size) map.set(ent.name, { path: full, size });
      }
    }
  };
  walk(WP_UPLOADS);
  return map;
}

function isRaster(ext) {
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.tiff'].includes(
    ext.toLowerCase()
  );
}

function formatEntry({ url, hash, ext, mime, name, width, height, sizeBytes }) {
  return {
    ext,
    url,
    hash,
    mime,
    name,
    path: null,
    size: Math.round((sizeBytes / 1024) * 100) / 100,
    width,
    height,
    sizeInBytes: sizeBytes,
  };
}

async function makeMedium({ originalPath, hash, ext, mime, baseName }) {
  if (!isRaster(ext)) return null;
  const meta = await sharp(originalPath, { animated: false, pages: 1 }).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width < MEDIUM_WIDTH && height < MEDIUM_WIDTH) return null;

  const outName = `medium_${hash}${ext}`;
  const outPath = path.join(UPLOADS, outName);
  const outHash = `medium_${hash}`;

  // Prefer jpeg/webp quality retention; keep png as png
  let pipeline = sharp(originalPath, { animated: false, pages: 1 }).resize({
    width: MEDIUM_WIDTH,
    height: MEDIUM_WIDTH,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const lower = ext.toLowerCase();
  if (lower === '.jpg' || lower === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: 86, mozjpeg: true });
  } else if (lower === '.webp') {
    pipeline = pipeline.webp({ quality: 86 });
  } else if (lower === '.png') {
    pipeline = pipeline.png({ compressionLevel: 8 });
  } else if (lower === '.gif') {
    // Keep animated originals as-is; no static medium derivative.
    return null;
  }

  if (!DRY) await pipeline.toFile(outPath);
  const sizeBytes = DRY ? 0 : fs.statSync(outPath).size;
  const dims = DRY ? { width: Math.min(width, MEDIUM_WIDTH), height: 0 } : identifyDims(outPath);
  return formatEntry({
    url: `/uploads/${outName}`,
    hash: outHash,
    ext,
    mime,
    name: `medium_${baseName}`,
    width: dims.width || Math.min(width, MEDIUM_WIDTH),
    height: dims.height || 0,
    sizeBytes,
  });
}

function unlinkQuiet(filePath, report) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const size = fs.statSync(filePath).size;
    if (!DRY) fs.unlinkSync(filePath);
    report.deletedBytes += size;
    report.deletedFiles += 1;
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const wpIndex = indexWpByName();
  const { rows } = await pool.query(`
    SELECT id, name, hash, ext, mime, url, width, height, size, formats
    FROM files
    ORDER BY id
  `);

  const report = {
    dry: DRY,
    total: rows.length,
    originalsReplaced: 0,
    mediumKeptOrCreated: 0,
    mediumSkipped: 0,
    deletedFiles: 0,
    deletedBytes: 0,
    errors: [],
  };

  const diskNames = new Set(fs.readdirSync(UPLOADS));

  for (const row of rows) {
    try {
      const ext = row.ext || path.extname(row.name) || '';
      const originalName = path.basename(row.url || '');
      const originalPath = path.join(UPLOADS, originalName);
      if (!fs.existsSync(originalPath)) {
        report.errors.push(`missing original on disk: ${originalName}`);
        continue;
      }

      // 1) Prefer better WP source as original (same basename as Media Library name)
      const wp = wpIndex.get(row.name);
      let chosenPath = originalPath;
      let width = Number(row.width) || 0;
      let height = Number(row.height) || 0;
      let sizeKb = Number(row.size) || 0;

      if (wp) {
        const sStat = fs.statSync(originalPath);
        const sDims =
          width && height ? { width, height } : identifyDims(originalPath);
        const wDims = identifyDims(wp.path);
        const sPix = (sDims.width || 0) * (sDims.height || 0);
        const wPix = (wDims.width || 0) * (wDims.height || 0);
        const wpBetter =
          wPix > sPix || (wPix === sPix && wp.size > sStat.size * 1.05);

        if (wpBetter) {
          if (!DRY) fs.copyFileSync(wp.path, originalPath);
          chosenPath = originalPath;
          width = wDims.width || width;
          height = wDims.height || height;
          sizeKb = Math.round((wp.size / 1024) * 100) / 100;
          report.originalsReplaced += 1;
        } else if (!width || !height) {
          width = sDims.width;
          height = sDims.height;
          sizeKb = Math.round((sStat.size / 1024) * 100) / 100;
        }
      } else if (!width || !height) {
        const d = identifyDims(originalPath);
        width = d.width;
        height = d.height;
        sizeKb = Math.round((fs.statSync(originalPath).size / 1024) * 100) / 100;
      }

      // 2) Delete old responsive files (thumbnail/small/medium/large) before rewrite
      const oldFormats = row.formats && typeof row.formats === 'object' ? row.formats : {};
      for (const key of Object.keys(oldFormats)) {
        const u = oldFormats[key]?.url;
        if (!u) continue;
        const base = path.basename(u);
        const fp = path.join(UPLOADS, base);
        if (unlinkQuiet(fp, report)) diskNames.delete(base);
      }

      // Sweep orphaned prefixes for this hash (before regenerating medium)
      for (const prefix of ['thumbnail', 'small', 'medium', 'large']) {
        const stem = `${prefix}_${row.hash}.`;
        for (const candidate of [...diskNames]) {
          if (!candidate.startsWith(stem)) continue;
          const fp = path.join(UPLOADS, candidate);
          if (unlinkQuiet(fp, report)) diskNames.delete(candidate);
        }
      }

      // 3) Create medium from chosen original
      let medium = null;
      try {
        medium = await makeMedium({
          originalPath: chosenPath,
          hash: row.hash,
          ext,
          mime: row.mime,
          baseName: row.name,
        });
        if (medium && !DRY) {
          diskNames.add(path.basename(medium.url));
        }
      } catch (err) {
        report.errors.push(`medium ${row.id} ${row.name}: ${err.message}`);
      }

      const formats = medium ? { medium } : null;
      if (medium) report.mediumKeptOrCreated += 1;
      else report.mediumSkipped += 1;

      if (!DRY) {
        await pool.query(
          `UPDATE files
           SET width = $2,
               height = $3,
               size = $4,
               formats = $5::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [
            row.id,
            width || null,
            height || null,
            sizeKb,
            formats ? JSON.stringify(formats) : null,
          ]
        );
      }
    } catch (err) {
      report.errors.push(`file ${row.id}: ${err.message}`);
    }
  }

  // 4) Final sweep: any leftover thumb/small/large not tied to current formats
  for (const name of fs.readdirSync(UPLOADS)) {
    if (!/^(thumbnail|small|large)_/.test(name)) continue;
    const fp = path.join(UPLOADS, name);
    if (!fs.statSync(fp).isFile()) continue;
    unlinkQuiet(fp, report);
  }

  report.deletedMB = Math.round((report.deletedBytes / 1024 / 1024) * 10) / 10;
  const outPath = path.join(OUT_DIR, 'cleanup-upload-formats.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${outPath}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
