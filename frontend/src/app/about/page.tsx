import type { Metadata } from "next";
import { CmsPageView, cmsPageMetadata } from "@/components/cms-page";

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata("about");
}

export default function AboutPage() {
  return <CmsPageView slug="about" />;
}
