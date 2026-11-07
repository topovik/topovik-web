import type { Metadata } from "next";
import { Alumni_Sans, IBM_Plex_Sans } from "next/font/google";
import { JsonLd } from "@/components/json-ld";
import { PageTransition } from "@/components/page-transition";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  jsonLdGraph,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/json-ld";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  pageSocial,
} from "@/lib/seo";
import { getCategories } from "@/lib/strapi";
import "./globals.css";

const display = Alumni_Sans({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  ...pageSocial({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  }),
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const categories = await getCategories().catch(() => []);

  return (
    <html lang="ru" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">
        <JsonLd data={jsonLdGraph(organizationJsonLd(), websiteJsonLd())} />
        <SiteHeader categories={categories} />
        <div className="flex-1">
          <PageTransition>{children}</PageTransition>
        </div>
        <SiteFooter categories={categories} />
        <ScrollToTop />
      </body>
    </html>
  );
}
