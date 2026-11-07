import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { ZoomableImage } from "@/components/zoomable-image";
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

const components: Components = {
  img: ({ src, alt, title }) => {
    const url = typeof src === "string" ? mediaUrl(src) || src : undefined;
    return <ZoomableImage src={url} alt={alt || ""} title={title} />;
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

function rewriteUploads(markdown: string) {
  return markdown.replace(
    /(\]\()(\/uploads\/[^)\s]+)(\))/g,
    (_m, open, path, close) => `${open}${mediaUrl(path)}${close}`
  ).replace(
    /(src=["'])(\/uploads\/[^"']+)(["'])/gi,
    (_m, a, path, b) => `${a}${mediaUrl(path)}${b}`
  );
}

/** Render Strapi richtext (Markdown; legacy HTML tolerated via rehype-raw). */
export function ArticleBody({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const markdown = rewriteUploads(content);

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
