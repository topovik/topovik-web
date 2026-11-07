"use client";

import { ArticleCard } from "@/components/article-card";
import { CarouselFrame } from "@/components/carousel-frame";
import {
  FEATURED_SLIDE_COUNT,
  FEATURED_SLIDE_SIZE,
} from "@/lib/pagination";
import type { Article } from "@/lib/types";

function chunkSlides(articles: Article[], maxSlides: number) {
  const slides: Article[][] = [];
  for (
    let i = 0;
    i < articles.length && slides.length < maxSlides;
    i += FEATURED_SLIDE_SIZE
  ) {
    const chunk = articles.slice(i, i + FEATURED_SLIDE_SIZE);
    if (chunk.length) slides.push(chunk);
  }
  return slides;
}

export function FeaturedCarousel({ articles }: { articles: Article[] }) {
  const slides = chunkSlides(articles, FEATURED_SLIDE_COUNT);
  if (!slides.length) return null;

  return (
    <CarouselFrame
      label="Главные истории"
      eyebrow="Выбор редакции"
      title="Главные истории"
      count={slides.length}
    >
      {(slideIndex) => {
        const slide = slides[slideIndex];
        if (!slide) return null;
        const [hero, ...tiles] = slide;
        return (
          <div className="grid gap-2 lg:grid-cols-[1.2fr_1fr] lg:gap-3">
            <div className="min-h-80 lg:min-h-140">
              <ArticleCard
                article={hero}
                variant="hero"
                index={slideIndex * FEATURED_SLIDE_SIZE + 1}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 lg:gap-3">
              {tiles.slice(0, 4).map((article, i) => (
                <div key={article.documentId} className="min-h-44 lg:min-h-0">
                  <ArticleCard
                    article={article}
                    variant="mosaic"
                    index={slideIndex * FEATURED_SLIDE_SIZE + i + 2}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }}
    </CarouselFrame>
  );
}
