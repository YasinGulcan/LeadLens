import { NextRequest, NextResponse } from "next/server";
import { runAnalyzeLeads } from "@/lib/pipeline";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth";

/**
 * Gün 10-11: status='scraping' lead'ler için RAG eşleştirme + Claude analizi.
 * Elle/admin tetikleme içindir (?accountId=) — otomatik akış için
 * /api/cron/run-pipeline kullanılır.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorizedCronResponse();

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId zorunlu." }, { status: 400 });

  return NextResponse.json(await runAnalyzeLeads(accountId));
}
