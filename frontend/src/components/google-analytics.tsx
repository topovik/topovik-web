import Script from "next/script";
import { Suspense } from "react";
import { GoogleAnalyticsPageView } from "@/components/google-analytics-pageview";

/** GA4 measurement IDs only — keeps the inline snippet free of injection. */
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/;

export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  if (!GA_ID_PATTERN.test(gaId)) return null;

  return (
    <>
      <script
        id="ga-init"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config','${gaId}');`,
        }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Suspense fallback={null}>
        <GoogleAnalyticsPageView gaId={gaId} />
      </Suspense>
    </>
  );
}
