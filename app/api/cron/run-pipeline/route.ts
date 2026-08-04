import { NextRequest, NextResponse } from "next/server";
import { runFullPipelineForAllAccounts } from "@/lib/pipeline";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth";

export const maxDuration = 60; // Firecrawl + OpenAI + Claude çağrıları toplamda birkaç dakikayı bulabilir

/**
 * Vercel Cron Job tarafından çağrılan tek giriş noktası. Vercel Hobby planı
 * cron'ları günde bir kez çalıştırabiliyor, bu yüzden 4 adım ayrı ayrı
 * zamanlanmak yerine burada doğru sırayla zincirleniyor (bkz. vercel.json).
 * Çoklu hesap desteğiyle birlikte artık `status='connected'` olan her hesap
 * için sırayla çalışır (bkz. lib/pipeline.ts#runFullPipelineForAllAccounts).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorizedCronResponse();
  return NextResponse.json(await runFullPipelineForAllAccounts());
}
