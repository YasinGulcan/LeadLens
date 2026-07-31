import { NextRequest, NextResponse } from "next/server";
import { runFetchLeads } from "@/lib/pipeline";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth";

/**
 * Gün 5-7: Gmail'de "Yeni Lead Formu" konulu, henüz işlenmemiş mailleri bulur,
 * ayrıştırır, doğrular ve Supabase'e yazar. website_url eksikse status='error'
 * ile kaydedilip mail yine de işlenmiş sayılır (tekrar denenmez).
 *
 * Vercel Cron Job'da doğrudan bu değil, sıralamayı garanti eden
 * /api/cron/run-pipeline kullanılıyor — bu route elle/admin tetikleme içindir.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorizedCronResponse();
  return NextResponse.json(await runFetchLeads());
}
