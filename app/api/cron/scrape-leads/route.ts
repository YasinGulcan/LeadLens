import { NextRequest, NextResponse } from "next/server";
import { runScrapeLeads } from "@/lib/pipeline";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth";

/**
 * Gün 8-9: status='new' lead'lerin website_url'ini Firecrawl ile tarar.
 * Elle/admin tetikleme içindir (?accountId=) — otomatik akış için
 * /api/cron/run-pipeline kullanılır.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorizedCronResponse();

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId zorunlu." }, { status: 400 });

  return NextResponse.json(await runScrapeLeads(accountId));
}
