"use client";

import { useEffect } from "react";

/** Counts a session-unique article view via Strapi custom endpoint. */
export function TrackArticleView({ articleId }: { articleId: number }) {
  useEffect(() => {
    if (!articleId) return;

    const key = `topovik:viewed:${articleId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode / blocked storage — still count once per mount */
    }

    const controller = new AbortController();
    fetch(`/api/articles/${articleId}/views`, {
      method: "POST",
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {
      /* non-blocking analytics */
    });

    return () => controller.abort();
  }, [articleId]);

  return null;
}
