import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeMarkdown } from "@/lib/firecrawl";
import { stripBoilerplate } from "@/lib/clean";

// PROJECT_PLAN.md riskler tablosu: "Lead hacmi aniden artarsa" → cron her
// çalıştığında sınırlı sayıda lead işler, kalanlar bir sonraki çalıştırmada işlenir.
const BATCH_SIZE = 5;
const MAX_SUMMARY_LENGTH = 6000;

async function scrapeWithRetry(url: string): Promise<string> {
  try {
    return await scrapeMarkdown(url);
  } catch {
    return await scrapeMarkdown(url); // tek yeniden deneme — timeout/geçici hata için
  }
}

/**
 * Gün 8-9: status='new' lead'lerin website_url'ini Firecrawl ile tarar,
 * özetini (boilerplate ayıklanmış markdown) leads.site_summary'e yazar.
 * Slide 7'deki akışa uygun olarak status 'scraping' olarak kalır — Gün 10-11'de
 * Claude analiziyle birlikte 'analyzed'e geçecek.
 */
export async function GET() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, website_url")
    .eq("status", "new")
    .not("website_url", "is", null)
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  return NextResponse.json({ found: leads?.length ?? 0, scraped, failed });
}
