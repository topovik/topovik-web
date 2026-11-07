import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { STRAPI_URL } from "@/lib/config";

/** hash10+ext → basename (only when unique on disk) */
let hashIndex: Map<string, string> | null = null;
let hashIndexAt = 0;

function uploadsDirCandidates() {
  return [
    path.resolve(process.cwd(), "../cms/public/uploads"),
    path.resolve(process.cwd(), "cms/public/uploads"),
    path.resolve(process.cwd(), "../../cms/public/uploads"),
  ];
}

function resolveUploadsDir() {
  for (const dir of uploadsDirCandidates()) {
    try {
      if (fs.statSync(/* turbopackIgnore: true */ dir).isDirectory()) return dir;
    } catch {
      /* try next */
    }
  }
  return null;
}

function getHashIndex() {
  const now = Date.now();
  // Refresh occasionally so post-rename files are picked up in dev
  if (hashIndex && now - hashIndexAt < 60_000) return hashIndex;

  const dir = resolveUploadsDir();
  const next = new Map<string, string | null>();
  if (dir) {
    for (const name of fs.readdirSync(/* turbopackIgnore: true */ dir)) {
      const m = name.match(/_([a-f0-9]{10})(\.[^.]+)$/i);
      if (!m) continue;
      const key = `${m[1].toLowerCase()}${m[2].toLowerCase()}`;
      if (next.has(key)) next.set(key, null);
      else next.set(key, name);
    }
  }

  hashIndex = new Map(
    [...next.entries()].filter((e): e is [string, string] => Boolean(e[1]))
  );
  hashIndexAt = now;
  return hashIndex;
}

function hashKeyFromBasename(basename: string) {
  const m = basename.match(/_([a-f0-9]{10})(\.[^.]+)$/i);
  if (!m) return null;
  return `${m[1].toLowerCase()}${m[2].toLowerCase()}`;
}

async function proxyOrFallback(request: Request, parts: string[]) {
  const basename = parts.map(decodeURIComponent).join("/");
  if (!basename || basename.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const upstream = `${STRAPI_URL}/uploads/${basename}${new URL(request.url).search}`;
  const init: RequestInit = {
    method: request.method,
    redirect: "manual",
    headers: {
      Accept: request.headers.get("Accept") || "*/*",
    },
  };

  let res: Response;
  try {
    res = await fetch(upstream, init);
  } catch {
    return new NextResponse("Upstream unavailable", { status: 502 });
  }

  if (res.ok || (res.status >= 300 && res.status < 400)) {
    return passThrough(res);
  }

  if (res.status !== 404) {
    return passThrough(res);
  }

  const key = hashKeyFromBasename(path.basename(basename));
  if (!key) return new NextResponse("Not found", { status: 404 });

  const target = getHashIndex().get(key);
  if (!target || target === path.basename(basename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  url.pathname = `/uploads/${target}`;
  return NextResponse.redirect(url, 302);
}

function passThrough(res: Response) {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "cache-control",
    "etag",
    "last-modified",
    "location",
  ]) {
    const v = res.headers.get(name);
    if (v) headers.set(name, v);
  }
  return new NextResponse(res.body, { status: res.status, headers });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Ctx) {
  const { path: parts } = await ctx.params;
  return proxyOrFallback(request, parts);
}

export async function HEAD(request: Request, ctx: Ctx) {
  const { path: parts } = await ctx.params;
  return proxyOrFallback(request, parts);
}
