"use client";

import { useEffect, useRef } from "react";
import { CmsImage } from "@/components/cms-image";

/**
 * Medium.com-style zoom using the same technique as `medium-zoom`:
 * clone the image in-place, animate only `transform: scale() translate3d()`.
 *
 * Difference: scale targets the viewport (with margin), not naturalWidth —
 * otherwise small CMS photos barely enlarge inside a wide column.
 */

const MARGIN = 24;
const SCROLL_OFFSET = 40;

type Active = {
  original: HTMLImageElement;
  clone: HTMLImageElement;
  overlay: HTMLDivElement;
  scrollY: number;
  closing: boolean;
  onScroll: () => void;
  onKey: (e: KeyboardEvent) => void;
  onResize: () => void;
};

let active: Active | null = null;

function cloneTarget(image: HTMLImageElement) {
  const { top, left, width, height } = image.getBoundingClientRect();
  const clone = image.cloneNode(true) as HTMLImageElement;
  const scrollTop = window.scrollY;
  const scrollLeft = window.scrollX;

  clone.removeAttribute("id");
  clone.style.position = "absolute";
  clone.style.top = `${top + scrollTop}px`;
  clone.style.left = `${left + scrollLeft}px`;
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.transform = "";
  // Prefer full asset over next/image optimizer URL when available
  const zoomSrc = image.getAttribute("data-zoom-src");
  if (zoomSrc) {
    clone.removeAttribute("srcset");
    clone.removeAttribute("sizes");
    clone.src = zoomSrc;
  } else if (image.currentSrc) {
    clone.src = image.currentSrc;
  }

  return { clone, top, left, width, height };
}

/** Same math as medium-zoom, but target size = viewport (Medium-like enlarge). */
function zoomTransform(top: number, left: number, width: number, height: number) {
  const viewportWidth = document.documentElement.clientWidth - MARGIN * 2;
  const viewportHeight = document.documentElement.clientHeight - MARGIN * 2;

  const scale = Math.min(viewportWidth / width, viewportHeight / height);
  const translateX = (-left + (viewportWidth - width) / 2 + MARGIN) / scale;
  const translateY = (-top + (viewportHeight - height) / 2 + MARGIN) / scale;

  return `scale(${scale}) translate3d(${translateX}px, ${translateY}px, 0)`;
}

function closeZoom() {
  const current = active;
  if (!current || current.closing) return;
  current.closing = true;

  document.removeEventListener("scroll", current.onScroll);
  document.removeEventListener("keyup", current.onKey);
  window.removeEventListener("resize", current.onResize);

  document.body.classList.remove("medium-zoom--opened");
  current.clone.style.transform = "";

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    current.original.classList.remove("medium-zoom-image--hidden");
    current.clone.removeEventListener("click", closeZoom);
    current.overlay.removeEventListener("click", closeZoom);
    current.clone.remove();
    current.overlay.remove();
    if (active === current) active = null;
  };

  current.clone.addEventListener("transitionend", finish, { once: true });
  window.setTimeout(finish, 400);
}

function openZoom(original: HTMLImageElement) {
  if (active) {
    if (active.original === original) {
      closeZoom();
      return;
    }
    closeZoom();
  }

  const { clone, top, left, width, height } = cloneTarget(original);
  if (!width || !height) return;

  const overlay = document.createElement("div");
  overlay.className = "medium-zoom-overlay";
  overlay.style.background = "var(--paper)";

  clone.classList.add("medium-zoom-image--opened");
  original.classList.add("medium-zoom-image--hidden");

  const scrollY = window.scrollY;
  const onScroll = () => {
    if (Math.abs(window.scrollY - scrollY) > SCROLL_OFFSET) closeZoom();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Esc") closeZoom();
  };
  const onResize = () => closeZoom();

  overlay.addEventListener("click", closeZoom);
  clone.addEventListener("click", closeZoom);

  document.body.append(overlay, clone);
  active = { original, clone, overlay, scrollY, closing: false, onScroll, onKey, onResize };

  document.addEventListener("scroll", onScroll);
  document.addEventListener("keyup", onKey);
  window.addEventListener("resize", onResize);

  // medium-zoom: open class + transform on next frame so CSS transition runs
  requestAnimationFrame(() => {
    document.body.classList.add("medium-zoom--opened");
    clone.style.transform = zoomTransform(top, left, width, height);
  });
}

function useImageZoom(src: string | undefined) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src) return;

    img.classList.add("medium-zoom-image");
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      openZoom(img);
    };
    img.addEventListener("click", onClick);

    return () => {
      img.removeEventListener("click", onClick);
      img.classList.remove("medium-zoom-image");
      if (active?.original === img) closeZoom();
    };
  }, [src]);

  return imgRef;
}

/** Markdown / inline article image. */
export function ZoomableImage({
  src,
  alt = "",
  title,
  width,
  height,
}: {
  src?: string;
  alt?: string;
  title?: string;
  /** Intrinsic size — reserves layout before the file loads (CLS). */
  width?: number;
  height?: number;
}) {
  const imgRef = useImageZoom(src);
  if (!src) return null;

  const w = width && width > 0 ? Math.round(width) : undefined;
  const h = height && height > 0 ? Math.round(height) : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      title={title}
      width={w}
      height={h}
      data-zoom-src={src}
      // Fallback box when CMS dims are missing — better than 0→full jump.
      style={w && h ? undefined : { aspectRatio: "3 / 4" }}
    />
  );
}

/** Article cover. */
export function ZoomableCover({
  src,
  alt,
  preload,
  sizes,
  blurDataURL,
}: {
  src: string;
  alt: string;
  /** Next 16 LCP hint — replaces deprecated `priority`. */
  preload?: boolean;
  sizes?: string;
  blurDataURL?: string | null;
}) {
  const imgRef = useImageZoom(src);

  return (
    <div className="relative mt-8 aspect-video overflow-hidden border-2 border-ink bg-ink/5">
      <CmsImage
        ref={imgRef}
        src={src}
        alt={alt}
        fill
        className="object-cover"
        preload={preload}
        sizes={sizes}
        blurDataURL={blurDataURL}
        data-zoom-src={src}
      />
    </div>
  );
}
