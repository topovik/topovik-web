import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FeedSection } from "@/components/feed-section";
import { JsonLd } from "@/components/json-ld";
import { ListingSkeleton } from "@/components/loading-skeleton";
import { Pagination } from "@/components/pagination";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  jsonLdGraph,
} from "@/lib/json-ld";
import { HOME_PAGE_SIZE } from "@/lib/pagination";
import { pageSocial } from "@/lib/seo";
import { getArticles } from "@/lib/strapi";

type Props = { params: Promise<{ page: string }> };

export const instant = false;
export const unstable_paramMatching = { page: "blocking" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page: pageParam } = await params;
  const page = Number(pageParam);
  if (!Number.isFinite(page) || page < 2) return { title: "Архив" };
  const title = `Страница ${page}`;
  const description = `Архив подборок Topovik — страница ${page}`;
  const url = `/page/${page}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    ...pageSocial({ title, description, url }),
  };
}

export default async function HomePaged({ params }: Props) {
  const { page: pageParam } = await params;
  const page = Number(pageParam);
  if (!Number.isFinite(page) || page < 2) notFound();

  const list = await getArticles({ page, pageSize: HOME_PAGE_SIZE });
  if (!list.data.length) notFound();

  return (
    <Suspense fallback={<ListingSkeleton filters={false} />}>
      <HomePagedContent page={page} list={list} />
    </Suspense>
  );
}

async function HomePagedContent({
  page,
  list,
}: {
  page: number;
  list: Awaited<ReturnType<typeof getArticles>>;
}) {
  const title = `Страница ${page}`;
  const path = `/page/${page}`;
  const { pageCount } = list.meta.pagination;
  const prevHref = page === 2 ? "/" : `/page/${page - 1}`;
  const nextHref = page < pageCount ? `/page/${page + 1}` : null;

  return (
    <main>
      <link rel="prev" href={prevHref} />
      {nextHref ? <link rel="next" href={nextHref} /> : null}
      <JsonLd
        data={jsonLdGraph(
          collectionPageJsonLd({
            name: title,
            description: `Архив подборок Topovik — страница ${page}`,
            path,
            articles: list.data,
          }),
          breadcrumbJsonLd([
            { name: "Главная", path: "/" },
            { name: title, path },
          ]),
        )}
      />
      <FeedSection
        articles={list.data}
        eyebrow="Архив"
        title={title}
        description={`Продолжение ленты Topovik — страница ${page} из ${pageCount}.`}
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
