import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchUnprocessedLeadEmails, markEmailProcessed } from "@/lib/gmail";

/**
 * Gün 5-7: Vercel Cron Job tarafından periyodik tetiklenecek.
 * Gmail'de "Yeni Lead Formu" konulu, henüz işlenmemiş mailleri bulur,
 * ayrıştırır, doğrular ve Supabase'e yazar. website_url eksikse
 * status='error' ile kaydedilip mail yine de işlenmiş sayılır (tekrar
 * denenmez) — elle inceleme PROJECT_PLAN.md'deki risk çözümüne uygun.
 */
export async function GET() {
  const emails = await fetchUnprocessedLeadEmails();

  let created = 0;
  let errors = 0;

  for (const email of emails) {
    const status = email.websiteUrl ? "new" : "error";

    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        name: email.name,
        phone: email.phone,
        website_url: email.websiteUrl,
        message: email.message,
        status,
        error_message: email.websiteUrl ? null : "website_url alanı ayrıştırılamadı",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`Lead yazılamadı (gmail id ${email.gmailMessageId}):`, insertError.message);
      errors++;
      continue;
    }

    await supabase.from("lead_status_history").insert({
      lead_id: lead.id,
      status,
      detail: status === "error" ? "Gmail ayrıştırma: website_url eksik" : "Gmail'den alındı",
    });

    await markEmailProcessed(email.gmailMessageId);

    if (status === "new") created++;
    else errors++;
  }

  return NextResponse.json({ found: emails.length, created, errors });
}
