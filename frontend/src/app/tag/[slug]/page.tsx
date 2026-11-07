import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FeedSection } from "@/components/feed-section";
import { JsonLd } from "@/components/json-ld";
import { ListingSkeleton } from "@/components/loading-skeleton";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  tagCollectionJsonLd,
} from "@/lib/json-ld";
import { pageSocial } from "@/lib/seo";
import { getArticles, getTagBySlug } from "@/lib/strapi";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return { title: "Тег" };

  const list = await getArticles({ tagSlug: slug, pageSize: 1 }).catch(
    () => null,
  );
  const empty = !list?.data.length;
  const title = `#${tag.name}`;
  const description = `Материалы с тегом «${tag.name}» на Topovik`;
  const url = `/tag/${tag.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: empty ? { index: false, follow: true } : undefined,
    ...pageSocial({ title, description, url }),
  };
}

export default function TagPage({ params }: Props) {
  return (
    <Suspense fallback={<ListingSkeleton filters={false} />}>
      <TagContent params={params} />
    </Suspense>
  );
}

async function TagContent({ params }: Props) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const list = await getArticles({ tagSlug: slug, pageSize: 24 });
  const description = `Подборки и топы с тегом «${tag.name}».`;

  return (
    <main>
      <JsonLd
        data={jsonLdGraph(
          tagCollectionJsonLd(tag, list.data),
          breadcrumbJsonLd([
            { name: "Главная", path: "/" },
            { name: `#${tag.name}`, path: `/tag/${tag.slug}` },
          ]),
        )}
      />
      <FeedSection
        articles={list.data}
        eyebrow="Тег"
        title={`#${tag.name}`}
        description={description}
        headingAs="h1"
      />
      {!list.data.length ? (
        <p className="mx-auto max-w-site px-4 pb-12 text-sm uppercase tracking-[0.12em] text-muted sm:px-6">
          По этому тегу пока нет материалов.
        </p>
      ) : null}
    </main>
  );
}
