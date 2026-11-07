"use client";

import { useLayoutEffect, useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "ok" | "already" | "error";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  useLayoutEffect(() => {
    if (window.location.hash !== "#newsletter") return;
    document.getElementById("newsletter")?.scrollIntoView();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;

    const value = email.trim();
    if (!value) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          website: String(form.get("website") || ""),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        already?: boolean;
      } | null;

      if (!res.ok || !data?.ok) {
        setStatus("error");
        return;
      }

      setStatus(data.already ? "already" : "ok");
      if (!data.already) setEmail("");
    } catch {
      setStatus("error");
    }
  }

  const done = status === "ok" || status === "already";

  return (
    <section id="newsletter" className="border-y-2 border-ink bg-sky">
      <div className="mx-auto flex max-w-site flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16 lg:py-14">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Один раз в неделю
          </p>
          <h2 className="mt-3 font-display text-4xl uppercase leading-[0.92] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Самое важное — прямо в почту
          </h2>
        </div>

        {done ? (
          <p
            className="w-full max-w-md border-b-2 border-ink pb-2 text-sm uppercase tracking-[0.12em] text-ink"
            role="status"
          >
            {status === "already"
              ? "Этот email уже в подписке"
              : "Готово — вы в списке"}
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            className="flex w-full max-w-md items-end gap-3 border-b-2 border-ink pb-2"
            aria-label="Подписка"
            noValidate
          >
            <label className="sr-only" htmlFor="newsletter-email">
              Email
            </label>
            {/* Honeypot */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="pointer-events-none absolute h-0 w-0 opacity-0"
            />
            <input
              id="newsletter-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="EMAIL@EXAMPLE.RU"
              disabled={status === "loading"}
              className="min-w-0 flex-1 bg-transparent text-sm uppercase tracking-[0.12em] text-ink outline-none placeholder:text-ink/35 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:text-accent disabled:opacity-60"
            >
              {status === "loading" ? "Секунду…" : "Подписаться →"}
            </button>
          </form>
        )}
      </div>

      {status === "error" ? (
        <p
          className="mx-auto max-w-site px-4 pb-6 text-[11px] uppercase tracking-[0.14em] text-accent sm:px-6"
          role="alert"
        >
          Проверьте email и попробуйте ещё раз
        </p>
      ) : null}
    </section>
  );
}
