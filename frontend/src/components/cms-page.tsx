import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { JsonLd } from "@/components/json-ld";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  webPageJsonLd,
} from "@/lib/json-ld";
import {
  ogImages,
  pageCanonicalPath,
  pageSocial,
  plainTextExcerpt,
} from "@/lib/seo";
import { getPageBySlug } from "@/lib/strapi";

const PAGE_TYPES: Record<string, "WebPage" | "AboutPage"> = {
  about: "AboutPage",
};

export async function CmsPageView({ slug }: { slug: string }) {
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  const path = pageCanonicalPath(page);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLd
        data={jsonLdGraph(
          webPageJsonLd({
            page,
            type: PAGE_TYPES[page.slug] || "WebPage",
          }),
          breadcrumbJsonLd([
            { name: "Главная", path: "/" },
            { name: page.title, path },
          ]),
        )}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
        Topovik /
      </p>
      <h1 className="mt-3 font-display text-5xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
        {page.title}
      </h1>
      <div className="mt-10">
        <ArticleBody content={page.content || ""} />
      </div>
    </main>
  );
}

export async function cmsPageMetadata(slug: string): Promise<Metadata> {
  const page = await getPageBySlug(slug);
  if (!page) return { title: slug };
  const title = page.seo?.metaTitle || page.title;
  const description =
    page.seo?.metaDescription || plainTextExcerpt(page.content);
  const url = pageCanonicalPath(page);
  return {
    title,
    description,
    alternates: { canonical: url },
    ...pageSocial({
      title,
      description,
      url,
      images: ogImages(),
    }),
  };
}
