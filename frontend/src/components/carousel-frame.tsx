"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const AUTO_MS = 6500;

export function CarouselFrame({
  children,
  count,
  label,
  eyebrow,
  title,
  headingLevel = 1,
  titleClassName,
}: {
  /** Render only the active slide — avoids mounting/loading every slide's images. */
  children: (index: number) => ReactNode;
  count: number;
  label: string;
  eyebrow: string;
  title: string;
  headingLevel?: 1 | 2;
  titleClassName?: string;
}) {
  const total = Math.max(0, count);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const headingClass =
    titleClassName ||
    "mt-2 font-display text-5xl uppercase leading-[0.9] tracking-tight text-ink sm:text-6xl lg:text-7xl";

  const go = useCallback(
    (next: number) => {
      if (total < 1) return;
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (paused || total < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, total]);

  return (
    <section
      className="mx-auto max-w-site px-4 py-10 sm:px-6 sm:py-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
          <Heading className={headingClass}>{title}</Heading>
        </div>

        {total > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="inline-flex size-9 items-center justify-center border border-ink text-ink transition hover:bg-ink hover:text-paper"
              aria-label="Предыдущий слайд"
            >
              ←
            </button>
            <span className="min-w-14 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(total).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="inline-flex size-9 items-center justify-center border border-ink text-ink transition hover:bg-ink hover:text-paper"
              aria-label="Следующий слайд"
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <div key={index} className="animate-[fadeSlide_420ms_ease]">
          {total > 0 ? children(index) : null}
        </div>
      </div>

      <div className="mt-4 h-0.5 w-full bg-ink/15">
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${((index + 1) / Math.max(total, 1)) * 100}%` }}
        />
      </div>
    </section>
  );
}
