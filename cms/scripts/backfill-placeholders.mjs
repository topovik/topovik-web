#!/usr/bin/env node
/**
 * Fill provider_metadata.placeholder for existing images (no full Strapi boot).
 * Env: DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD (compose defaults work in cms container).
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import sharp from 'sharp';

const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');

async function buildBlurPlaceholder(filePath) {
  const buf = await sharp(filePath, { animated: false })
    .rotate()
    .resize(16, 16, { fit: 'inside' })
    .jpeg({ quality: 40, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

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
    `SELECT id, url, provider_metadata
     FROM files
     WHERE mime LIKE 'image/%'
     ORDER BY id`,
  );

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const file of rows) {
    const meta =
      file.provider_metadata && typeof file.provider_metadata === 'object'
        ? file.provider_metadata
        : {};
    if (
      typeof meta.placeholder === 'string' &&
      meta.placeholder.startsWith('data:image/')
    ) {
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
      const placeholder = await buildBlurPlaceholder(abs);
      const nextMeta = { ...meta, placeholder };
      await client.query(
        `UPDATE files SET provider_metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(nextMeta), file.id],
      );
      ok += 1;
      if (ok % 100 === 0) console.log(`updated ${ok}…`);
    } catch (err) {
      fail += 1;
      console.warn(`fail ${file.url}: ${err?.message || err}`);
    }
  }

  console.log(JSON.stringify({ total: rows.length, ok, skip, fail, uploadsRoot }, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
