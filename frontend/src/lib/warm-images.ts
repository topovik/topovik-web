/** Widths that next/image commonly picks for our `sizes` attributes. */
const WARM_WIDTHS = [384, 640, 750, 828, 1080, 1200];
const WARM_QUALITIES = [75, 85, 90];

function toUploadPath(src: string) {
  try {
    if (src.startsWith("http://") || src.startsWith("https://")) {
      const u = new URL(src);
      return u.pathname.startsWith("/uploads/") ? u.pathname : null;
    }
  } catch {
    return null;
  }
  if (src.startsWith("/uploads/")) return src;
  return null;
}

/** Fire requests so sharp runs once in the background (nginx/Next cache afterward). */
export async function warmNextImages(
  origin: string,
  sources: string[],
  opts?: { concurrency?: number },
) {
  const base = origin.replace(/\/$/, "");
  const paths = [
    ...new Set(sources.map(toUploadPath).filter((p): p is string => Boolean(p))),
  ];
  if (!paths.length) return { warmed: 0 };

  const urls: string[] = [];
  for (const path of paths) {
    for (const w of WARM_WIDTHS) {
      for (const q of WARM_QUALITIES) {
        urls.push(
          `${base}/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=${q}`,
        );
      }
    }
  }

  const concurrency = Math.max(1, opts?.concurrency ?? 4);
  let warmed = 0;
  let i = 0;

  async function worker() {
    while (i < urls.length) {
      const idx = i;
      i += 1;
      try {
        const res = await fetch(urls[idx], {
          method: "GET",
          headers: { Accept: "image/avif,image/webp,image/*" },
          cache: "no-store",
        });
        if (res.ok) warmed += 1;
        // drain body so connection can reuse
        await res.arrayBuffer().catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { warmed, total: urls.length, paths: paths.length };
}
