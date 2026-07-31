import { supabase } from "./supabase";
import { fetchUnprocessedLeadEmails, markEmailProcessed, sendAnalysisNotificationEmail } from "./gmail";
import { scrapeMarkdown } from "./firecrawl";
import { stripBoilerplate } from "./clean";
import { matchProductChunks } from "./match";
import { analyzeLead } from "./claude";

// PROJECT_PLAN.md riskler tablosu: "Lead hacmi aniden artarsa" → her adım
// tek çalıştırmada sınırlı sayıda lead işler, kalanlar bir sonraki çalıştırmada işlenir.
const BATCH_SIZE = 5;
const MAX_SUMMARY_LENGTH = 6000;
const MATCH_COUNT = 5;

async function scrapeWithRetry(url: string): Promise<string> {
  try {
    return await scrapeMarkdown(url);
  } catch {
    return await scrapeMarkdown(url); // tek yeniden deneme — timeout/geçici hata için
  }
}

/** Gün 5-7: Gmail'deki işlenmemiş form maillerini okur, ayrıştırır, Supabase'e yazar. */
export async function runFetchLeads() {
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
        consent_given_at: email.consentGivenAt,
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

  return { found: emails.length, created, errors };
}

/** Gün 8-9: status='new' lead'lerin website_url'ini Firecrawl ile tarar. */
export async function runScrapeLeads() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, website_url")
    .eq("status", "new")
    .not("website_url", "is", null)
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);

  let scraped = 0;
  let failed = 0;

  for (const lead of leads ?? []) {
    const websiteUrl = lead.website_url!;
    try {
      const markdown = await scrapeWithRetry(websiteUrl);
      const summary = stripBoilerplate(markdown).slice(0, MAX_SUMMARY_LENGTH);

      await supabase.from("leads").update({ site_summary: summary, status: "scraping" }).eq("id", lead.id);
      await supabase.from("lead_status_history").insert({
        lead_id: lead.id,
        status: "scraping",
        detail: `Site tarandı (${summary.length} karakter)`,
      });
      scraped++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("leads")
        .update({ status: "error", error_message: `Site taraması başarısız: ${message}` })
        .eq("id", lead.id);
      await supabase.from("lead_status_history").insert({
        lead_id: lead.id,
        status: "error",
        detail: `Site taraması 2 denemede de başarısız: ${message}`,
      });
      failed++;
    }
  }

  return { found: leads?.length ?? 0, scraped, failed };
}

/** Gün 10-11: status='scraping' lead'ler için RAG eşleştirme + Claude analizi. */
export async function runAnalyzeLeads() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, site_summary, message")
    .eq("status", "scraping")
    .not("site_summary", "is", null)
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);

  let analyzed = 0;
  let failed = 0;

  for (const lead of leads ?? []) {
    try {
      const matches = await matchProductChunks(lead.site_summary!, MATCH_COUNT);
      if (matches.length === 0) throw new Error("Eşleşen ürün chunk'ı bulunamadı.");

      const analysis = await analyzeLead({
        siteSummary: lead.site_summary!,
        message: lead.message,
        matchedChunks: matches,
      });

      await supabase
        .from("leads")
        .update({
          recommended_product: analysis.onerilen_urun,
          match_score: analysis.eslesme_skoru,
          reasoning: analysis.gerekce,
          priority: analysis.oncelik,
          sales_note: analysis.satis_notu,
          status: "analyzed",
        })
        .eq("id", lead.id);

      await supabase.from("lead_status_history").insert({
        lead_id: lead.id,
        status: "analyzed",
        detail: `Önerilen: ${analysis.onerilen_urun} (skor: ${analysis.eslesme_skoru.toFixed(2)}, öncelik: ${analysis.oncelik})`,
      });

      analyzed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("leads")
        .update({ status: "error", error_message: `Analiz başarısız: ${message}` })
        .eq("id", lead.id);
      await supabase.from("lead_status_history").insert({
        lead_id: lead.id,
        status: "error",
        detail: `Analiz başarısız: ${message}`,
      });
      failed++;
    }
  }

  return { found: leads?.length ?? 0, analyzed, failed };
}

/** Gün 12: status='analyzed' lead'ler için aynı Gmail hesabına analiz raporu gönderir. */
export async function runNotifySales() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, phone, website_url, recommended_product, match_score, reasoning, priority, sales_note")
    .eq("status", "analyzed")
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const lead of leads ?? []) {
    try {
      await sendAnalysisNotificationEmail({
        name: lead.name,
        phone: lead.phone,
        websiteUrl: lead.website_url,
        recommendedProduct: lead.recommended_product,
        matchScore: lead.match_score,
        reasoning: lead.reasoning,
        priority: lead.priority,
        salesNote: lead.sales_note,
      });

      await supabase.from("leads").update({ status: "sent_to_sales" }).eq("id", lead.id);
      await supabase.from("lead_status_history").insert({
        lead_id: lead.id,
        status: "sent_to_sales",
        detail: "Satış ekibine e-posta gönderildi",
      });
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("leads")
        .update({ status: "error", error_message: `Bildirim gönderilemedi: ${message}` })
        .eq("id", lead.id);
      await supabase.from("lead_status_history").insert({
        lead_id: lead.id,
        status: "error",
        detail: `Bildirim gönderilemedi: ${message}`,
      });
      failed++;
    }
  }

  return { found: leads?.length ?? 0, sent, failed };
}

/**
 * Gün 15: Vercel Hobby planı cron job'ları günde bir kez çalıştırabiliyor,
 * bu yüzden 4 adım burada tek bir sıralı çalıştırmada birleştiriliyor
 * (ayrı ayrı zamanlanırsa sıralama garantisi olmaz).
 */
export async function runFullPipeline() {
  const fetch = await runFetchLeads();
  const scrape = await runScrapeLeads();
  const analyze = await runAnalyzeLeads();
  const notify = await runNotifySales();
  return { fetch, scrape, analyze, notify };
}
