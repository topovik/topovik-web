import Link from "next/link";
import { cacheLife } from "next/cache";
import { FooterLogo } from "@/components/footer-logo";
import { SocialLinks } from "@/components/social-links";
import { footerCategories } from "@/lib/categories";
import type { Category } from "@/lib/types";

async function copyrightYear() {
  "use cache";
  cacheLife("max");
  return new Date().getFullYear();
}

export async function SiteFooter({
  categories = [],
}: {
  categories?: Category[];
}) {
  const year = await copyrightYear();
  const extra = footerCategories(categories);

  return (
    <footer
      className="mt-auto border-t-2 border-ink bg-paper-2"
      style={{ viewTransitionName: "site-footer" }}
    >
      <div className="mx-auto max-w-site px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="space-y-2">
            <FooterLogo />
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
              Подборки в зоне видимости
            </p>
          </div>

          <div className="flex flex-col items-start gap-6 sm:items-end">
            <SocialLinks />
            <nav
              aria-label="Подвал"
              className="flex flex-wrap items-center justify-start gap-x-4 gap-y-2 text-[11px] font-medium uppercase tracking-[0.14em] sm:justify-end"
            >
              {extra.map((cat) => (
                <Link
                  key={cat.documentId}
                  href={`/category/${cat.slug}`}
                  className="text-ink transition hover:text-accent"
                >
                  {cat.name}
                </Link>
              ))}

              {extra.length > 0 ? (
                <span aria-hidden className="h-3 w-px bg-ink/25" />
              ) : null}

              <Link
                href="/about"
                className="text-ink/55 transition hover:text-accent"
              >
                О редакции
              </Link>
              <Link
                href="/ads"
                className="text-ink/55 transition hover:text-accent"
              >
                Реклама
              </Link>
              <Link
                href="/feed.xml"
                className="text-ink/55 transition hover:text-accent"
              >
                RSS
              </Link>

              <span aria-hidden className="h-3 w-px bg-ink/25" />
              <span className="text-ink/40">© {year} Topovik</span>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
