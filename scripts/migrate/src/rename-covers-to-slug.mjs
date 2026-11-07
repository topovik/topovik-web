/**
 * Rename article cover (and ogImage) media to `{slug}_{hash}{ext}`,
 * set alternative_text from article title, and fill empty markdown alts.
 *
 * Content-embedded /uploads images that are unique to one article document
 * can optionally be renamed with --rename-content.
 *
 * Usage:
 *   bun src/rename-covers-to-slug.mjs --dry-run
 *   bun src/rename-covers-to-slug.mjs
 *   bun src/rename-covers-to-slug.mjs --rename-content
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.join(__dirname, '../out');
const UPLOADS = path.join(ROOT, 'cms/public/uploads');
const DRY = process.argv.includes('--dry-run');
const RENAME_CONTENT = process.argv.includes('--rename-content');

fs.mkdirSync(OUT, { recursive: true });

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 5434),
  database: process.env.DATABASE_NAME || 'topovik',
  user: process.env.DATABASE_USERNAME || 'topovik',
  password: process.env.DATABASE_PASSWORD || 'topovik',
});

function extractHash10(stemOrHash) {
  const s = String(stemOrHash || '');
  const m = s.match(/_([a-f0-9]{10})$/i);
  if (m) return m[1].toLowerCase();
  if (/^[a-f0-9]{10}$/i.test(s)) return s.toLowerCase();
  return null;
}

function sanitizeSlug(slug) {
  const s = String(slug || '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 100);
  return s || 'article';
}

function altFromTitle(title) {
  return String(title || 'Image')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\[\]]/g, '')
    .trim()
    .slice(0, 250) || 'Image';
}

function diskFiles() {
  return new Set(
    fs.readdirSync(UPLOADS).filter((n) => {
      try {
        return fs.statSync(path.join(UPLOADS, n)).isFile();
      } catch {
        return false;
      }
    })
  );
}

function renameOnDisk(fromName, toName, used, stats) {
  if (fromName === toName) return true;
  const fromPath = path.join(UPLOADS, fromName);
  const toPath = path.join(UPLOADS, toName);
  if (!fs.existsSync(fromPath)) {
    stats.diskMissing.push(fromName);
    return false;
  }
  if (fs.existsSync(toPath) && fromName !== toName) {
    stats.diskConflicts.push({ from: fromName, to: toName });
    return false;
  }
  if (!DRY) {
    fs.renameSync(fromPath, toPath);
  }
  used.delete(fromName);
  used.add(toName);
  return true;
}

function updateFormatsMedium(formats, oldBase, newBase, newHash, newExt, newName) {
  if (!formats || typeof formats !== 'object') return null;
  const next = structuredClone(formats);
  const medium = next.medium;
  if (!medium || typeof medium !== 'object') return next;
  const oldUrl = medium.url || '';
  if (oldUrl.includes(oldBase) || oldUrl.includes(`/uploads/medium_`)) {
    medium.url = `/uploads/medium_${newHash}${newExt}`;
    medium.hash = `medium_${newHash}`;
    medium.name = `medium_${newName}`;
    if (medium.ext) medium.ext = newExt;
  }
  return next;
}

const used = diskFiles();
const stats = {
  dry: DRY,
  renameContent: RENAME_CONTENT,
  coversRenamed: 0,
  coversAlreadyOk: 0,
  coversAltSet: 0,
  ogImagesRenamed: 0,
  ogImagesAltSet: 0,
  contentFilesRenamed: 0,
  contentSharedSkipped: 0,
  markdownAltsFilled: 0,
  articlesContentUpdated: 0,
  diskMissing: [],
  diskConflicts: [],
  errors: [],
  samples: [],
  contentSamples: [],
  contentAlreadyOk: 0,
};

/** @type {Map<string, string>} old basename -> new basename */
const renames = new Map();

async function loadArticleMedia(field) {
  // Prefer published row when both draft+published exist for same document.
  const { rows } = await pool.query(
    `
    SELECT DISTINCT ON (f.id)
      f.id AS file_id,
      f.name AS file_name,
      f.hash AS file_hash,
      f.ext AS file_ext,
      f.url AS file_url,
      f.formats,
      f.alternative_text,
      a.id AS article_id,
      a.document_id,
      a.slug,
      a.title,
      fr.field,
      fr.related_type
    FROM files f
    JOIN files_related_mph fr ON fr.file_id = f.id
    JOIN articles a ON a.id = fr.related_id
    WHERE fr.field = $1
      AND (
        fr.related_type = 'api::article.article'
        OR fr.related_type LIKE '%seo%'
        OR fr.related_type = 'shared.seo'
      )
    ORDER BY f.id, (a.published_at IS NOT NULL) DESC, a.id
    `,
    [field]
  );
  return rows;
}

