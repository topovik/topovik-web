"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Drops the extra hit React Strict Mode fires on the same path. */
const lastSent = new Map<string, number>();

function shouldSend(pagePath: string) {
  const now = Date.now();
  const prev = lastSent.get(pagePath) ?? 0;
  if (now - prev < 1000) return false;
  lastSent.set(pagePath, now);
  return true;
}

/** Sends a GA4 page_view on the first load and on App Router navigations. */
export function GoogleAnalyticsPageView({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window.gtag !== "function") return;

    const query = searchParams.toString();
    const page_path = query ? `${pathname}?${query}` : pathname;
    if (!shouldSend(page_path)) return;

    window.gtag("event", "page_view", {
      page_path,
      page_location: window.location.href,
      page_title: document.title,
      send_to: gaId,
    });
  }, [gaId, pathname, searchParams]);

  return null;
}
