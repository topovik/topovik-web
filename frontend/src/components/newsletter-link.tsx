"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function NewsletterLink({
  className,
  children = "Быть в курсе",
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href="/#newsletter"
      transitionTypes={["none"]}
      scroll={false}
      className={className}
      onClick={(e) => {
        if (window.location.pathname !== "/") return;
        e.preventDefault();
        document
          .getElementById("newsletter")
          ?.scrollIntoView({ behavior: "smooth" });
        history.replaceState(null, "", "/#newsletter");
      }}
    >
      {children}
    </Link>
  );
}
