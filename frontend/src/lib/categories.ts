import type { Category } from "@/lib/types";

export const CATEGORY_PAGE_SIZE = 24;

const NAV_ORDER = [
  "avto",
  "bussiness",
  "games",
  "cinema",
  "music",
  "travel",
  "sport",
  "humor",
  "technologies",
  "tresh",
  "other",
];

/** Utility / non-nav categories — never link these in chrome. */
const HIDDEN_SLUGS = new Set(["bez-rubriki"]);

/** Kept out of the header on purpose; still linked from the footer. */
const HEADER_EXCLUDED = new Set(["gifki"]);

const HEADER_LIMIT = 9;

export function headerCategories(categories: Category[]): Category[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const ordered = NAV_ORDER.map((s) => bySlug.get(s)).filter(
    Boolean,
  ) as Category[];
  const rest = categories.filter(
    (c) =>
      !NAV_ORDER.includes(c.slug) &&
      !HIDDEN_SLUGS.has(c.slug) &&
      !HEADER_EXCLUDED.has(c.slug),
  );
  return [...ordered, ...rest].slice(0, HEADER_LIMIT);
}

/** CMS categories that do not fit in the header nav. */
export function footerCategories(categories: Category[]): Category[] {
  const inHeader = new Set(headerCategories(categories).map((c) => c.slug));
  return categories.filter(
    (c) => !inHeader.has(c.slug) && !HIDDEN_SLUGS.has(c.slug),
  );
}