async function renameMediaRow(row, label) {
  const ext = (row.file_ext || path.extname(row.file_url || '') || '.jpg').toLowerCase();
  const oldUrl = row.file_url || '';
  const oldBase = path.basename(oldUrl);
  const oldStem = path.basename(oldBase, path.extname(oldBase));
  const hash10 =
    extractHash10(oldStem) ||
    extractHash10(row.file_hash) ||
    String(row.file_hash || '').slice(-10);

  if (!hash10 || hash10.length < 8) {
    stats.errors.push({ type: 'bad-hash', fileId: row.file_id, url: oldUrl });
    return null;
  }

  const slug = sanitizeSlug(row.slug);
  const newStem = `${slug}_${hash10}`;
  const newBase = `${newStem}${ext}`;
  const newUrl = `/uploads/${newBase}`;
  const alt = altFromTitle(row.title);
  const alreadyOk = oldBase === newBase;

  if (alreadyOk) {
    stats.coversAlreadyOk += label === 'cover' ? 1 : 0;
  } else {
    const ok = renameOnDisk(oldBase, newBase, used, stats);
    if (!ok) {
      stats.errors.push({ type: 'rename-failed', fileId: row.file_id, from: oldBase, to: newBase });
      // still try to set alt below if we couldn't rename
    } else {
      renames.set(oldBase, newBase);

      // medium_* companion on disk (formats.medium.hash = medium_<file.hash>)
      const oldHashFull = row.file_hash || oldStem;
      const mediumCandidates = [
        `medium_${oldHashFull}${ext}`,
        `medium_${oldStem}${ext}`,
        path.basename((row.formats?.medium?.url || '').replace(/^\/uploads\//, '')),
      ].filter(Boolean);

      const mediumSeen = new Set();
      for (const medFrom of mediumCandidates) {
        if (!medFrom || mediumSeen.has(medFrom)) continue;
        mediumSeen.add(medFrom);
        const medTo = `medium_${newStem}${ext}`;
        if (medFrom === medTo) continue;
        if (!used.has(medFrom) && !fs.existsSync(path.join(UPLOADS, medFrom))) continue;
        renameOnDisk(medFrom, medTo, used, stats);
      }

      if (label === 'cover') stats.coversRenamed += 1;
      else stats.ogImagesRenamed += 1;

      if (stats.samples.length < 25) {
        stats.samples.push({
          label,
          slug,
          from: oldBase,
          to: newBase,
          alt,
        });
      }
    }
  }

  const finalBase = renames.get(oldBase) || (alreadyOk ? oldBase : null);
  const formats = finalBase
    ? updateFormatsMedium(row.formats, oldBase, finalBase, newStem, ext, newBase)
    : row.formats;

  const needAlt = !row.alternative_text || row.alternative_text.trim() === '';
  const needDb =
    (finalBase && finalBase !== oldBase) ||
    needAlt ||
    (formats && JSON.stringify(formats) !== JSON.stringify(row.formats));

  if (needDb) {
    if (!DRY) {
      if (finalBase && finalBase !== oldBase) {
        await pool.query(
          `
          UPDATE files
          SET url = $2,
              name = $3,
              hash = $4,
              ext = $5,
              formats = $6::jsonb,
              alternative_text = COALESCE(NULLIF(TRIM(alternative_text), ''), $7),
              updated_at = NOW()
          WHERE id = $1
          `,
          [
            row.file_id,
            `/uploads/${finalBase}`,
            newBase,
            newStem,
            ext,
            formats ? JSON.stringify(formats) : null,
            alt,
          ]
        );
      } else if (needAlt) {
        await pool.query(
          `
          UPDATE files
          SET alternative_text = $2, updated_at = NOW()
          WHERE id = $1
            AND (alternative_text IS NULL OR TRIM(alternative_text) = '')
          `,
          [row.file_id, alt]
        );
      }
    }
    if (needAlt) {
      if (label === 'cover') stats.coversAltSet += 1;
      else stats.ogImagesAltSet += 1;
    }
  }

  return finalBase ? { oldBase, newBase: finalBase } : null;
}

// --- 1) Covers ---
const covers = await loadArticleMedia('cover');
for (const row of covers) {
  try {
    await renameMediaRow(row, 'cover');
  } catch (err) {
    stats.errors.push({ type: 'cover', fileId: row.file_id, error: String(err) });
  }
}

// --- 2) ogImage (SEO component), if any ---
const ogImages = await loadArticleMedia('ogImage');
// Also catch related_type variants that join via seo component id
if (ogImages.length === 0) {
  const { rows: viaSeo } = await pool.query(`
    SELECT DISTINCT ON (f.id)
      f.id AS file_id,
      f.name AS file_name,
      f.hash AS file_hash,
      f.ext AS file_ext,
      f.url AS file_url,
      f.formats,
      f.alternative_text,
      a.id AS article_id,
      a.document_id,
      a.slug,
      a.title,
      fr.field,
      fr.related_type
    FROM files f
    JOIN files_related_mph fr ON fr.file_id = f.id AND fr.field = 'ogImage'
    JOIN components_shared_seos seo ON seo.id = fr.related_id
    JOIN articles_cmps ac ON ac.cmp_id = seo.id AND ac.component_type = 'shared.seo' AND ac.field = 'seo'
    JOIN articles a ON a.id = ac.entity_id
    ORDER BY f.id, (a.published_at IS NOT NULL) DESC, a.id
  `);
  for (const row of viaSeo) {
    try {
      await renameMediaRow(row, 'ogImage');
    } catch (err) {
      stats.errors.push({ type: 'ogImage', fileId: row.file_id, error: String(err) });
    }
  }
} else {
  for (const row of ogImages) {
    try {
      await renameMediaRow(row, 'ogImage');
    } catch (err) {
      stats.errors.push({ type: 'ogImage', fileId: row.file_id, error: String(err) });
    }
  }
}

// Cover basenames (current) — never treat as content-only renames
const coverBasenames = new Set();
{
  const { rows: coverUrls } = await pool.query(`
    SELECT DISTINCT regexp_replace(f.url, '^/uploads/', '') AS basename
    FROM files f
    JOIN files_related_mph fr ON fr.file_id = f.id AND fr.field = 'cover'
  `);
  for (const r of coverUrls) {
    if (r.basename) coverBasenames.add(r.basename);
  }
}

// --- 3) Optional: rename content-only images unique to one document ---
if (RENAME_CONTENT) {
  // Prefer published row for slug; still scan all rows for shared-doc detection.
  const { rows: contentRefs } = await pool.query(`
    SELECT a.document_id, a.slug, a.title, a.published_at,
           m.cap[1] AS basename,
           m.ord
    FROM articles a,
    LATERAL regexp_matches(a.content, '/uploads/([^)"\\s]+)', 'g')
      WITH ORDINALITY AS m(cap, ord)
  `);

  /** @type {Map<string, { docs: Set<string>, slug: string, title: string, firstOrd: number }>} */
  const byFile = new Map();
  for (const r of contentRefs) {
    let entry = byFile.get(r.basename);
    if (!entry) {
      entry = {
        docs: new Set(),
        slug: r.slug,
        title: r.title,
        firstOrd: Number(r.ord) || 0,
        published: r.published_at != null,
      };
      byFile.set(r.basename, entry);
    }
    entry.docs.add(r.document_id);
    // Prefer published article's slug/title when available
    if (r.published_at != null && !entry.published) {
      entry.slug = r.slug;
      entry.title = r.title;
      entry.published = true;
      entry.firstOrd = Number(r.ord) || entry.firstOrd;
    } else if (r.published_at != null && entry.published) {
      entry.firstOrd = Math.min(entry.firstOrd, Number(r.ord) || entry.firstOrd);
    }
  }

  // Group unique-to-one-doc files by document for stable per-doc sequencing
  /** @type {Map<string, Array<{ basename: string, meta: any }>>} */
  const byDoc = new Map();
  for (const [basename, meta] of byFile) {
    if (meta.docs.size !== 1) {
      stats.contentSharedSkipped += 1;
      continue;
    }
    if (basename.startsWith('medium_')) continue;
    if (renames.has(basename)) continue;
    if (coverBasenames.has(basename)) continue;

    const docId = [...meta.docs][0];
    if (!byDoc.has(docId)) byDoc.set(docId, []);
    byDoc.get(docId).push({ basename, meta });
  }

  for (const [, items] of [...byDoc.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    items.sort((a, b) => a.meta.firstOrd - b.meta.firstOrd || a.basename.localeCompare(b.basename));
    let n = 0;
    for (const { basename, meta } of items) {
      const ext = path.extname(basename).toLowerCase() || '.jpg';
      const stem = path.basename(basename, path.extname(basename));
      const hash10 = extractHash10(stem);
      if (!hash10) continue;

      const slug = sanitizeSlug(meta.slug);
      // Already in target shape for this slug (+ optional -N)
      if (new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-\\d+)?_${hash10}\\.`, 'i').test(basename)) {
        stats.contentAlreadyOk += 1;
        continue;
      }

      n += 1;
      const newBase = `${slug}-${n}_${hash10}${ext}`;
      if (newBase === basename) {
        stats.contentAlreadyOk += 1;
        continue;
      }
      if (!used.has(basename) && !fs.existsSync(path.join(UPLOADS, basename))) {
        stats.diskMissing.push(basename);
        continue;
      }
      // Avoid colliding with an existing target; bump index
      let candidate = newBase;
      let bump = n;
      while (used.has(candidate) && candidate !== basename) {
        bump += 1;
        candidate = `${slug}-${bump}_${hash10}${ext}`;
      }
      n = bump;

      const ok = renameOnDisk(basename, candidate, used, stats);
      if (ok) {
        renames.set(basename, candidate);
        stats.contentFilesRenamed += 1;
        if (stats.contentSamples.length < 25) {
          stats.contentSamples.push({ from: basename, to: candidate, slug });
        }
      }
    }
  }
}

// --- 4) Rewrite article content URLs + fill empty markdown alts ---
const { rows: articles } = await pool.query(`
  SELECT id, document_id, title, content
  FROM articles
  WHERE content IS NOT NULL AND content LIKE '%/uploads/%'
`);

// Longer basenames first so shorter stems cannot partially clobber longer names
const renameList = [...renames.entries()].sort((a, b) => b[0].length - a[0].length);

for (const row of articles) {
  let c = row.content;
  let changed = false;
  const alt = altFromTitle(row.title);

  for (const [from, to] of renameList) {
    const needle = `/uploads/${from}`;
    if (!c.includes(needle)) continue;
    c = c.split(needle).join(`/uploads/${to}`);
    changed = true;
  }

  // Fill empty alts: ![](/uploads/...) or ![](url "title")
  const filled = c.replace(
    /!\[\]\((\/uploads\/[^)\s]+)(?:\s+"[^"]*")?\)/g,
    (full, url) => {
      changed = true;
      stats.markdownAltsFilled += 1;
      return `![${alt}](${url})`;
    }
  );
  c = filled;

  if (changed) {
    if (!DRY) {
      await pool.query(`UPDATE articles SET content = $2, updated_at = NOW() WHERE id = $1`, [
        row.id,
        c,
      ]);
    }
    stats.articlesContentUpdated += 1;
  }
}

// Ensure any remaining article-linked files without alt get a title
let leftoverAlts = 0;
if (!DRY) {
  const r = await pool.query(`
    WITH pick AS (
      SELECT DISTINCT ON (fr.file_id)
        fr.file_id,
        LEFT(a.title, 250) AS alt
      FROM files_related_mph fr
      JOIN articles a ON a.id = fr.related_id
      WHERE fr.related_type = 'api::article.article'
        AND a.title IS NOT NULL AND TRIM(a.title) <> ''
      ORDER BY fr.file_id, (a.published_at IS NOT NULL) DESC, a.id
    )
    UPDATE files f
    SET alternative_text = pick.alt, updated_at = NOW()
    FROM pick
    WHERE f.id = pick.file_id
      AND (f.alternative_text IS NULL OR TRIM(f.alternative_text) = '')
  `);
  leftoverAlts = r.rowCount || 0;
}
stats.leftoverAltsSet = leftoverAlts;

const reportPath = path.join(OUT, 'rename-covers-to-slug.json');
const report = {
  ...stats,
  diskMissing: stats.diskMissing.slice(0, 50),
  diskConflicts: stats.diskConflicts.slice(0, 50),
  errors: stats.errors.slice(0, 50),
  renameCount: renames.size,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await pool.end();
