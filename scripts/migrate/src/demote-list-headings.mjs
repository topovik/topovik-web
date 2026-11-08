import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Section titles stay ## ; numbered list entries become ### so hierarchy is visible.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = fs.readFileSync(path.join(__dirname, "../.api-token"), "utf8").trim();
const STRAPI = (process.env.STRAPI_URL || "https://topovik.com").replace(/\/$/, "");

const DOC_IDS = [
  "zyzpocuh3far5jq01p72hmov",
  "tksz4u8i1vauv5ti9xzze0zl",
  "lizpgmig2ruf44f5gt7sykiv",
  "iok1muinjavx2qykxfglpdv2",
  "o8wecfa3b4w4yedr0v9o9ych",
  "ez1ytn6z2klrpfii4ebhopar",
  "v36g8acznl0gqdmmcf5cg07i",
  "ugsz3uo26ckea2opsp187j9g",
  "gvz77v6v7ulv228b2f0jjoei",
  "botxcnogr4iip239fn2fuspl",
];

async function api(method, route, body) {
  const res = await fetch(`${STRAPI}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${route} ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

function demote(content) {
  // ## 1. Title  / ## 12. Title → ###
  return content.replace(/^## (\d+\.\s+)/gm, "### $1");
}

async function main() {
  for (const id of DOC_IDS) {
    const cur = await api("GET", `/api/articles/${id}?status=published`);
    const before = cur?.data?.content || "";
    const after = demote(before);
    const changed = before !== after;
    const h2 = (after.match(/^## /gm) || []).length;
    const h3 = (after.match(/^### /gm) || []).length;
    if (!changed) {
      console.log("skip", id, `##${h2} ###${h3}`);
      continue;
    }
    await api("PUT", `/api/articles/${id}?status=published`, { data: { content: after } });
    console.log("ok", id, `##${h2} ###${h3}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
