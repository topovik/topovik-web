import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = fs.readFileSync(path.join(__dirname, "../.api-token"), "utf8").trim();
const STRAPI = (process.env.STRAPI_URL || "https://topovik.com").replace(/\/$/, "");
const REWRITE = JSON.parse(fs.readFileSync("/tmp/rewrite_articles.json", "utf8"));
const COVER_MAP = JSON.parse(fs.readFileSync("/tmp/cover_map.json", "utf8"));
const ASSETS = "/tmp/rewrite_media";
const SITE = "https://topovik.com";

async function api(method, route, body, isForm = false) {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  let payload = body;
  if (!isForm) {
    headers["Content-Type"] = "application/json";
    payload = body ? JSON.stringify(body) : undefined;
  }
  const res = await fetch(`${STRAPI}${route}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${route} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${route} -> ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

async function uploadFile(absPath) {
  const buf = fs.readFileSync(absPath);
  const blob = new Blob([buf]);
  const form = new FormData();
  form.append("files", blob, path.basename(absPath));
  const uploaded = await api("POST", "/api/upload", form, true);
  const file = uploaded?.[0];
  if (!file?.id || !file?.url) throw new Error(`upload failed: ${absPath}`);
  return file;
}

function replaceImages(content, urlByKey) {
  return content.replace(/!\[([^\]]*)\]\(IMAGE:([a-z0-9-]+)\)/g, (_, alt, key) => {
    const url = urlByKey[key];
    if (!url) throw new Error(`missing uploaded image for key ${key}`);
    return `![${alt}](${url})`;
  });
}

async function revalidate(paths) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // try common local secret file patterns; skip if absent
    const candidates = [
      path.join(__dirname, "../../../frontend/.env.local"),
      path.join(__dirname, "../../../.env"),
    ];
    let found;
    for (const p of candidates) {
      if (!fs.existsSync(p)) continue;
      const m = fs.readFileSync(p, "utf8").match(/REVALIDATE_SECRET=(.+)/);
      if (m) {
        found = m[1].trim().replace(/^["']|["']$/g, "");
        break;
      }
    }
    if (!found) {
      console.warn("No REVALIDATE_SECRET — skip revalidate");
      return;
    }
    process.env.REVALIDATE_SECRET = found;
  }
  const res = await fetch(`${SITE}/api/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-revalidate-secret": process.env.REVALIDATE_SECRET,
    },
    body: JSON.stringify({
      tags: ["articles", "home", "categories"],
      paths: ["/", ...paths],
    }),
  });
  console.log("revalidate", res.status, await res.text());
}

async function main() {
  const report = [];
  const newPaths = [];

  for (const article of REWRITE) {
    console.log("\n==>", article.slug);
    const urlByKey = {};

    for (const slot of article.imageSlots) {
      const abs = path.join(ASSETS, "inline", `${slot.key}.jpg`);
      if (!fs.existsSync(abs)) throw new Error(`inline missing: ${abs}`);
      const file = await uploadFile(abs);
      urlByKey[slot.key] = file.url.startsWith("http") ? file.url.replace(SITE, "") : file.url;
      console.log("  img", slot.key, "->", file.url);
    }

    const coverName = COVER_MAP[article.slug];
    if (!coverName) throw new Error(`no cover map for ${article.slug}`);
    const coverAbs = path.join(ASSETS, "covers", coverName);
    if (!fs.existsSync(coverAbs)) throw new Error(`cover missing: ${coverAbs}`);
    const cover = await uploadFile(coverAbs);
    console.log("  cover", cover.url);

    const content = replaceImages(article.content, urlByKey);
    if (content.includes("IMAGE:")) throw new Error(`unreplaced IMAGE placeholders in ${article.slug}`);
    if (/2026/.test(`${article.title}${article.slug}${content}${article.seo?.metaTitle || ""}`)) {
      throw new Error(`2026 still present in ${article.slug}`);
    }

    const payload = {
      data: {
        title: article.title,
        slug: article.slug,
        content,
        cover: cover.id,
        seo: {
          metaTitle: article.seo.metaTitle,
          metaDescription: article.seo.metaDescription,
          canonicalPath: article.seo.canonicalPath,
        },
      },
    };

    const updated = await api(
      "PUT",
      `/api/articles/${article.documentId}?status=published`,
      payload
    );
    const title = updated?.data?.title || article.title;
    const slug = updated?.data?.slug || article.slug;
    console.log("  UPDATED", title, slug);
    report.push({
      documentId: article.documentId,
      oldSlug: article.oldSlug,
      slug,
      title,
      categorySlug: article.categorySlug,
    });
    newPaths.push(`/${article.categorySlug}/${slug}`);
    if (article.oldSlug && article.oldSlug !== slug) {
      newPaths.push(`/${article.categorySlug}/${article.oldSlug}`);
    }
  }

  fs.writeFileSync("/tmp/rewrite_report.json", JSON.stringify(report, null, 2));
  await revalidate([...new Set(newPaths)]);
  console.log("\nDONE", report.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
