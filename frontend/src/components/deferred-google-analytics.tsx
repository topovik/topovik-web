"use client";

import { useEffect } from "react";

/**
 * Load gtag after window load + idle so it does not compete with LCP/TTFB.
 * First page_view still fires from gtag('config') once the script is ready.
 */
export function DeferredGoogleAnalytics({ gaId }: { gaId: string }) {
  useEffect(() => {
    let idleId = 0;
    let timeoutId = 0;
    let cancelled = false;

    const inject = () => {
      if (cancelled || document.getElementById("ga-gtag")) return;

      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function gtag(...args: unknown[]) {
          window.dataLayer!.push(args);
        };
      window.gtag("consent", "default", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      window.gtag("js", new Date());
      window.gtag("config", gaId);

      const script = document.createElement("script");
      script.id = "ga-gtag";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);
    };

    const schedule = () => {
      const ric = window.requestIdleCallback;
      if (typeof ric === "function") {
        idleId = ric.call(window, inject, { timeout: 4000 });
      } else {
        timeoutId = window.setTimeout(inject, 2500);
      }
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [gaId]);

  return null;
}
