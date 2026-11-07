import Image, { type ImageProps } from "next/image";
import { forwardRef } from "react";

type Props = Omit<ImageProps, "placeholder" | "blurDataURL"> & {
  /** LQIP from Strapi `provider_metadata.placeholder` */
  blurDataURL?: string | null;
};

/**
 * CMS media via next/image (docs: fill + sizes + placeholder blur for remote).
 * LQIP from Strapi; optimizer warms on publish. Callers set `preload` only for LCP.
 */
export const CmsImage = forwardRef<HTMLImageElement, Props>(
  function CmsImage({ blurDataURL, alt, ...rest }, ref) {
    const blur = blurDataURL?.startsWith("data:image/") ? blurDataURL : undefined;

    return (
      <Image
        {...rest}
        ref={ref}
        alt={alt}
        placeholder={blur ? "blur" : "empty"}
        blurDataURL={blur}
      />
    );
  },
);
