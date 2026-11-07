import { NextResponse } from "next/server";
import { STRAPI_URL } from "@/lib/config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  let body: { email?: unknown; website?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; website?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Honeypot — bots fill hidden fields; humans leave it empty.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true, already: false });
  }

  const email = normalizeEmail(body.email);
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  try {
    const res = await fetch(`${STRAPI_URL}/api/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          email,
          confirmed: true,
        },
      }),
      cache: "no-store",
    });

    if (res.ok) {
      return NextResponse.json({ ok: true, already: false });
    }

    const text = await res.text();
    // Unique constraint / already exists → treat as success for UX.
    if (
      res.status === 400 &&
      /unique|already|taken|email/i.test(text)
    ) {
      return NextResponse.json({ ok: true, already: true });
    }

    console.error(`subscribe Strapi ${res.status}: ${text.slice(0, 300)}`);
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
  } catch (err) {
    console.error("subscribe failed", err);
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
  }
}
