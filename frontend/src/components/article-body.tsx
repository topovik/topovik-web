import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { ZoomableImage } from "@/components/zoomable-image";
import { resolveUploadDimensions } from "@/lib/image-size";
import { mediaUrl } from "@/lib/media";

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "iframe"],
  attributes: {
    ...defaultSchema.attributes,
    iframe: ["src", "width", "height", "allow", "allowFullScreen", "frameBorder", "title", "loading", "className"],
    img: [...(defaultSchema.attributes?.img || []), "src", "alt", "title", "width", "height"],
    a: [...(defaultSchema.attributes?.a || []), "href", "title", "rel", "target"],
  },
};

function rewriteUploads(markdown: string) {
  return markdown.replace(
    /(\]\()(\/uploads\/[^)\s]+)(\))/g,
    (_m, open, path, close) => `${open}${mediaUrl(path)}${close}`
  ).replace(
    /(src=["'])(\/uploads\/[^"']+)(["'])/gi,
    (_m, a, path, b) => `${a}${mediaUrl(path)}${b}`
  );
}

function dimensionKey(src: string) {
  try {
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return new URL(src).pathname.split("?")[0];
    }
  } catch {
    /* keep */
  }
  return src.split("?")[0];
}

function readDim(...values: Array<string | number | undefined>) {
  for (const value of values) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** Render Strapi richtext (Markdown; legacy HTML tolerated via rehype-raw). */
export async function ArticleBody({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const markdown = rewriteUploads(content);
  const dimensions = await resolveUploadDimensions(markdown).catch(() => ({}));

  const components: Components = {
    img: ({ src, alt, title, width, height }) => {
      const url = typeof src === "string" ? mediaUrl(src) || src : undefined;
      const key = url ? dimensionKey(url) : "";
      const meta = key ? dimensions[key] : undefined;
      return (
        <ZoomableImage
          src={url}
          alt={alt || ""}
          title={title}
          width={readDim(width, meta?.width)}
          height={readDim(height, meta?.height)}
        />
      );
    },
    a: ({ href, children, title }) => (
      <a href={href} title={title} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}>
        {children}
      </a>
    ),
    iframe: (props) => {
      const src = typeof props.src === "string" ? props.src : undefined;
      if (!src) return null;
      return (
        <iframe
          src={src}
          title={typeof props.title === "string" ? props.title : "Embed"}
          allowFullScreen
          loading="lazy"
          className="aspect-video w-full max-w-full border-0"
        />
      );
    },
  };

  return (
    <div className={className ? `article-body ${className}` : "article-body"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
