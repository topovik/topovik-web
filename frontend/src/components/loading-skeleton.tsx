/**
 * Tall pulse placeholders so Suspense swaps don't collapse the viewport.
 * Ghost uses invisible real typography for height — never emit h1/h2 (SEO).
 */

import type { ElementType, ReactNode } from "react";

const FEED_ASPECTS = [0.68, 1.45, 0.92, 1.2, 0.75, 1.55, 0.85, 1.1];

/** Invisible real typography + pulse overlay — height matches live text. */
function Ghost({
  as: Tag = "p",
  className,
  pulse = "bg-ink/10",
  fit,
  children,
}: {
  as?: ElementType;
  className?: string;
  pulse?: string;
  fit?: boolean;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`relative ${fit ? "w-fit max-w-full" : ""} ${className ?? ""}`}
      aria-hidden
    >
      <span className="invisible">{children}</span>
      <span
        className={`pointer-events-none absolute inset-0 animate-pulse ${pulse}`}
      />
    </Tag>
  );
}

export function ArticleSkeleton() {
  return (
    <main
      className="mx-auto min-h-[140dvh] max-w-site px-4 py-8 sm:px-6 sm:py-12"
      aria-busy="true"
      aria-hidden
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
        <div>
          <Ghost
            as="nav"
            fit
            className="mb-5 text-[11px] uppercase tracking-[0.14em]"
          >
            Главная / Категория
          </Ghost>

          <Ghost
            fit
            pulse="bg-accent/30"
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          >
            Подборка
          </Ghost>

          {/* div, not h1 — same display classes as the live article title */}
          <Ghost
            as="div"
            className="mt-3 max-w-4xl font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            Заголовок статьи в две строки для скелета загрузки
          </Ghost>

          <Ghost
            fit
            className="mt-5 text-[11px] uppercase tracking-[0.14em]"
          >
            1 января 2026 · 12 тыс. просмотров
          </Ghost>

          <div className="mt-8 aspect-video w-full animate-pulse border-2 border-ink/10 bg-ink/5" />

          <div className="mx-auto mt-8 w-full min-w-0 max-w-3xl">
            <div className="article-body">
              {[
                "Текст абзаца статьи занимает место, пока загружается контент из CMS, чтобы вёрстка не прыгала.",
                "Второй абзац чуть короче и тоже держит высоту блока.",
                "Ещё один абзац для устойчивого скелета страницы статьи на время подгрузки.",
                "Четвёртый абзац добивает типичную длину вводной части материала.",
              ].map((line) => (
                <Ghost key={line} as="p">
                  {line}
                </Ghost>
              ))}
            </div>

            <section className="mt-14 border-t-2 border-ink/15 pt-8">
              <Ghost
                as="div"
                fit
                className="font-display text-3xl uppercase tracking-tight"
              >
                Комментарии (0)
              </Ghost>
              <ul className="mt-6 divide-y divide-ink/15 border-t border-ink/15">
                {["Алексей", "Мария", "Иван"].map((name) => (
                  <li key={name} className="space-y-2 py-5">
                    <Ghost
                      fit
                      className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                    >
                      {name}
                    </Ghost>
                    <Ghost className="text-sm leading-relaxed">
                      Короткий комментарий-заглушка под высоту строки.
                    </Ghost>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <aside className="hidden space-y-4 lg:block lg:pt-20">
          <div className="border-2 border-ink/20 bg-ink/5 p-5">
            <Ghost
              fit
              pulse="bg-accent/30"
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            >
              Topovik /
            </Ghost>
            <Ghost
              as="p"
              className="mt-3 font-display text-2xl uppercase leading-tight tracking-tight"
            >
              Подборки, которые хочется сохранить.
            </Ghost>
            <Ghost as="p" className="mt-3 text-sm leading-relaxed">
              Следите за новыми топами в любимых рубриках.
            </Ghost>
            <Ghost
              as="span"
              fit
              pulse="bg-accent/25"
              className="mt-5 inline-flex px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            >
              Быть в курсе
            </Ghost>
          </div>
        </aside>
      </div>
    </main>
  );
}

function MasonryCardSkeleton({ aspect }: { aspect: number }) {
  return (
    <div className="flex w-full flex-col border-2 border-ink/15 bg-white" aria-hidden>
      <div
        className="w-full animate-pulse bg-ink/5"
        style={{ aspectRatio: aspect }}
      />
      <div className="flex flex-col gap-3 border-t-2 border-ink/15 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em]">
          <Ghost fit pulse="bg-accent/30" className="font-semibold">
            Рубрика
          </Ghost>
          <Ghost fit>3 минуты</Ghost>
        </div>

        <Ghost
          as="div"
          className="font-display text-xl uppercase leading-[0.98] tracking-tight sm:text-2xl"
        >
          Заголовок карточки статьи в ленте на две строки
        </Ghost>

        <div className="flex justify-end pt-1">
          <span className="inline-flex size-8 animate-pulse items-center justify-center border border-ink/15 bg-ink/5" />
        </div>
      </div>
    </div>
  );
}

/** Real category chips — same set/width as FeedSection so the nav wraps to ~2 rows. */
const FILTER_LABELS = [
  "Все",
  "Авто",
  "Бизнес",
  "Гифки",
  "Игры",
  "Искусство",
  "Кино",
  "Музыка",
  "Разное",
  "Спорт",
  "Страны",
  "Технологии",
  "Трэш",
  "Юмор",
];

/** Approx. real CMS category description («Кино») — invisible text sizes the pulse. */
const CATEGORY_DESCRIPTION_PARAS = [
  "Киноиндустрия не стоит на месте и ежедневно радует поклонников выходом сотен новых картин со знаменитыми актерами. И каждый из нас хотел бы лицезреть лучшие фильмы новинки первым, когда еще кинолента только начинает появляться в прокате. Но с развитием интернета информация о появлении очередного кинохита распространяется настолько быстро, что сам фильм в пиратском качестве с уже готовыми рецензиями иногда можно увидеть еще и раньше, чем в кинотеатрах.",
  "В сети легко можно найти факт о любом фильме или актере, однако вечером, находясь в поисках «чего бы посмотреть вечером» можно потеряться в огромном количестве информации. По-прежнему тяжело найти достойные рейтинги и списки, где указаны лучшие фильмы новинки, комедии, ужастики и т.п.",
  "Развлекательный портал Topovik.com готовит и предлагает пользователям тематические подборки фильмов на все случаи жизни: от скучного субботнего вечера до коллективного веселого просмотра с друзьями. На ресурсе освещаются интересные факты из жизни любимых актеров, составляются списки лучших фильмов и новинок 2020 года, делаются обзоры сериалов и мультфильмов и т.п.",
  "С помощью ресурса можно не только без проблем выбрать себе подходящий фильм или сериал для просмотра, но и узнать что-то новое. Каждый день на портале появляются новые материалы, посвященные кино, которые помогут весело и с пользой провести время.",
];

export function ListingSkeleton({
  cards = 9,
  eyebrow = "Рубрика",
  title = "Название рубрики",
  filters = true,
  description = false,
}: {
  cards?: number;
  eyebrow?: string;
  title?: string;
  filters?: boolean;
  /** Reserve space for category markdown / listing lede under the title. */
  description?: boolean;
}) {
  return (
    <main
      className="mx-auto min-h-[140dvh] max-w-site px-4 py-10 sm:px-6 sm:py-14"
      aria-busy="true"
      aria-hidden
    >
      <div className="mb-8 flex flex-col gap-6 border-b-2 border-ink/15 pb-8 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <Ghost
            fit
            pulse="bg-accent/30"
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          >
            {eyebrow}
          </Ghost>
          <Ghost
            as="div"
            fit
            className="mt-2 font-display text-5xl uppercase leading-[0.9] tracking-tight sm:text-6xl"
          >
            {title}
          </Ghost>
          {description ? (
            <div className="article-body article-body--lede mt-4 max-w-2xl">
              {CATEGORY_DESCRIPTION_PARAS.map((para) => (
                <Ghost key={para.slice(0, 48)} as="p">
                  {para}
                </Ghost>
              ))}
            </div>
          ) : null}
        </div>

        {filters ? (
          <nav className="flex max-w-xl flex-wrap gap-1.5 lg:justify-end">
            {FILTER_LABELS.map((label) => (
              <Ghost
                key={label}
                as="span"
                fit
                className="border border-ink/15 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              >
                {label}
              </Ghost>
            ))}
          </nav>
        ) : null}
      </div>

      <div className="feed-masonry">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i}>
            <MasonryCardSkeleton aspect={FEED_ASPECTS[i % FEED_ASPECTS.length]} />
          </div>
        ))}
      </div>
    </main>
  );
}

export function FeedCardsSkeleton({ cards = 9 }: { cards?: number }) {
  return (
    <div className="feed-masonry mt-8" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i}>
          <MasonryCardSkeleton aspect={FEED_ASPECTS[i % FEED_ASPECTS.length]} />
        </div>
      ))}
    </div>
  );
}
