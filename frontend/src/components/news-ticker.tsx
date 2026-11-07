import Link from "next/link";
import { articleHref } from "@/lib/paths";
import type { Article } from "@/lib/types";

export function NewsTicker({ articles }: { articles: Article[] }) {
  const items = articles.slice(0, 8);
  if (!items.length) return null;

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-b-2 border-ink bg-ink text-paper">
      <div className="ticker-track flex w-max items-center gap-0 py-2.5">
        {doubled.map((article, i) => (
          <Link
            key={`${article.documentId}-${i}`}
            href={articleHref(article)}
            transitionTypes={["nav-forward"]}
            className="inline-flex shrink-0 items-center gap-3 px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-paper/90 transition hover:text-accent"
          >
            <span className="size-1.5 shrink-0 bg-accent" aria-hidden />
            <span className="max-w-80 truncate">{article.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
