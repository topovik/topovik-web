import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleCard } from "@/components/article-card";
import { FeedCardsSkeleton } from "@/components/loading-skeleton";
import { Pagination } from "@/components/pagination";
import { pageSocial } from "@/lib/seo";
import { getArticles } from "@/lib/strapi";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Поиск",
  description: "Найти материал на Topovik",
  robots: { index: false, follow: true },
  ...pageSocial({
    title: "Поиск",
    description: "Найти материал на Topovik",
    url: "/search",
  }),
};

export default function SearchPage({ searchParams }: Props) {
  return (
    <main className="mx-auto max-w-site px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
        Поиск
      </p>
      <h1 className="mt-2 font-display text-5xl uppercase leading-[0.9] tracking-tight text-ink sm:text-6xl">
        Найти материал
      </h1>
      <Suspense fallback={<SearchFallback />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form
      action="/search"
      method="get"
      className="mt-8 flex max-w-xl items-end gap-3 border-b-2 border-ink pb-2"
    >
      <label className="sr-only" htmlFor="q">
        Запрос
      </label>
      <input
        id="q"
        name="q"
        defaultValue={defaultValue}
        placeholder="Что ищем?"
        className="min-w-0 flex-1 bg-transparent text-sm uppercase tracking-[0.12em] outline-none placeholder:text-ink/35"
      />
      <button
        type="submit"
        className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:text-accent"
      >
        Искать →
      </button>
    </form>
  );
}

function SearchFallback() {
  return (
    <>
      <SearchForm />
      <div
        className="mt-8 h-3 w-56 max-w-full animate-pulse bg-ink/10"
        aria-hidden
      />
      <FeedCardsSkeleton cards={6} />
    </>
  );
}

function searchHref(query: string, page: number) {
  const params = new URLSearchParams({ q: query });
  if (page > 1) params.set("page", String(page));
  return `/search?${params.toString()}`;
}

async function SearchResults({ searchParams }: Props) {
  const { q = "", page: pageParam } = await searchParams;
  const query = q.trim();
  const requested = Number(pageParam);
  const page =
    Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1;

  const list = query
    ? await getArticles({ search: query, page, pageSize: PAGE_SIZE })
    : null;

  const pagination = list?.meta.pagination;
  const pageCount = pagination?.pageCount ?? 0;
  const total = pagination?.total ?? 0;
  const currentPage = pagination?.page ?? page;

  return (
    <>
      <SearchForm defaultValue={query} />

      {query ? (
        <>
          <p className="mt-8 text-[11px] uppercase tracking-[0.14em] text-muted">
            Результаты по запросу «{query}»: {total}
          </p>
          <div className="feed-masonry mt-8">
            {list?.data.map((article, i) => (
              <div key={article.documentId}>
                <ArticleCard article={article} variant="feed" index={i} />
              </div>
            ))}
          </div>

          <Pagination
            page={currentPage}
            pageCount={pageCount}
            prevHref={
              currentPage > 1 ? searchHref(query, currentPage - 1) : null
            }
            nextHref={
              currentPage < pageCount
                ? searchHref(query, currentPage + 1)
                : null
            }
            className="mt-10 flex items-center justify-center gap-3 sm:gap-4"
          />
        </>
      ) : (
        <p className="mt-8 text-sm uppercase tracking-[0.12em] text-muted">
          Введите запрос в поле выше.
        </p>
      )}
    </>
  );
}
