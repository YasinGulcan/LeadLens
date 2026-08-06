import { NextRequest, NextResponse } from "next/server";
import { runFetchLeads } from "@/lib/pipeline";
import { loadGmailAccount } from "@/lib/accounts";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth";

/**
 * Gün 5-7: Gmail'de hesabın yapılandırdığı başlıklardan biriyle (`lead_email_subjects`),
 * henüz işlenmemiş mailleri bulur, ayrıştırır, doğrular ve Supabase'e yazar.
 * website_url eksikse status='error' ile kaydedilip mail yine de işlenmiş
 * sayılır (tekrar denenmez).
 *
 * Vercel Cron Job'da doğrudan bu değil, tüm hesapları sırasıyla gezen
 * /api/cron/run-pipeline kullanılıyor — bu route tek bir hesabı elle/admin
 * tetiklemek içindir (?accountId=).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorizedCronResponse();

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId zorunlu." }, { status: 400 });

  const account = await loadGmailAccount(accountId);
  if (!account) return NextResponse.json({ error: "Hesap bulunamadı ya da Gmail bağlı değil." }, { status: 404 });

  return NextResponse.json(await runFetchLeads(account));
}
