"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { CmsImage } from "@/components/cms-image";
import { articleHref } from "@/lib/paths";
import { coverBlur, coverUrl } from "@/lib/media";
import type { Article } from "@/lib/types";

type SearchPayload = {
  data: Article[];
  total: number;
  query: string;
};

export function SearchTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Поиск"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center border border-ink text-ink transition hover:bg-ink hover:text-paper"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M16.2 16.2 20 20"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="square"
          />
        </svg>
      </button>
      {open ? <SearchDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const runSearch = useCallback((value: string) => {
    const q = value.trim();
    abortRef.current?.abort();

    if (!q) {
      setResults([]);
      setTotal(0);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (controller.signal.aborted) return null;
        if (!res.ok) throw new Error("search_failed");
        return res.json() as Promise<SearchPayload>;
      })
      .then((payload) => {
        // Ignore stale responses after a newer keystroke aborted this request.
        if (!payload || controller.signal.aborted) return;
        startTransition(() => {
          setResults(payload.data);
          setTotal(payload.total);
          setStatus("done");
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const name =
          err && typeof err === "object" && "name" in err
            ? String((err as { name: unknown }).name)
            : "";
        if (name === "AbortError") return;
        setStatus("error");
      });
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 220);
  }

  const trimmed = query.trim();
  const showHint = status === "idle" && !trimmed;
  const showEmpty = status === "done" && trimmed && results.length === 0;
  const showError = status === "error";

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-start justify-center px-3 pt-[12vh] sm:px-4 sm:pt-[14vh]">
      <button
        type="button"
        aria-label="Закрыть поиск"
        className="absolute inset-0 bg-ink/55 backdrop-blur-[2px] transition-opacity"
        onClick={close}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex w-full max-w-xl origin-top animate-[fadeSlide_0.22s_ease-out] flex-col border-2 border-ink bg-paper shadow-[8px_8px_0_0_var(--ink)]"
      >
        <div className="flex items-center gap-3 border-b-2 border-ink px-4 py-3 sm:px-5">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 text-ink/50"
            aria-hidden
          >
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M16.2 16.2 20 20"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="square"
            />
          </svg>
          <label className="sr-only" htmlFor={titleId}>
            Поиск по материалам
          </label>
          <input
            ref={inputRef}
            id={titleId}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Что ищем?"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-base uppercase tracking-widest text-ink outline-none placeholder:text-ink/35 sm:text-sm"
          />
          <kbd className="hidden shrink-0 border border-ink/25 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted sm:inline">
            Esc
          </kbd>
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть"
            className="inline-flex size-8 shrink-0 items-center justify-center border border-ink/25 text-ink transition hover:border-ink hover:bg-ink hover:text-paper sm:hidden"
          >
            ×
          </button>
        </div>

        <div className="max-h-[min(52vh,28rem)] overflow-y-auto overscroll-contain">
          {showHint ? (
            <p className="px-5 py-8 text-center text-[11px] uppercase tracking-[0.14em] text-muted">
              Начните вводить название или тему
            </p>
          ) : null}

          {status === "loading" ? (
            <ul className="divide-y divide-ink/10" aria-busy>
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex gap-3 px-4 py-3 sm:px-5">
                  <span className="size-14 shrink-0 animate-pulse bg-ink/10" />
                  <span className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                    <span className="h-2.5 w-16 animate-pulse bg-ink/10" />
                    <span className="h-3.5 w-3/4 animate-pulse bg-ink/10" />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {showError ? (
            <p className="px-5 py-8 text-center text-[11px] uppercase tracking-[0.14em] text-muted">
              Не удалось выполнить поиск. Попробуйте ещё раз.
            </p>
          ) : null}

          {showEmpty ? (
            <p className="px-5 py-8 text-center text-[11px] uppercase tracking-[0.14em] text-muted">
              Ничего не нашлось по запросу «{trimmed}»
            </p>
          ) : null}

          {status === "done" && results.length > 0 ? (
            <ul className="divide-y divide-ink/10" role="listbox">
              {results.map((article) => {
                const href = articleHref(article);
                const cover = coverUrl(article.cover, "medium");
                const blur = coverBlur(article.cover);
                return (
                  <li key={article.documentId}>
                    <Link
                      href={href}
                      transitionTypes={["nav-forward"]}
                      onClick={close}
                      className="group flex gap-3 px-4 py-3 transition hover:bg-sky/60 sm:px-5"
                    >
                      <span className="relative size-14 shrink-0 overflow-hidden border border-ink/15 bg-ink/5">
                        {cover ? (
                          <CmsImage
                            src={cover}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                            blurDataURL={blur}
                          />
                        ) : (
                          <span className="absolute inset-0 bg-linear-to-br from-ink to-accent/40" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        {article.category ? (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                            {article.category.name}
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
                            Подборка
                          </span>
                        )}
                        <span className="mt-1 block font-display text-xl uppercase leading-[1.05] tracking-tight text-ink transition group-hover:text-accent sm:text-[1.35rem]">
                          {article.title}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className="self-center text-ink/30 transition group-hover:text-accent"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {status === "done" && results.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t-2 border-ink px-4 py-2.5 sm:px-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
              Найдено: {total}
            </p>
            {total > results.length ? (
              <Link
                href={`/search?q=${encodeURIComponent(trimmed)}`}
                transitionTypes={["nav-forward"]}
                onClick={close}
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink transition hover:text-accent"
              >
                Все результаты →
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="hidden items-center justify-between border-t border-ink/10 px-5 py-2 sm:flex">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
              Ctrl / ⌘ K — открыть поиск
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
