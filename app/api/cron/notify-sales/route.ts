import { NextRequest, NextResponse } from "next/server";
import { runNotifySales } from "@/lib/pipeline";
import { loadGmailAccount } from "@/lib/accounts";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth";

/**
 * Gün 12: status='analyzed' lead'ler için hesabın bağlı Gmail'ine analiz
 * raporu gönderir. Elle/admin tetikleme içindir (?accountId=) — otomatik
 * akış için /api/cron/run-pipeline kullanılır.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorizedCronResponse();

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId zorunlu." }, { status: 400 });

  const account = await loadGmailAccount(accountId);
  if (!account) return NextResponse.json({ error: "Hesap bulunamadı ya da Gmail bağlı değil." }, { status: 404 });

  return NextResponse.json(await runNotifySales(account));
}
