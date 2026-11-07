import fs from 'node:fs';
import path from 'node:path';
import type { Core } from '@strapi/strapi';

type UploadFile = {
  id?: number;
  url?: string;
  mime?: string;
  provider_metadata?: Record<string, unknown> | null;
};

/** Tiny LQIP for next/image blurDataURL (generated once at upload). */
export async function buildBlurPlaceholder(filePath: string): Promise<string | null> {
  try {
    // sharp is a transitive dep of @strapi/strapi / upload pipeline
    const sharp = (await import('sharp')).default;
    const buf = await sharp(filePath, { animated: false })
      .rotate()
      .resize(16, 16, { fit: 'inside' })
      .jpeg({ quality: 40, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function uploadsPath(strapi: Core.Strapi, fileUrl?: string) {
  if (!fileUrl) return null;
  const rel = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
  return path.join(strapi.dirs.static.public, rel);
}

export async function ensureFilePlaceholder(
  strapi: Core.Strapi,
  file: UploadFile | null | undefined,
) {
  if (!file?.id || !file.url) return;
  if (!file.mime?.startsWith('image/')) return;

  const existing = file.provider_metadata?.placeholder;
  if (typeof existing === 'string' && existing.startsWith('data:image/')) return;

  const abs = uploadsPath(strapi, file.url);
  if (!abs || !fs.existsSync(abs)) return;

  const placeholder = await buildBlurPlaceholder(abs);
  if (!placeholder) return;

  const provider_metadata = {
    ...(file.provider_metadata && typeof file.provider_metadata === 'object'
      ? file.provider_metadata
      : {}),
    placeholder,
  };

  await strapi.db.query('plugin::upload.file').update({
    where: { id: file.id },
    data: { provider_metadata },
  });
}
