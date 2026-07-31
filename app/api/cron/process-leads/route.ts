import { NextResponse } from "next/server";

// Vercel Cron Job tarafından periyodik tetiklenecek endpoint.
// Gün 8-9 ve Gün 10-11: scraping + RAG eşleştirme + LLM analiz adımları burada zincirlenecek.
export async function GET() {
  return NextResponse.json({ status: "ok", processed: 0 });
}
