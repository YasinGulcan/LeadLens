import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint'leri deploy sonrası herkese açık URL'ler olacağı için
 * (Firecrawl/OpenAI/Anthropic çağrıları maliyetli), Vercel'in otomatik
 * gönderdiği "Authorization: Bearer $CRON_SECRET" başlığı doğrulanır.
 * Yerelde CRON_SECRET tanımlı değilse kontrol atlanır (kolay test için).
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export function unauthorizedCronResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
