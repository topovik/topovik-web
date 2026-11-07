"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CmsImage } from "@/components/cms-image";
import { articleHref } from "@/lib/paths";
import { coverBlur, coverUrl } from "@/lib/media";
import type { Article } from "@/lib/types";

function pickRandom(articles: Article[], count: number) {
  const pool = [...articles];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function PartnerBanner({ articles }: { articles: Article[] }) {
  const [list, setList] = useState<Article[] | null>(null);

  useEffect(() => {
    setList(pickRandom(articles, 3));
  }, [articles]);

  if (!articles.length) return null;

  return (
    <aside className="border-y-2 border-ink bg-sky">
      <div className="mx-auto max-w-site px-4 py-5 sm:px-6 sm:py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          Сейчас читают
        </p>

        {!list ? (
          <ul className="mt-3 divide-y divide-ink/15" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-6"
              >
                <span className="size-8 shrink-0 bg-ink/10 sm:size-9" />
                <span className="h-5 w-2/3 max-w-md bg-ink/10" />
                <span className="ml-auto hidden h-8 w-20 bg-ink/10 sm:block" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 divide-y divide-ink/15">
            {list.map((article) => {
              const thumb = coverUrl(article.cover, "medium");
              const blur = coverBlur(article.cover);

              return (
                <li
                  key={article.documentId}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <Link
                    href={articleHref(article)}
                    transitionTypes={["nav-forward"]}
                    className="group flex min-w-0 items-center gap-3"
                  >
                    {thumb ? (
                      <span className="relative size-8 shrink-0 overflow-hidden bg-paper sm:size-9">
                        <CmsImage
                          src={thumb}
                          alt=""
                          fill
                          className="object-cover transition group-hover:scale-105"
                          sizes="72px"
                          blurDataURL={blur}
                        />
                      </span>
                    ) : null}
                    <span className="min-w-0 font-display text-xl uppercase leading-none tracking-tight text-ink transition group-hover:text-accent sm:text-2xl">
                      {article.title}
                    </span>
                  </Link>
                  <Link
                    href={articleHref(article)}
                    transitionTypes={["nav-forward"]}
                    className="inline-flex w-fit shrink-0 items-center border-2 border-ink bg-paper px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
                  >
                    Читать →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
