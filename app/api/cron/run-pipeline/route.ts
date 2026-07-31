import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline } from "@/lib/pipeline";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth";

export const maxDuration = 60; // Firecrawl + OpenAI + Claude çağrıları toplamda birkaç dakikayı bulabilir

/**
 * Gün 15: Vercel Cron Job tarafından çağrılan tek giriş noktası. Vercel Hobby
 * planı cron'ları günde bir kez çalıştırabiliyor, bu yüzden 4 adım ayrı ayrı
 * zamanlanmak yerine burada doğru sırayla zincirleniyor (bkz. vercel.json).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorizedCronResponse();
  return NextResponse.json(await runFullPipeline());
}
