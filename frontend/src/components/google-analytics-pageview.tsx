"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

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

/** Sends a GA4 page_view on App Router navigations. The first view comes from gtag config. */
export function GoogleAnalyticsPageView({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    const query = searchParams.toString();
    const page_path = query ? `${pathname}?${query}` : pathname;
    if (!shouldSend(page_path)) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        window.dataLayer?.push(arguments);
      };
    window.gtag("event", "page_view", {
      page_path,
      page_location: window.location.href,
      page_title: document.title,
      send_to: gaId,
    });
  }, [gaId, pathname, searchParams]);

  return null;
}
