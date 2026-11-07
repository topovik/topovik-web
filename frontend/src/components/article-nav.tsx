import Link from "next/link";
import { CmsImage } from "@/components/cms-image";
import { articleHref } from "@/lib/paths";
import { coverBlur, coverUrl } from "@/lib/media";
import type { Article } from "@/lib/types";

function NavCard({
  article,
  direction,
}: {
  article: Article;
  direction: "prev" | "next";
}) {
  const cover = coverUrl(article.cover, "medium");
  const blur = coverBlur(article.cover);
  const isPrev = direction === "prev";

  return (
    <Link
      href={articleHref(article)}
      transitionTypes={isPrev ? ["nav-back"] : ["nav-forward"]}
      className={`group flex overflow-hidden border-2 border-ink bg-white transition hover:border-accent hover:shadow-[4px_4px_0_0_var(--accent)] ${
        isPrev ? "flex-row" : "flex-row-reverse text-right"
      }`}
    >
      <div className="relative aspect-4/3 w-[38%] min-w-28 shrink-0 overflow-hidden bg-ink/5 sm:min-w-36">
        {cover ? (
          <CmsImage
            src={cover}
            alt={article.cover?.alternativeText || article.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
            sizes="(max-width:640px) 38vw, 180px"
            blurDataURL={blur}
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-ink to-accent/40" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {isPrev ? "← Читать предыдущую" : "Читать следующую →"}
        </span>
        <span className="line-clamp-3 font-display text-lg uppercase leading-[0.98] tracking-tight text-ink transition group-hover:text-accent sm:text-xl">
          {article.title}
        </span>
        {article.category?.name ? (
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
            {article.category.name}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function ArticleNav({
  prev,
  next,
}: {
  prev: Article | null;
  next: Article | null;
}) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Читать соседние статьи"
      className="mt-12 grid gap-3 border-t-2 border-ink pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <NavCard article={prev} direction="prev" />
      ) : (
        <div className="hidden sm:block" aria-hidden />
      )}
      {next ? <NavCard article={next} direction="next" /> : null}
    </nav>
  );
}
