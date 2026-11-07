import Link from "next/link";
import { CmsImage } from "@/components/cms-image";
import { articleHref } from "@/lib/paths";
import { coverBlur, coverUrl, formatCount, pad2 } from "@/lib/media";
import type { Article } from "@/lib/types";

export function PopularSection({
  articles,
  promo,
}: {
  articles: Article[];
  promo?: Article | null;
}) {
  const list = articles.slice(0, 5);
  if (!list.length) return null;

  const promoCover = coverUrl(promo?.cover, "medium");
  const promoBlur = coverBlur(promo?.cover);

  return (
    <section className="border-y-2 border-ink bg-ink text-paper">
      <div className="mx-auto grid max-w-site lg:grid-cols-2">
        <div className="border-b-2 border-white/10 px-4 py-10 sm:px-6 lg:border-b-0 lg:border-r-2 lg:border-white/10 lg:py-14">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Читают прямо сейчас
              </p>
              <h2 className="mt-2 font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
                Популярное
              </h2>
            </div>
            <span className="border border-white/30 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-paper/70">
              TOP_{pad2(list.length)}
            </span>
          </div>

          <ol className="divide-y divide-white/15 border-t border-white/15">
            {list.map((article, i) => (
              <li key={article.documentId}>
                <Link
                  href={articleHref(article)}
                  transitionTypes={["nav-forward"]}
                  className="group flex items-baseline gap-4 py-5 transition"
                >
                  <span className="font-display text-3xl leading-none text-accent sm:text-4xl">
                    {pad2(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl uppercase leading-tight tracking-tight text-paper transition group-hover:text-accent sm:text-2xl">
                      {article.title}
                    </span>
                    {article.views != null && article.views > 0 ? (
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-paper/55">
                        {formatCount(article.views)} просмотров
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative min-h-80 overflow-hidden lg:min-h-full">
          {promoCover ? (
            <CmsImage
              src={promoCover}
              alt={promo?.cover?.alternativeText || promo?.title || ""}
              fill
              className="object-cover opacity-90"
              sizes="(max-width:1024px) 100vw, 50vw"
              blurDataURL={promoBlur}
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-ink via-ink to-accent/40" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-black/20" />
          <span className="absolute left-4 top-4 border border-white/50 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/80">
            Реклама
          </span>
          <div className="relative z-10 flex h-full min-h-80 flex-col justify-end p-6 sm:p-10 lg:min-h-140">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              Topovik /
            </p>
            <p className="mt-3 max-w-md font-display text-4xl uppercase leading-[0.95] tracking-tight text-white sm:text-5xl">
              Твой топ.
              <br />
              Твои правила.
            </p>
            <Link
              href={promo ? articleHref(promo) : "/about"}
              transitionTypes={["nav-forward"]}
              className="mt-6 inline-flex w-fit items-center gap-2 bg-accent px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-paper hover:text-ink"
            >
              Исследовать подборки →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
