import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { warmNextImages } from "@/lib/warm-images";

type Body = {
  tags?: string[];
  paths?: string[];
  images?: string[];
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "REVALIDATE_SECRET is not set" }, { status: 500 });
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !timingSafeEqual(token, secret)) return unauthorized();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.filter(Boolean))] : [];
  const paths = Array.isArray(body.paths) ? [...new Set(body.paths.filter(Boolean))] : [];
  const images = Array.isArray(body.images)
    ? [...new Set(body.images.filter(Boolean))]
    : [];

  if (!tags.length && !paths.length && !images.length) {
    return NextResponse.json(
      { ok: false, error: "Provide at least one tag, path, or image" },
      { status: 400 }
    );
  }

  for (const tag of tags) {
    // Immediate expire so CMS slug/path updates are not served stale (SWR).
    revalidateTag(tag, { expire: 0 });
  }
  for (const path of paths) {
    // Dynamic segments require an explicit type per Next.js revalidatePath.
    if (path.includes("[")) {
      revalidatePath(path, "page");
    } else {
      revalidatePath(path);
    }
  }

  if (images.length) {
    // Warm inside the same container (avoid hairpin via public nginx).
    const origin =
      process.env.INTERNAL_SITE_URL?.replace(/\/$/, "") ||
      `http://127.0.0.1:${process.env.PORT || 3000}`;
    after(async () => {
      try {
        await warmNextImages(origin, images, { concurrency: 3 });
      } catch {
        /* ignore warmup errors */
      }
    });
  }

  return NextResponse.json({
    ok: true,
    revalidated: { tags, paths, images: images.length },
    now: Date.now(),
  });
}
