import type { Metadata } from "next";
import { CmsPageView, cmsPageMetadata } from "@/components/cms-page";

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata("ads");
}

export default function AdsPage() {
  return <CmsPageView slug="ads" />;
}
