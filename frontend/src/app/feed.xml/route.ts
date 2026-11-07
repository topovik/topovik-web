import { absoluteUrl } from "@/lib/json-ld";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  articleCanonicalPath,
  articleDescription,
} from "@/lib/seo";
import { getAllArticles } from "@/lib/strapi";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const articles = (await getAllArticles().catch(() => [])).slice(0, 50);
  const origin = absoluteUrl("/");
  const buildDate = new Date().toUTCString();

  const items = articles
    .map((article) => {
      const link = absoluteUrl(articleCanonicalPath(article));
      const description = articleDescription(article);
      const pubDate = article.publishedAt
        ? new Date(article.publishedAt).toUTCString()
        : undefined;
      const category = article.category?.name;

      return [
        "<item>",
        `<title>${escapeXml(article.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        description
          ? `<description>${escapeXml(description)}</description>`
          : "",
        pubDate ? `<pubDate>${pubDate}</pubDate>` : "",
        category ? `<category>${escapeXml(category)}</category>` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ru</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${escapeXml(absoluteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />
    <generator>${escapeXml(SITE_NAME)}</generator>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
