#!/usr/bin/env node
/**
 * Generate missing formats.medium (750px) for old uploads.
 * Run in cms container: node /app/scripts/backfill-medium-formats.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import sharp from 'sharp';

const WIDTH = 750;

async function main() {
  const client = new pg.Client({
    host: process.env.DATABASE_HOST || 'postgres',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'topovik',
    user: process.env.DATABASE_USERNAME || process.env.POSTGRES_USER || 'topovik',
    password:
      process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'topovik',
  });
  await client.connect();

  const { rows } = await client.query(
    `SELECT id, url, hash, ext, mime, width, height, size, formats
     FROM files
     WHERE mime LIKE 'image/%'
       AND (formats IS NULL OR NOT (formats ? 'medium'))
     ORDER BY id`,
  );

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const file of rows) {
    if (file.mime === 'image/gif' || file.mime === 'image/svg+xml') {
      skip += 1;
      continue;
    }
    const rel = String(file.url || '').replace(/^\//, '');
    const abs = path.join(process.cwd(), 'public', rel);
    if (!fs.existsSync(abs)) {
      fail += 1;
      continue;
    }

    try {
      const meta = await sharp(abs, { animated: false }).metadata();
      const srcW = meta.width || Number(file.width) || 0;
      if (srcW && srcW <= WIDTH) {
        // Already small — point medium at original
        const formats = {
          ...(file.formats && typeof file.formats === 'object' ? file.formats : {}),
          medium: {
            ext: file.ext,
            url: file.url,
            hash: file.hash,
            mime: file.mime,
            name: path.basename(String(file.url)),
            path: null,
            size: Number(file.size) || 0,
            width: srcW,
            height: meta.height || Number(file.height) || 0,
          },
        };
        await client.query(`UPDATE files SET formats = $1::jsonb WHERE id = $2`, [
          JSON.stringify(formats),
          file.id,
        ]);
        ok += 1;
        continue;
      }

      const outName = `medium_${file.hash}${file.ext || '.jpg'}`;
      const outAbs = path.join(process.cwd(), 'public', 'uploads', outName);
      const out = await sharp(abs, { animated: false })
        .rotate()
        .resize({ width: WIDTH, withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true });
      fs.writeFileSync(outAbs, out.data);

      const formats = {
        ...(file.formats && typeof file.formats === 'object' ? file.formats : {}),
        medium: {
          ext: file.ext,
          url: `/uploads/${outName}`,
          hash: file.hash,
          mime: out.info.format === 'jpeg' ? 'image/jpeg' : file.mime,
          name: outName,
          path: null,
          size: Math.round((out.data.length / 1024) * 100) / 100,
          width: out.info.width,
          height: out.info.height,
        },
      };
      await client.query(`UPDATE files SET formats = $1::jsonb WHERE id = $2`, [
        JSON.stringify(formats),
        file.id,
      ]);
      ok += 1;
      if (ok % 50 === 0) console.log(`updated ${ok}…`);
    } catch (err) {
      fail += 1;
      console.warn(`fail ${file.url}: ${err?.message || err}`);
    }
  }

  console.log(JSON.stringify({ total: rows.length, ok, skip, fail }, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
