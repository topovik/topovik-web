import Link from "next/link";

type Props = {
  page: number;
  pageCount: number;
  prevHref?: string | null;
  nextHref?: string | null;
  className?: string;
};

export function Pagination({
  page,
  pageCount,
  prevHref,
  nextHref,
  className = "mx-auto flex max-w-site items-center justify-center gap-3 px-4 pb-12 sm:gap-4 sm:px-6",
}: Props) {
  if (pageCount <= 1) return null;

  const btn =
    "inline-flex border-2 border-ink px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition";
  const btnGhost = `${btn} hover:bg-ink hover:text-paper`;
  const btnSolid = `${btn} bg-ink text-paper hover:bg-accent hover:border-accent`;

  return (
    <nav
      className={className}
      aria-label="Пагинация"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          transitionTypes={["nav-back"]}
          className={btnGhost}
          rel="prev"
        >
          ← Назад
        </Link>
      ) : (
        <span className={`${btn} cursor-not-allowed border-ink/20 text-ink/25`} aria-hidden>
          ← Назад
        </span>
      )}

      <p
        className="min-w-22 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted tabular-nums"
        aria-current="page"
        aria-label={`Страница ${page} из ${pageCount}`}
      >
        <span className="text-ink">{page}</span>
        <span className="mx-1.5 text-ink/30" aria-hidden>
          /
        </span>
        <span>{pageCount}</span>
      </p>

      {nextHref ? (
        <Link
          href={nextHref}
          transitionTypes={["nav-forward"]}
          className={btnSolid}
          rel="next"
        >
          Дальше →
        </Link>
      ) : (
        <span className={`${btn} cursor-not-allowed border-ink/20 text-ink/25`} aria-hidden>
          Дальше →
        </span>
      )}
    </nav>
  );
}
