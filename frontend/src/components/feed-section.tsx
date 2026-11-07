import type { ReactNode } from "react";
import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import type { Article, Category } from "@/lib/types";

export function FeedSection({
  articles,
  categories,
  activeSlug,
  title = "Всё новое",
  eyebrow = "Лента / 24 часа",
  description,
  headingAs = "h2",
}: {
  articles: Article[];
  categories?: Category[];
  activeSlug?: string;
  title?: string;
  eyebrow?: string;
  description?: ReactNode;
  /** Listing pages use h1; home feed keeps h2 under the hero. */
  headingAs?: "h1" | "h2";
}) {
  const filters = (categories || []).filter((c) => c.slug !== "bez-rubriki");

  const Heading = headingAs;

  return (
    <section className="mx-auto max-w-site px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-col gap-6 border-b-2 border-ink pb-8 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
          <Heading className="mt-2 font-display text-5xl uppercase leading-[0.9] tracking-tight text-ink sm:text-6xl">
            {title}
          </Heading>
          {description ? (
            typeof description === "string" ? (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                {description}
              </p>
            ) : (
              <div className="mt-4 max-w-2xl">{description}</div>
            )
          ) : null}
        </div>

        {filters.length ? (
          <nav
            aria-label="Фильтр ленты"
            className="flex max-w-xl flex-wrap gap-1.5 lg:justify-end"
          >
            <Link
              href="/"
              className={
                !activeSlug
                  ? "border border-ink bg-ink px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-paper"
                  : "border border-ink/25 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/70 transition hover:border-ink hover:text-ink"
              }
            >
              Все
            </Link>
            {filters.map((cat) => (
              <Link
                key={cat.documentId}
                href={`/category/${cat.slug}`}
                className={
                  activeSlug === cat.slug
                    ? "border border-ink bg-ink px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-paper"
                    : "border border-ink/25 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/70 transition hover:border-ink hover:text-ink"
                }
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      <div className="feed-masonry">
        {articles.map((article, i) => (
          <div key={article.documentId}>
            <ArticleCard article={article} variant="feed" index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}
