"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NewsletterLink } from "@/components/newsletter-link";
import { SearchTrigger } from "@/components/search-dialog";
import { headerCategories } from "@/lib/categories";
import type { Category } from "@/lib/types";

const TOP_OFFSET = 48;
const DELTA = 12;

export function SiteHeader({ categories }: { categories: Category[] }) {
  const nav = headerCategories(categories);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const hiddenRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    function apply(y: number) {
      const delta = y - lastY.current;
      const nextScrolled = y > TOP_OFFSET;
      let nextHidden = hiddenRef.current;

      if (y <= TOP_OFFSET) {
        nextHidden = false;
      } else if (delta > DELTA) {
        nextHidden = true;
      } else if (delta < -DELTA) {
        nextHidden = false;
      }

      if (nextHidden !== hiddenRef.current) {
        hiddenRef.current = nextHidden;
        setHidden(nextHidden);
      }

      setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
      lastY.current = y;
    }

    function onScroll() {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        apply(window.scrollY);
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur-md will-change-transform ${
        scrolled && !hidden
          ? "shadow-[0_10px_24px_-12px_rgb(10_10_10/0.28)]"
          : "shadow-none"
      }`}
      style={{
        viewTransitionName: "site-header",
        transform: hidden
          ? "translate3d(0, calc(-100% - 3px), 0)"
          : "translate3d(0, 0, 0)",
        transition:
          "transform 480ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 480ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div className="mx-auto flex max-w-site items-center gap-3 px-4 py-3.5 sm:px-6 lg:gap-4 xl:gap-6">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="group shrink-0"
          aria-label="Topovik — на главную"
        >
          <Image
            src="/logo.png"
            alt="TOPOVIK"
            width={243}
            height={41}
            className="h-7 w-auto sm:h-8 lg:h-8 xl:h-9"
            preload
          />
        </Link>

        <nav
          aria-label="Рубрики"
          className="hidden min-w-0 flex-1 items-center justify-between gap-x-2 gap-y-1 overflow-x-auto lg:flex xl:justify-center xl:gap-x-3.5"
        >
          {nav.map((cat) => (
            <Link
              key={cat.documentId}
              href={`/category/${cat.slug}`}
              className="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/70 transition hover:text-accent xl:text-[11px] xl:tracking-[0.14em]"
            >
              {cat.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <SearchTrigger />
          <NewsletterLink className="hidden items-center bg-accent px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink xl:inline-flex" />
        </div>
      </div>

      <nav
        aria-label="Рубрики"
        className="flex gap-1 overflow-x-auto border-t border-ink/15 px-4 py-2 lg:hidden [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {nav.map((cat) => (
          <Link
            key={cat.documentId}
            href={`/category/${cat.slug}`}
            className="shrink-0 border border-ink/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink/75"
          >
            {cat.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
