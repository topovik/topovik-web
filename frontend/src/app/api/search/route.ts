import { NextResponse } from "next/server";
import { searchArticles } from "@/lib/strapi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ data: [], total: 0, query: "" });
  }

  try {
    const list = await searchArticles(q, 8);
    return NextResponse.json({
      data: list.data,
      total: list.meta.pagination.total,
      query: q,
    });
  } catch (err) {
    console.error("search failed", err);
    return NextResponse.json(
      { data: [], total: 0, query: q, error: "search_failed" },
      { status: 500 },
    );
  }
}
