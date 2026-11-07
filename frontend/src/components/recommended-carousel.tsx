"use client";

import { ArticleCard } from "@/components/article-card";
import { CarouselFrame } from "@/components/carousel-frame";
import type { Article } from "@/lib/types";

const SLIDE_SIZE = 4;

function chunkSlides(articles: Article[]) {
  const slides: Article[][] = [];
  for (let i = 0; i < articles.length; i += SLIDE_SIZE) {
    const chunk = articles.slice(i, i + SLIDE_SIZE);
    if (chunk.length) slides.push(chunk);
  }
  return slides;
}

export function RecommendedCarousel({ articles }: { articles: Article[] }) {
  const slides = chunkSlides(articles);
  if (!slides.length) return null;

  return (
    <CarouselFrame
      label="Рекомендуем"
      eyebrow="Ещё по теме"
      title="Рекомендуем"
      count={slides.length}
      headingLevel={2}
      titleClassName="mt-2 font-display text-4xl uppercase leading-[0.9] tracking-tight text-ink sm:text-5xl lg:text-6xl"
    >
      {(slideIndex) => {
        const slide = slides[slideIndex];
        if (!slide) return null;
        return (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {slide.map((article, i) => (
              <div key={article.documentId} className="min-h-52 sm:min-h-64">
                <ArticleCard
                  article={article}
                  variant="mosaic"
                  index={slideIndex * SLIDE_SIZE + i + 1}
                />
              </div>
            ))}
          </div>
        );
      }}
    </CarouselFrame>
  );
}
