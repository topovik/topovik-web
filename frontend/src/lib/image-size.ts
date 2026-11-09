import { cacheLife } from "next/cache";
import { STRAPI_URL } from "@/lib/config";

/** Read width/height from PNG / JPEG / WebP headers (first 64 KiB). */
export function probeImageSize(
  buf: Uint8Array,
): { width: number; height: number } | null {
  if (buf.length < 24) return null;

  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    const width = readU32(buf, 16);
    const height = readU32(buf, 20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const len = readU16(buf, i + 2);
      if (len < 2) break;
      // SOF0 / SOF1 / SOF2
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const height = readU16(buf, i + 5);
        const width = readU16(buf, i + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      i += 2 + len;
    }
    return null;
  }

  // WebP (RIFF .... WEBP)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    const chunk = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (chunk === "VP8X" && buf.length >= 30) {
      const width = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
      const height = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunk === "VP8 " && buf.length >= 30) {
      const width = readU16LE(buf, 26) & 0x3fff;
      const height = readU16LE(buf, 28) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunk === "VP8L" && buf.length >= 25) {
      const bits = readU32LE(buf, 21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return width > 0 && height > 0 ? { width, height } : null;
    }
  }

  return null;
}

function readU16(buf: Uint8Array, offset: number) {
  return (buf[offset] << 8) | buf[offset + 1];
}

function readU16LE(buf: Uint8Array, offset: number) {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readU32(buf: Uint8Array, offset: number) {
  return (
    ((buf[offset] << 24) |
      (buf[offset + 1] << 16) |
      (buf[offset + 2] << 8) |
      buf[offset + 3]) >>>
    0
  );
}

function readU32LE(buf: Uint8Array, offset: number) {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  );
}

/** Paths like `/uploads/foo.jpg` from markdown / HTML. */
export function extractUploadPaths(content: string): string[] {
  const found = new Set<string>();
  const re = /\/uploads\/[A-Za-z0-9._/-]+\.(?:jpe?g|png|webp|gif)/gi;
  for (const match of content.matchAll(re)) {
    found.add(match[0].split("?")[0]);
  }
  return [...found];
}

function absoluteUploadUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${STRAPI_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Read at most `limit` bytes (Range often ignored by CDNs / proxies). */
async function readPrefix(url: string, limit = 65536): Promise<Uint8Array | null> {
  const res = await fetch(url, {
    headers: { Range: `bytes=0-${limit - 1}` },
  });
  if (!res.ok && res.status !== 206) return null;

  if (!res.body) {
    const full = new Uint8Array(await res.arrayBuffer());
    return full.byteLength > limit ? full.subarray(0, limit) : full;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < limit) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      received += value.byteLength;
      if (received >= limit) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const out = new Uint8Array(Math.min(received, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, out.byteLength - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= out.byteLength) break;
  }
  return out;
}

/**
 * Resolve intrinsic sizes for CMS uploads so <img width/height> can reserve
 * layout before bytes arrive (CLS). Cached aggressively — headers only.
 */
export async function resolveUploadDimensions(
  content: string,
): Promise<Record<string, { width: number; height: number }>> {
  "use cache";
  cacheLife("max");

  const paths = extractUploadPaths(content);
  if (!paths.length) return {};

  const entries = await Promise.all(
    paths.map(async (path) => {
      try {
        const buf = await readPrefix(absoluteUploadUrl(path));
        if (!buf) return null;
        const size = probeImageSize(buf);
        return size ? ([path, size] as const) : null;
      } catch {
        return null;
      }
    }),
  );

  const out: Record<string, { width: number; height: number }> = {};
  for (const entry of entries) {
    if (entry) out[entry[0]] = entry[1];
  }
  return out;
}
