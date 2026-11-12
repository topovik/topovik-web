import { Suspense } from "react";
import { DeferredGoogleAnalytics } from "@/components/deferred-google-analytics";
import { GoogleAnalyticsPageView } from "@/components/google-analytics-pageview";

/** GA4 measurement IDs only — keeps the snippet free of injection. */
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/;

export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  if (!GA_ID_PATTERN.test(gaId)) return null;

  return (
    <>
      <DeferredGoogleAnalytics gaId={gaId} />
      <Suspense fallback={null}>
        <GoogleAnalyticsPageView gaId={gaId} />
      </Suspense>
    </>
  );
}
