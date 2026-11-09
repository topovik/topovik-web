import Link from "next/link";
import { CmsImage } from "@/components/cms-image";
import { articleHref } from "@/lib/paths";
import {
  coverBlur,
  coverUrl,
  formatCount,
  formatReadingMinutes,
  pad2,
} from "@/lib/media";
import type { Article } from "@/lib/types";

type Variant = "feed" | "mosaic" | "hero";

/**
 * Fixed rhythm (same as ListingSkeleton / MasonryCardSkeleton).
 * Do not derive from cover — Suspense skeleton → content would CLS every card.
 */
const FEED_ASPECTS = [0.68, 1.45, 0.92, 1.2, 0.75, 1.55, 0.85, 1.1];

function feedAspectRatio(index: number) {
  return FEED_ASPECTS[index % FEED_ASPECTS.length];
}

export function ArticleCard({
  article,
  featured = false,
  variant,
  index = 1,
}: {
  article: Article;
  featured?: boolean;
  variant?: Variant;
  index?: number;
}) {
  const mode: Variant = variant || (featured ? "hero" : "feed");
  const href = articleHref(article);
  const cover = coverUrl(article.cover, "medium");
  const blur = coverBlur(article.cover);
  const category = article.category;
  const readingTime = formatReadingMinutes(article.readingMinutes);
  const viewsLabel =
    article.views != null && article.views > 0
      ? `${formatCount(article.views)} просм.`
      : null;
  const feedAspect = feedAspectRatio(index);

  if (mode === "hero" || mode === "mosaic") {
    return (
      <article className="group relative isolate h-full min-h-48 overflow-hidden bg-ink">
        <Link
          href={href}
          transitionTypes={["nav-forward"]}
          className="absolute inset-0 z-0 block"
          aria-label={article.title}
        >
          {cover ? (
            <CmsImage
              src={cover}
              alt={article.cover?.alternativeText || article.title}
              fill
              className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
              // Honest sizes → browser picks from srcset; avoids 1920w for a 750 medium.
              sizes={
                mode === "hero"
                  ? "(max-width:1024px) 100vw, 900px"
                  : "(max-width:1024px) 50vw, 280px"
              }
              // Next 16: LCP uses `preload` (priority deprecated). Do not mix with loading.
              preload={mode === "hero"}
              blurDataURL={blur}
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-ink to-accent/50" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent" />
        </Link>

        <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between p-3 sm:p-4">
          <span className="w-fit bg-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
            Feature_{pad2(index)}
          </span>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {category ? (
                <Link
                  href={`/category/${category.slug}`}
                  className="pointer-events-auto text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 hover:text-accent"
                >
                  {category.name}
                </Link>
              ) : null}
              <h2
                className={
                  mode === "hero"
                    ? "mt-1 font-display text-2xl uppercase leading-[0.95] tracking-tight text-white sm:text-4xl lg:text-5xl"
                    : "mt-1 line-clamp-3 font-display text-lg uppercase leading-[0.95] tracking-tight text-white sm:text-xl"
                }
              >
                <Link
                  href={href}
                  transitionTypes={["nav-forward"]}
                  className="pointer-events-auto transition hover:text-accent"
                >
                  {article.title}
                </Link>
              </h2>
            </div>
            <Link
              href={href}
              transitionTypes={["nav-forward"]}
              aria-label={article.title}
              className="pointer-events-auto inline-flex size-9 shrink-0 items-center justify-center bg-ink text-white transition group-hover:bg-accent"
            >
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex w-full flex-col border-2 border-ink bg-white transition-[border-color,box-shadow] duration-300 hover:border-accent hover:shadow-[4px_4px_0_0_var(--accent)]">
      <Link
        href={href}
        transitionTypes={["nav-forward"]}
        className="relative block w-full overflow-hidden bg-ink/5"
        style={{ aspectRatio: feedAspect }}
      >
        {cover ? (
          <CmsImage
            src={cover}
            alt={article.cover?.alternativeText || article.title}
            fill
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 400px"
            blurDataURL={blur}
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-ink to-accent/40" />
        )}
        <span className="absolute left-0 top-0 h-full w-1 origin-top scale-y-0 bg-accent transition-transform duration-300 group-hover:scale-y-100" />
      </Link>

      <div className="flex flex-col gap-3 border-t-2 border-ink p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em]">
          {category ? (
            <Link
              href={`/category/${category.slug}`}
              className="font-semibold text-accent hover:text-ink"
            >
              {category.name}
            </Link>
          ) : (
            <span className="text-muted">Подборка</span>
          )}
          <span className="flex shrink-0 items-center gap-2 text-right">
            {viewsLabel ? (
              <span className="font-semibold tabular-nums text-accent">
                {viewsLabel}
              </span>
            ) : null}
            <span className="text-muted">{readingTime}</span>
          </span>
        </div>

        <h2 className="font-display text-xl uppercase leading-[0.98] tracking-tight text-ink sm:text-2xl">
          <Link
            href={href}
            transitionTypes={["nav-forward"]}
            className="transition hover:text-accent"
          >
            {article.title}
          </Link>
        </h2>

        <div className="flex justify-end pt-1">
          <Link
            href={href}
            transitionTypes={["nav-forward"]}
            aria-label={article.title}
            className="inline-flex size-8 items-center justify-center border border-ink text-ink transition group-hover:border-accent group-hover:bg-accent group-hover:text-white"
          >
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
