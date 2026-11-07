import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(__dirname, '../out');

const STRAPI_URL = (process.env.STRAPI_URL || 'http://127.0.0.1:1337').replace(/\/$/, '');
const API_TOKEN =
  process.env.STRAPI_TOKEN ||
  fs.readFileSync(path.join(__dirname, '../.api-token'), 'utf8').trim();

const UPLOADS_SRC = process.env.UPLOADS_SRC || path.join(ROOT, 'old/wp-content/uploads');
const UPLOADS_DST =
  process.env.UPLOADS_DST || path.join(ROOT, 'cms/public/uploads/wp-content/uploads');

const MYSQL = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'wordpress',
};

const COPY_MODE = process.env.MEDIA_COPY_MODE || 'link'; // link | copy | skip-files

fs.mkdirSync(OUT_DIR, { recursive: true });

async function strapi(method, route, body, isForm = false) {
  const headers = { Authorization: `Bearer ${API_TOKEN}` };
  let payload = body;
  if (!isForm) {
    headers['Content-Type'] = 'application/json';
    payload = body ? JSON.stringify(body) : undefined;
  }
  const res = await fetch(`${STRAPI_URL}${route}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${route} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${route} -> ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function mirrorTree(src, dst) {
  if (!fs.existsSync(src)) {
    throw new Error(`Uploads source missing: ${src}`);
  }
  ensureDir(path.dirname(dst));
  if (fs.existsSync(dst)) {
    console.log(`Destination exists, skipping tree mirror: ${dst}`);
    return { skipped: true };
  }

  if (COPY_MODE === 'skip-files') {
    console.log('MEDIA_COPY_MODE=skip-files — not mirroring files');
    return { skipped: true };
  }

  if (COPY_MODE === 'link') {
    try {
      fs.symlinkSync(src, dst, 'dir');
      console.log(`Symlinked ${src} -> ${dst}`);
      return { linked: true };
    } catch (err) {
      console.warn(`Symlink failed (${err.message}), falling back to copy`);
    }
  }

  // recursive copy (may take long for 3GB)
  fs.cpSync(src, dst, { recursive: true, force: false, errorOnExist: false });
  console.log(`Copied uploads tree to ${dst}`);
  return { copied: true };
}

async function findArticleByLegacy(legacyWpId) {
  const q = new URLSearchParams({
    'filters[legacyWpId][$eq]': String(legacyWpId),
    'pagination[pageSize]': '1',
  });
  const json = await strapi('GET', `/api/articles?${q}`);
  return json.data?.[0] || null;
}

async function uploadFile(absPath) {
  const buf = fs.readFileSync(absPath);
  const blob = new Blob([buf]);
  const form = new FormData();
  form.append('files', blob, path.basename(absPath));
  return strapi('POST', '/api/upload', form, true);
}

async function main() {
  const mirror = mirrorTree(UPLOADS_SRC, UPLOADS_DST);
  const report = { mirror, covers: 0, missing: [], errors: [] };

  console.log('Connecting MySQL for thumbnails...');
  const conn = await mysql.createConnection(MYSQL);

  const [rows] = await conn.query(`
    SELECT p.ID AS post_id, pm.meta_value AS thumb_id, fm.meta_value AS attached_file
    FROM wp_posts p
    JOIN wp_postmeta pm ON pm.post_id = p.ID AND pm.meta_key = '_thumbnail_id'
    LEFT JOIN wp_postmeta fm ON fm.post_id = pm.meta_value AND fm.meta_key = '_wp_attached_file'
    WHERE p.post_type = 'post' AND p.post_status IN ('publish','draft','pending')
  `);

  for (const row of rows) {
    try {
      if (!row.attached_file) {
        report.missing.push({ postId: row.post_id, reason: 'no attached_file' });
        continue;
      }

      const abs = path.join(UPLOADS_SRC, row.attached_file);
      if (!fs.existsSync(abs)) {
        report.missing.push({ postId: row.post_id, file: row.attached_file });
        continue;
      }

      const article = await findArticleByLegacy(row.post_id);
      if (!article) {
        report.missing.push({ postId: row.post_id, reason: 'article not in Strapi' });
        continue;
      }

      // Skip if cover already set
      const detailed = await strapi(
        'GET',
        `/api/articles/${article.documentId}?populate=cover`
      );
      if (detailed.data?.cover) {
        continue;
      }

      const uploaded = await uploadFile(abs);
      const fileId = uploaded[0]?.id;
      if (!fileId) {
        report.errors.push(`upload failed for post ${row.post_id}`);
        continue;
      }

      await strapi('PUT', `/api/articles/${article.documentId}`, {
        data: { cover: fileId },
      });
      report.covers += 1;
      if (report.covers % 20 === 0) console.log(`  covers: ${report.covers}`);
    } catch (err) {
      report.errors.push(`post ${row.post_id}: ${err.message}`);
    }
  }

  await conn.end();
  fs.writeFileSync(path.join(OUT_DIR, 'media-report.json'), JSON.stringify(report, null, 2));
  console.log('Media done:', {
    covers: report.covers,
    missing: report.missing.length,
    errors: report.errors.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
