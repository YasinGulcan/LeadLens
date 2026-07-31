import { NextRequest, NextResponse } from "next/server";
import { runNotifySales } from "@/lib/pipeline";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth";

/**
 * Gün 12: status='analyzed' lead'ler için aynı Gmail hesabına analiz raporu gönderir.
 * Elle/admin tetikleme içindir — otomatik akış için /api/cron/run-pipeline kullanılır.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorizedCronResponse();
  return NextResponse.json(await runNotifySales());
}
