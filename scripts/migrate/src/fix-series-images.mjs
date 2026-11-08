import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = fs.readFileSync(path.join(__dirname, "../.api-token"), "utf8").trim();
const STRAPI = (process.env.STRAPI_URL || "https://topovik.com").replace(/\/$/, "");
const DOC_ID = "tksz4u8i1vauv5ti9xzze0zl";
const POSTERS = "/tmp/series_posters";

const ORDER = [
  ["the-bear", "Медведь (The Bear)"],
  ["yellowjackets", "Шершни (Yellowjackets)"],
  ["fisher", "Фишер"],
  ["korol-i-shut", "Король и Шут"],
  ["last-of-us", "Одни из нас (The Last of Us)"],
  ["the-boys", "Пацаны (The Boys)"],
  ["slow-horses", "Медленные лошади (Slow Horses)"],
  ["fallout", "Fallout"],
  ["true-detective", "Настоящий детектив (True Detective)"],
  ["gangs-london", "Банды Лондона (Gangs of London)"],
  ["hotd", "Дом Дракона"],
  ["andor", "Андор (Andor)"],
  ["foundation", "Основание (Foundation)"],
  ["black-mirror", "Чёрное зеркало (Black Mirror)"],
  ["severance", "Разделение (Severance)"],
  ["morning-show", "Утреннее шоу (The Morning Show)"],
  ["only-murders", "Убийства в одном здании (Only Murders in the Building)"],
  ["ted-lasso", "Тед Лассо (Ted Lasso)"],
  ["abbott", "Начальная школа Абботт (Abbott Elementary)"],
  ["jjk", "Магическая битва (Jujutsu Kaisen)"],
];

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
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  return json;
}

async function uploadFile(absPath) {
  const buf = fs.readFileSync(absPath);
  const form = new FormData();
  form.append("files", new Blob([buf]), path.basename(absPath));
  const uploaded = await api("POST", "/api/upload", form, true);
  const file = uploaded?.[0];
  if (!file?.id || !file?.url) throw new Error(`upload failed ${absPath}`);
  return file;
}

function findPoster(key) {
  for (const ext of [".jpg", ".png", ".webp"]) {
    const p = path.join(POSTERS, `${key}${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 20000) return p;
  }
  throw new Error(`poster missing: ${key}`);
}

function rebuildContent(raw, urlByKey) {
  // Strip old stock markdown images
  let content = raw.replace(/!\[[^\]]*\]\(\/uploads\/[^)]+\)\n*/g, "");

  // After each "## N. Title" heading, inject matching poster once
  for (let i = 0; i < ORDER.length; i++) {
    const [key, label] = ORDER[i];
    const n = i + 1;
    const url = urlByKey[key];
    const img = `![${label}](${url})`;
    // Match heading like ## 1. Медведь ... possibly with variants
    const re = new RegExp(`(##\\s*${n}\\.\\s*[^\\n]+)\\n+`, "m");
    if (!re.test(content)) {
      throw new Error(`heading not found for #${n} ${label}`);
    }
    content = content.replace(re, `$1\n\n${img}\n\n`);
  }

  if ((content.match(/!\[/g) || []).length !== 20) {
    throw new Error(`expected 20 images, got ${(content.match(/!\[/g) || []).length}`);
  }
  if (/IMAGE:|series_sofa|series_kitchen|series_rain|series_scifi|series_friends/.test(content)) {
    throw new Error("old stock markers still present");
  }
  return content;
}

async function revalidate() {
  const env = fs.readFileSync(path.join(__dirname, "../../../frontend/.env.local"), "utf8");
  const m = env.match(/^REVALIDATE_SECRET=(.+)$/m);
  if (!m) {
    console.warn("no revalidate secret");
    return;
  }
  const secret = m[1].trim().replace(/^["']|["']$/g, "");
  const paths = ["/", "/cinema/20-serialov-kotorye-stoit-posmotret", "/cinema"];
  const res = await fetch("https://topovik.com/api/revalidate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ tags: ["articles", "home", "categories", "category:cinema"], paths }),
  });
  console.log("revalidate", res.status, await res.text());
}

async function main() {
  const current = await api("GET", `/api/articles/${DOC_ID}?status=published`);
  const raw = current?.data?.content || "";
  if (!raw) throw new Error("empty content");

  const urlByKey = {};
  let coverId = null;
  for (const [key] of ORDER) {
    const abs = findPoster(key);
    console.log("upload", key, path.basename(abs));
    const file = await uploadFile(abs);
    urlByKey[key] = file.url.startsWith("http") ? new URL(file.url).pathname : file.url;
    if (key === "the-bear") coverId = file.id;
  }

  const content = rebuildContent(raw, urlByKey);
  const payload = {
    data: {
      content,
      cover: coverId,
    },
  };
  const updated = await api("PUT", `/api/articles/${DOC_ID}?status=published`, payload);
  console.log("UPDATED", updated?.data?.title, "imgs", (updated?.data?.content || "").match(/!\[/g)?.length);
  fs.writeFileSync("/tmp/series_fixed_content.md", content);
  await revalidate();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
