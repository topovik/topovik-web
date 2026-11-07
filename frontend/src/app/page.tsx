import { FeaturedCarousel } from "@/components/featured-carousel";
import { FeedSection } from "@/components/feed-section";
import { JsonLd } from "@/components/json-ld";
import { NewsTicker } from "@/components/news-ticker";
import { Newsletter } from "@/components/newsletter";
import { Pagination } from "@/components/pagination";
import { PartnerBanner } from "@/components/partner-banner";
import { PopularSection } from "@/components/popular-section";
import { homeJsonLd, jsonLdGraph } from "@/lib/json-ld";
import {
  FEATURED_ARTICLE_COUNT,
  HOME_FETCH_SIZE,
  HOME_PAGE_SIZE,
  pageCountFromTotal,
} from "@/lib/pagination";
import {
  getArticles,
  getCategories,
  getFeaturedArticles,
  getPopularArticles,
} from "@/lib/strapi";

export default async function HomePage() {
  const [featured, list, categories, popular] = await Promise.all([
    getFeaturedArticles(FEATURED_ARTICLE_COUNT),
    getArticles({ page: 1, pageSize: HOME_FETCH_SIZE }),
    getCategories().catch(() => []),
    getPopularArticles(5).catch(() => []),
  ]);

  const carouselSource = (featured.length ? featured : list.data).slice(
    0,
    FEATURED_ARTICLE_COUNT,
  );
  const feed = list.data.slice(0, HOME_PAGE_SIZE);
  const promo =
    carouselSource[0] ||
    list.data.find((a) => a.cover?.url) ||
    list.data[0] ||
    null;
  const tickerSource = list.data.slice(0, 8);
  // Home fetches a larger pool, but «Дальше» goes to `/page/N` with HOME_PAGE_SIZE.
  const pageCount = pageCountFromTotal(list.meta.pagination.total);

  return (
    <main>
      <JsonLd data={jsonLdGraph(homeJsonLd(feed))} />
      <NewsTicker articles={tickerSource} />
      <FeaturedCarousel articles={carouselSource} />
      <PartnerBanner articles={list.data} />
      <FeedSection articles={feed} categories={categories} />

      {pageCount > 1 ? <link rel="next" href="/page/2" /> : null}
      <Pagination
        page={1}
        pageCount={pageCount}
        nextHref="/page/2"
        className="mx-auto flex max-w-site items-center justify-center gap-3 px-4 pb-10 sm:gap-4 sm:px-6 sm:pb-14"
      />

      <PopularSection articles={popular} promo={promo} />
      <Newsletter />
    </main>
  );
}
