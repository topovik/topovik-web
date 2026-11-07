import { NextResponse } from "next/server";
import { STRAPI_URL } from "@/lib/config";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
  }

  try {
    const res = await fetch(`${STRAPI_URL}/api/articles/${id}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { error: text.slice(0, 200) };
    }
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to increment views" }, { status: 502 });
  }
}
