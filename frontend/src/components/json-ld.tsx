import type { JsonLd as JsonLdData } from "@/lib/json-ld";

/** Safe JSON-LD script tag for App Router pages. */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  const payload = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : data;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
      }}
    />
  );
}
