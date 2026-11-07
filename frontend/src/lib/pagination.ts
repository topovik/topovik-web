/** Articles per page on home feed and `/page/N` archive. */
export const HOME_PAGE_SIZE = 12;

/** Extra pool on home for carousel fallback / «Сейчас читают». */
export const HOME_FETCH_SIZE = 60;

/** Home featured carousel: hero + 4 mosaic tiles per slide. */
export const FEATURED_SLIDE_SIZE = 5;
/** Number of slides in «Главные истории». */
export const FEATURED_SLIDE_COUNT = 6;
export const FEATURED_ARTICLE_COUNT =
  FEATURED_SLIDE_SIZE * FEATURED_SLIDE_COUNT;

export function pageCountFromTotal(total: number, pageSize = HOME_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}
