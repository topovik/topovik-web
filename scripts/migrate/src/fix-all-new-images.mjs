import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = fs.readFileSync(path.join(__dirname, "../.api-token"), "utf8").trim();
const STRAPI = (process.env.STRAPI_URL || "https://topovik.com").replace(/\/$/, "");
const ROOT = "/tmp/fix_media";

/** @type {Array<{documentId:string,slug:string,categorySlug:string,dir:string,coverKey:string,items:Array<[number|string,string,string]>}>} */
const JOBS = [
  {
    documentId: "zyzpocuh3far5jq01p72hmov",
    slug: "15-luchshikh-besplatnykh-nejjrosetejj",
    categorySlug: "technologies",
    dir: "ai",
    coverKey: "chatgpt",
    items: [
      [1, "chatgpt", "ChatGPT"],
      [2, "claude", "Claude"],
      [3, "gemini", "Gemini"],
      [4, "grok", "Grok"],
      [5, "alice", "Алиса и ЯндексGPT"],
      [6, "copilot", "Microsoft Copilot"],
      [7, "perplexity", "Perplexity"],
      [8, "phind", "Phind"],
      [9, "ghcopilot", "GitHub Copilot"],
      [10, "shedevrum", "Шедеврум"],
      [11, "designer", "Microsoft Designer"],
      [12, "leonardo", "Leonardo и Kandinsky"],
      [13, "capcut", "CapCut"],
      [14, "whisper", "Whisper"],
      [15, "notion", "ИИ внутри заметок"],
    ],
  },
  {
    documentId: "lizpgmig2ruf44f5gt7sykiv",
    slug: "15-luchshikh-igr-na-telefon",
    categorySlug: "games",
    dir: "games",
    coverKey: "brawl",
    items: [
      [1, "brawl", "Brawl Stars"],
      [2, "clash", "Clash Royale"],
      [3, "blockblast", "Block Blast!"],
      [4, "subway", "Subway Surfers"],
      [5, "geometry", "Geometry Dash"],
      [6, "roblox", "Roblox"],
      [7, "standoff", "Standoff 2"],
      [8, "mlbb", "Mobile Legends"],
      [9, "pubg", "PUBG Mobile"],
      [10, "chess", "Chess.com"],
      [11, "genshin", "Genshin Impact"],
      [12, "deadcells", "Dead Cells"],
      [13, "stardew", "Stardew Valley"],
      [14, "albion", "Albion Online"],
      [15, "balatro", "Balatro"],
    ],
  },
  {
    documentId: "iok1muinjavx2qykxfglpdv2",
    slug: "12-filmov-poslednikh-let-kotorye-nelzya-propustit",
    categorySlug: "cinema",
    dir: "movies",
    coverKey: "dune2",
    items: [
      [1, "dune2", "Дюна: Часть вторая"],
      [2, "oppenheimer", "Оппенгеймер"],
      [3, "barbie", "Барби"],
      [4, "mission", "Миссия невыполнима"],
      [5, "godzilla", "Годзилла и Конг"],
      [6, "eeaa", "Всё везде и сразу"],
      [7, "zone", "Зона интересов"],
      [8, "poor", "Бедные-несчастные"],
      [9, "anatomy", "Анатомия падения"],
      [10, "parasite", "Паразиты"],
      [11, "grom", "Майор Гром: Игра"],
      [12, "topgun", "Топ Ган: Мэверик"],
    ],
  },
  {
    documentId: "o8wecfa3b4w4yedr0v9o9ych",
    slug: "10-idejj-biznesa-na-storone",
    categorySlug: "bussiness",
    dir: "biz",
    coverKey: "tg",
    items: [
      [1, "tg", "Telegram"],
      [2, "reels", "Короткие видео"],
      [3, "templates", "Тексты и шаблоны"],
      [4, "marketplace", "Маркетплейс"],
      [5, "skill", "Один навык"],
      [6, "subscription", "Услуга по подписке"],
      [7, "interview", "Собеседование"],
      [8, "repair", "Узкий ремонт"],
      [9, "guide", "Платный гайд"],
      [10, "reviews", "Разборы сервисов"],
    ],
  },
  {
    documentId: "ez1ytn6z2klrpfii4ebhopar",
    slug: "domashnyaya-trenirovka-bez-zala-programma-na-30-minut",
    categorySlug: "sport",
    dir: "sport",
    coverKey: "main",
    mode: "headingText",
    items: [
      ["Разминка, 5 минут", "warmup", "Разминка"],
      ["Основной блок, 20 минут", "main", "Основной блок"],
      ["Три минуты в конце и две на заминку", "finish", "Заминка"],
      ["Как часто и когда усложнять", "plan", "План"],
    ],
  },
  {
    documentId: "v36g8acznl0gqdmmcf5cg07i",
    slug: "15-luchshikh-memov-i-prikolov-pro-rabotu",
    categorySlug: "humor",
    dir: "humor",
    coverKey: "friday",
    items: [
      [1, "leave", "Почти ушёл"],
      [2, "monday", "Понедельник и пятница"],
      [3, "minute", "На минутку"],
      [4, "team", "Одна команда"],
      [5, "meeting", "На встрече"],
      [6, "tasks", "Три задачи"],
      [7, "tenmin", "Десять минут"],
      [8, "deadline", "ТЗ вечером"],
      [9, "tweaks", "Чуть-чуть поправь"],
      [10, "filename", "final_final"],
      [11, "ask", "Просто спросить"],
      [12, "groupchat", "Общий чат"],
      [13, "standup", "Совещание"],
      [14, "cc", "В копии"],
      [15, "friday", "Пятница"],
    ],
  },
  {
    documentId: "ugsz3uo26ckea2opsp187j9g",
    slug: "kak-puteshestvovat-deshevo-12-rabochikh-sposobov",
    categorySlug: "travel",
    dir: "travel",
    coverKey: "flex",
    items: [
      [1, "weekday", "Середина недели"],
      [2, "airport", "Соседний аэропорт"],
      [3, "window", "Окно бронирования"],
      [4, "flex", "Гибкие даты"],
      [5, "apartment", "Квартира"],
      [6, "suburb", "Дальше от центра"],
      [7, "nighttrain", "Ночной поезд"],
      [8, "food", "Еда как у местных"],
      [9, "walk", "Ноги и транспорт"],
      [10, "free", "Бесплатное"],
      [11, "anchor", "Якорная активность"],
      [12, "insurance", "Страховка и связь"],
    ],
  },
  {
    documentId: "gvz77v6v7ulv228b2f0jjoei",
    slug: "20-lajjfxakov-kotorye-realno-ehkonomyat-vremya-i-nervy",
    categorySlug: "other",
    dir: "life",
    coverKey: "morning",
    items: [
      [1, "badges", "Значки"],
      [2, "dnd", "Не беспокоить"],
      [3, "mail", "Почта"],
      [4, "templates", "Шаблоны"],
      [5, "receipt", "Чеки"],
      [6, "twomin", "Две минуты"],
      [7, "basket", "Корзина"],
      [8, "charge", "Зарядка"],
      [9, "groceries", "Покупки"],
      [10, "evening", "Вечерняя уборка"],
      [11, "autopay", "Автоплатёж"],
      [12, "subcard", "Карта подписок"],
      [13, "cancel", "Отмены"],
      [14, "price", "Ценник"],
      [15, "buffer", "Подушка"],
      [16, "morning", "Утро"],
      [17, "loops", "Открытые петли"],
      [18, "sleep", "Сон"],
      [19, "walk", "Ходьба"],
      [20, "one", "Одно дело"],
    ],
  },
  {
    documentId: "botxcnogr4iip239fn2fuspl",
    slug: "15-podkastov-i-plejlistov-kotorye-stoit-vklyuchit",
    categorySlug: "music",
    dir: "podcasts",
    coverKey: "smartless",
    items: [
      [1, "arzamas", "Arzamas"],
      [2, "postnauka", "ПостНаука"],
      [3, "normalno", "Нормально делай"],
      [4, "vdud", "вДудь"],
      [5, "serial", "Serial"],
      [6, "smartless", "SmartLess"],
      [7, "hdtgm", "How Did This Get Made"],
      [8, "daily", "The Daily"],
      [9, "focus", "Фокус без текста"],
      [10, "workout", "Тренировка"],
      [11, "evening", "Вечер без новостей"],
      [12, "commute", "Микс на дорогу"],
      [13, "friday", "Новинки по пятницам"],
      [14, "local", "Родной чарт"],
      [15, "instrumental", "Инструментал"],
    ],
  },
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

function findFile(dir, key) {
  for (const ext of [".jpg", ".png", ".webp", ".jpeg"]) {
    const p = path.join(ROOT, dir, `${key}${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 5000) return p;
  }
  throw new Error(`missing ${dir}/${key}`);
}

function stripImages(content) {
  return content.replace(/!\[[^\]]*\]\(\/uploads\/[^)]+\)\n*/g, "");
}

function injectByNumber(content, items, urlByKey) {
  let out = content;
  for (const [num, key, alt] of items) {
    const url = urlByKey[key];
    const img = `![${alt}](${url})`;
    const re = new RegExp(`(##\\s*${num}\\.\\s*[^\\n]+)\\n+`, "m");
    if (!re.test(out)) throw new Error(`heading ## ${num}. not found (${alt})`);
    out = out.replace(re, `$1\n\n${img}\n\n`);
  }
  return out;
}

function injectByHeadingText(content, items, urlByKey) {
  let out = content;
  for (const [heading, key, alt] of items) {
    const url = urlByKey[key];
    const img = `![${alt}](${url})`;
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(##\\s*${escaped})\\n+`, "m");
    if (!re.test(out)) throw new Error(`heading not found: ${heading}`);
    out = out.replace(re, `$1\n\n${img}\n\n`);
  }
  return out;
}

async function revalidate(paths) {
  const env = fs.readFileSync(path.join(__dirname, "../../../frontend/.env.local"), "utf8");
  const m = env.match(/^REVALIDATE_SECRET=(.+)$/m);
  if (!m) return;
  const secret = m[1].trim().replace(/^["']|["']$/g, "");
  const res = await fetch("https://topovik.com/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      tags: ["articles", "home", "categories"],
      paths: ["/", ...paths],
    }),
  });
  console.log("revalidate", res.status, await res.text());
}

async function main() {
  const paths = [];
  for (const job of JOBS) {
    console.log("\n==>", job.slug);
    const current = await api("GET", `/api/articles/${job.documentId}?status=published`);
    let content = stripImages(current?.data?.content || "");
    if (!content) throw new Error(`empty ${job.slug}`);

    const urlByKey = {};
    let coverId = null;
    const keys = [...new Set(job.items.map((x) => x[1]).concat(job.coverKey))];
    for (const key of keys) {
      const abs = findFile(job.dir, key);
      process.stdout.write(`  upload ${key}... `);
      const file = await uploadFile(abs);
      const url = file.url.startsWith("http") ? new URL(file.url).pathname : file.url;
      urlByKey[key] = url;
      if (key === job.coverKey) coverId = file.id;
      console.log(url);
    }

    content =
      job.mode === "headingText"
        ? injectByHeadingText(content, job.items, urlByKey)
        : injectByNumber(content, job.items, urlByKey);

    const expected = job.items.length;
    const got = (content.match(/!\[/g) || []).length;
    if (got !== expected) throw new Error(`${job.slug}: expected ${expected} imgs, got ${got}`);

    await api("PUT", `/api/articles/${job.documentId}?status=published`, {
      data: { content, cover: coverId },
    });
    console.log("  UPDATED imgs", got);
    paths.push(`/${job.categorySlug}/${job.slug}`);
  }
  await revalidate(paths);
  console.log("\nDONE", JOBS.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
