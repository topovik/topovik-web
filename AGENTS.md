## Learned User Preferences

- Prefers Russian, hands-on execution; asks to commit/push and redeploy when changes should go live
- No politics content on the magazine (exclude or avoid political topics)
- Rewritten or generated articles must look human: covers and in-body images must match the subject; avoid obvious AI tells (e.g. stuffing the year 2026)
- Loading skeletons must match real content height via invisible ghost text (titles, breadcrumbs, category descriptions) to prevent CLS jumps
- Avoid layout shift from scrollbar gutter changes on modals and route transitions
- Soft-promote gvillage.by in travel pieces without sounding like ads; open external links in a new tab
- Homepage «Все новое» shows 12 items; do not exclude carousel or «сейчас читают» articles from that list
- Keep the partner-materials slot; «сейчас читают» should stay a compact vertical block with small thumbnails
- Put popular «Юмор» in the header nav; remaining categories can live in the footer
- Prefer current Next.js docs over ad-hoc image/cache workarounds; Redis custom cache was tried and abandoned for Cache Components; keep partialPrefetching on; do not use `connection()` or `instant = false` to force HTTP status
- Prioritize homepage TTFB and HTML payload before GTM/analytics work; keep GTM deferred once delayed

## Learned Workspace Facts

- topovik.com is a magazine (cinema, tech, travel, humor) migrated from WordPress/PHP (`old/`) to Strapi 5 + Postgres CMS and Next.js 16 + Tailwind frontend; package manager is Bun
- Preserve legacy SEO URLs: articles `/{categorySlug}/{slug}`, categories `/category/{slug}` (+ `/page/{n}`), tags `/tag/{slug}`; do not re-transliterate WordPress Latin slugs
- Production host is `vucadigital.by`, app at `/var/www/topovik`; deploy with `bash deploy/deploy.sh` from repo root; SSH by key outside the sandbox
- Frontend runs Next.js standalone with Cache Components; Strapi lives in `cms/`; uploads sync separately from code deploy
- With Cache Components / partialPrefetching, `notFound()` after the stream starts yields soft-404 (HTTP 200 + noindex); call `notFound()` before Suspense and use `unstable_paramMatching: "blocking"` on dynamic routes for real 404
- `publishedAt` is the real publish date and must not be bulk-shifted; mass Strapi saves around 1–9 Nov 2026 polluted `updatedAt` for many articles
- On articles, prefer showing a meaningful update/freshness date over a raw create date when available; JSON-LD dateModified should stay coherent with that
- Site chrome: accent from the logo play mark (not red); `--max-width-site` ~90rem; article body max-width 1280px centered under a full-width cover
- SEO stack matters: JSON-LD, Open Graph, sitemap (including category pagination), Search Console / Core Web Vitals checks after content or layout changes
- Cover and card images must be subject-accurate; in-body images need adequate source resolution (avoid ~200px uploads stretched in the column); reading-time estimates should account for images in the article
- Listing/card Strapi fetches must omit full article `content`; only article pages load the body
- Related property: gvillage.by (countryside rental) is occasionally cross-linked from travel content
