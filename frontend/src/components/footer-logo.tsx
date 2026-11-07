"use client";

import Image from "next/image";

export function FooterLogo() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Наверх"
      className="block cursor-pointer"
    >
      <Image
        src="/logo.png"
        alt="TOPOVIK"
        width={180}
        height={36}
        className="h-8 w-auto"
      />
    </button>
  );
}
