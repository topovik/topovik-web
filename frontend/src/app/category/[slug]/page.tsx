import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { FeedSection } from "@/components/feed-section";
import { JsonLd } from "@/components/json-ld";
import { ListingSkeleton } from "@/components/loading-skeleton";
import { Pagination } from "@/components/pagination";
import {
  breadcrumbJsonLd,
  categoryCollectionJsonLd,
  jsonLdGraph,
} from "@/lib/json-ld";
import { CATEGORY_PAGE_SIZE } from "@/lib/categories";
import { categoryHref } from "@/lib/paths";
import { pageSocial, plainTextExcerpt } from "@/lib/seo";
import { getArticles, getCategories, getCategoryBySlug } from "@/lib/strapi";

type Props = { params: Promise<{ slug: string }> };

export const instant = false;
export const unstable_paramMatching = { slug: "blocking" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return { title: "Рубрика", robots: { index: false, follow: false } };
  }

  const list = await getArticles({
    categorySlug: slug,
    pageSize: 1,
  }).catch(() => null);
  const empty = !list?.data.length;
  const title = category.name;
  const description =
    plainTextExcerpt(category.description) ||
    `Подборки в рубрике «${category.name}»`;
  const url = categoryHref(category.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: empty ? { index: false, follow: true } : undefined,
    ...pageSocial({ title, description, url }),
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <Suspense fallback={<ListingSkeleton description />}>
      <CategoryContent category={category} slug={slug} />
    </Suspense>
  );
}

async function CategoryContent({
  category,
  slug,
}: {
  category: NonNullable<Awaited<ReturnType<typeof getCategoryBySlug>>>;
  slug: string;
}) {
  const [list, categories] = await Promise.all([
    getArticles({
      categorySlug: slug,
      page: 1,
      pageSize: CATEGORY_PAGE_SIZE,
    }),
    getCategories().catch(() => []),
  ]);

  const { pageCount } = list.meta.pagination;
  const nextHref = pageCount > 1 ? categoryHref(category.slug, 2) : null;

  const description = category.description ? (
    <ArticleBody content={category.description} className="article-body--lede" />
  ) : (
    `Подборки в рубрике «${category.name}» на Topovik.`
  );

  return (
    <main>
      {nextHref ? <link rel="next" href={nextHref} /> : null}
      <JsonLd
        data={jsonLdGraph(
          categoryCollectionJsonLd(category, list.data, {
            page: 1,
            pageCount,
          }),
          breadcrumbJsonLd([
            { name: "Главная", path: "/" },
            { name: category.name, path: categoryHref(category.slug) },
          ]),
        )}
      />
      <FeedSection
        articles={list.data}
        categories={categories}
        activeSlug={category.slug}
        eyebrow="Рубрика"
        title={category.name}
        description={description}
        headingAs="h1"
      />
      {!list.data.length ? (
        <p className="mx-auto max-w-site px-4 pb-12 text-sm uppercase tracking-[0.12em] text-muted sm:px-6">
          В этой рубрике пока нет материалов.
        </p>
      ) : null}
      <Pagination page={1} pageCount={pageCount} nextHref={nextHref} />
    </main>
  );
}
