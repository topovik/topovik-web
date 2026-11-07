import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { ArticleNav } from "@/components/article-nav";
import { ArticleSkeleton } from "@/components/loading-skeleton";
import { NewsletterLink } from "@/components/newsletter-link";
import { RecommendedCarousel } from "@/components/recommended-carousel";
import { TrackArticleView } from "@/components/track-article-view";
import { ZoomableCover } from "@/components/zoomable-image";
import { JsonLd } from "@/components/json-ld";
import {
  getAdjacentArticles,
  getApprovedComments,
  getRecommendedArticles,
  resolveArticleFromParams,
} from "@/lib/strapi";
import {
  articleDate,
  coverBlur,
  formatCount,
  formatDate,
  formatReadingMinutes,
  mediaUrl,
} from "@/lib/media";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  jsonLdGraph,
} from "@/lib/json-ld";
import {
  articleCanonicalPath,
  articleDescription,
  ogImages,
  pageSocial,
} from "@/lib/seo";
import type { Article } from "@/lib/types";

type Props = { params: Promise<{ category: string; slug: string }> };

const RESERVED = new Set(["category", "tag", "search", "page", "about", "ads", "api"]);

async function resolveOrRedirect(category: string, slug: string) {
  if (RESERVED.has(category)) notFound();
  const resolved = await resolveArticleFromParams(category, slug);
  if (!resolved) notFound();
  if (resolved.redirectTo) permanentRedirect(resolved.redirectTo);
  return resolved.article;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  if (RESERVED.has(category)) return {};
  const resolved = await resolveArticleFromParams(category, slug);
  if (!resolved) return { title: "Не найдено" };
  // Metadata for legacy URLs still points at the live canonical; HTTP 308 happens in the page.
  const article = resolved.article;

  const title = article.seo?.metaTitle || article.title;
  const description = articleDescription(article);
  const path = articleCanonicalPath(article);
  const images = ogImages({
    media: article.cover,
    alt: article.cover?.alternativeText || article.title,
  });
  const social = pageSocial({
    title,
    description,
    url: path,
    images,
    type: "article",
  });

  return {
    title,
    description,
    alternates: { canonical: path },
    ...social,
    openGraph: {
      ...social.openGraph,
      type: "article",
      publishedTime: article.publishedAt || undefined,
      modifiedTime: article.updatedAt || undefined,
      section: article.category?.name || undefined,
      tags: article.tags?.map((tag) => tag.name),
    },
  };
}

export default function ArticlePage({ params }: Props) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <ArticleFromParams params={params} />
    </Suspense>
  );
}

async function ArticleFromParams({ params }: Props) {
  const { category, slug } = await params;
  const article = await resolveOrRedirect(category, slug);
  return <ArticleContent article={article} />;
}

async function ArticleContent({ article }: { article: Article }) {
  const [comments, adjacent, recommended] = await Promise.all([
    getApprovedComments(article.documentId).catch(() => []),
    getAdjacentArticles(article).catch(() => ({ prev: null, next: null })),
    getRecommendedArticles(article, 16).catch(() => []),
  ]);
  const cover = mediaUrl(article.cover?.url);
  const blur = coverBlur(article.cover);
  const breadcrumbs = [
    { name: "Главная", path: "/" },
    ...(article.category
      ? [
          {
            name: article.category.name,
            path: `/category/${article.category.slug}`,
          },
        ]
      : []),
    { name: article.title, path: articleCanonicalPath(article) },
  ];

  return (
    <main>
      <TrackArticleView articleId={article.id} />
      <JsonLd
        data={jsonLdGraph(
          articleJsonLd(article),
          breadcrumbJsonLd(breadcrumbs),
        )}
      />
      <div className="mx-auto max-w-site px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
          <article>
            <nav className="mb-5 text-[11px] uppercase tracking-[0.14em] text-muted">
              <Link href="/" transitionTypes={["nav-back"]} className="hover:text-accent">
                Главная
              </Link>
              {article.category ? (
                <>
                  <span className="mx-2 text-accent">/</span>
                  <Link
                    href={`/category/${article.category.slug}`}
                    transitionTypes={["nav-back"]}
                    className="hover:text-accent"
                  >
                    {article.category.name}
                  </Link>
                </>
              ) : null}
            </nav>

            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              {article.category?.name || "Подборка"}
            </p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
              {article.title}
            </h1>
            <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-muted">
              {formatDate(articleDate(article))}
              {` · ${formatReadingMinutes(article.readingMinutes)}`}
              {article.views != null
                ? ` · ${formatCount(article.views)} просмотров`
                : ""}
              {article.likes ? ` · ${formatCount(article.likes)} ★` : ""}
            </p>

            {cover ? (
              <ZoomableCover
                src={cover}
                alt={article.cover?.alternativeText || article.title}
                preload
                sizes="(max-width:1024px) calc(100vw - 2rem), 900px"
                blurDataURL={blur}
              />
            ) : null}

            <div className="mx-auto mt-8 w-full min-w-0 max-w-3xl">
              <ArticleBody content={article.content || ""} />

              {article.tags?.length ? (
                <ul className="mt-10 flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <li key={tag.documentId}>
                      <Link
                        href={`/tag/${tag.slug}`}
                        className="border border-ink/20 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-muted transition hover:border-accent hover:text-accent"
                      >
                        #{tag.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              <ArticleNav prev={adjacent.prev} next={adjacent.next} />

              <section className="mt-14 border-t-2 border-ink pt-8">
                <h2 className="font-display text-3xl uppercase tracking-tight text-ink">
                  Комментарии ({comments.length})
                </h2>
                <ul className="mt-6 divide-y divide-ink/15 border-t border-ink/15">
                  {comments.map((c) => (
                    <li key={c.documentId} className="py-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
                        {c.authorName}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                        {c.content}
                      </p>
                    </li>
                  ))}
                  {!comments.length ? (
                    <li className="py-5 text-sm uppercase tracking-[0.12em] text-muted">
                      Пока нет комментариев.
                    </li>
                  ) : null}
                </ul>
              </section>
            </div>
          </article>

          <aside className="space-y-4 lg:pt-20">
            <div className="border-2 border-ink bg-ink p-5 text-paper">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Topovik /
              </p>
              <p className="mt-3 font-display text-2xl uppercase leading-tight tracking-tight">
                Подборки, которые хочется сохранить.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-paper/65">
                Следите за новыми топами в любимых рубриках.
              </p>
              <NewsletterLink className="mt-5 inline-flex bg-accent px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-paper hover:text-ink" />
            </div>
          </aside>
        </div>
      </div>

      {recommended.length ? (
        <div className="border-t-2 border-ink bg-paper-2">
          <RecommendedCarousel articles={recommended} />
        </div>
      ) : null}
    </main>
  );
}
