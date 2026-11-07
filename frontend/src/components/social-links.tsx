import type { SocialId } from "@/lib/social";
import { SOCIAL_LINKS } from "@/lib/social";

function SocialIcon({ id }: { id: SocialId }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "currentColor",
    "aria-hidden": true as const,
  };

  switch (id) {
    case "vk":
      return (
        <svg {...common}>
          <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14c5.6 0 6.93-1.33 6.93-6.93V8.93C22 3.33 20.67 2 15.07 2zm3.08 14.27h-1.46c-.55 0-.72-.44-1.71-1.45-.86-.84-1.24-.95-1.45-.95-.3 0-.38.08-.38.49v1.33c0 .35-.11.56-1.04.56-1.54 0-3.25-.93-4.45-2.66-1.81-2.5-2.3-4.38-2.3-4.77 0-.21.08-.4.49-.4h1.46c.37 0 .51.17.65.56.71 2.05 1.89 3.85 2.38 3.85.18 0 .27-.09.27-.55v-2.13c-.06-.98-.58-1.07-.58-1.42 0-.17.14-.34.37-.34h2.3c.31 0 .42.17.42.53v2.87c0 .31.14.42.23.42.18 0 .33-.11.66-.44 1.02-1.14 1.75-2.91 1.75-2.91.1-.21.26-.4.64-.4h1.46c.44 0 .53.23.44.53-.18.84-1.92 3.3-1.92 3.3-.15.24-.21.35 0 .62.15.21.66.64 1 1.03.62.7 1.1 1.29 1.23 1.7.12.4-.07.61-.46.61z" />
        </svg>
      );
    case "twitter":
      return (
        <svg {...common}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M23.5 7.2a3 3 0 0 0-2.1-2.1C19.5 4.6 12 4.6 12 4.6s-7.5 0-9.4.5A3 3 0 0 0 .5 7.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-4.8zM9.75 15.5v-7l6.2 3.5-6.2 3.5z" />
        </svg>
      );
  }
}

export function SocialLinks({
  className = "",
}: {
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {SOCIAL_LINKS.map((item) => (
        <li key={item.id}>
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            title={item.label}
            className="inline-flex size-10 items-center justify-center border-2 border-ink bg-paper text-ink shadow-[3px_3px_0_0_var(--ink)] transition-[background-color,color,box-shadow] duration-200 hover:bg-accent hover:text-white hover:shadow-[3px_3px_0_0_var(--accent-ink)]"
          >
            <SocialIcon id={item.id} />
          </a>
        </li>
      ))}
    </ul>
  );
}
