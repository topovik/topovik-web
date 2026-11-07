import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
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

type Props = { params: Promise<{ slug: string; page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page: pageParam } = await params;
  const page = Number(pageParam);
  if (!Number.isFinite(page) || page < 2) return { title: "Рубрика" };

  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Рубрика" };

  const title = `${category.name} — страница ${page}`;
  const baseDescription =
    plainTextExcerpt(category.description) ||
    `Подборки в рубрике «${category.name}»`;
  const description = `${baseDescription} — страница ${page}`;
  const url = categoryHref(category.slug, page);

  return {
    title,
    description,
    alternates: { canonical: url },
    ...pageSocial({ title, description, url }),
  };
}

export default function CategoryPaged({ params }: Props) {
  return (
    <Suspense fallback={<ListingSkeleton description />}>
      <CategoryPagedContent params={params} />
    </Suspense>
  );
}

async function CategoryPagedContent({ params }: Props) {
  const { slug, page: pageParam } = await params;
  const page = Number(pageParam);
  if (!Number.isFinite(page) || page < 2) notFound();

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const [list, categories] = await Promise.all([
    getArticles({
      categorySlug: slug,
      page,
      pageSize: CATEGORY_PAGE_SIZE,
    }),
    getCategories().catch(() => []),
  ]);

  if (!list.data.length || page > list.meta.pagination.pageCount) notFound();

  const { pageCount } = list.meta.pagination;
  const path = categoryHref(category.slug, page);
  const prevHref = categoryHref(category.slug, page - 1);
  const nextHref =
    page < pageCount ? categoryHref(category.slug, page + 1) : null;
  const title = `${category.name} — страница ${page}`;

  return (
    <main>
      <link rel="prev" href={prevHref} />
      {nextHref ? <link rel="next" href={nextHref} /> : null}
      <JsonLd
        data={jsonLdGraph(
          categoryCollectionJsonLd(category, list.data, { page, pageCount }),
          breadcrumbJsonLd([
            { name: "Главная", path: "/" },
            { name: category.name, path: categoryHref(category.slug) },
            { name: `Страница ${page}`, path },
          ]),
        )}
      />
      <FeedSection
        articles={list.data}
        categories={categories}
        activeSlug={category.slug}
        eyebrow="Рубрика"
        title={title}
        description={`Продолжение рубрики «${category.name}» — страница ${page} из ${pageCount}.`}
        headingAs="h1"
      />
      <Pagination
        page={page}
        pageCount={pageCount}
        prevHref={prevHref}
        nextHref={nextHref}
      />
    </main>
  );
}
