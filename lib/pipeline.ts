import { supabase } from "./supabase";
import { fetchUnprocessedLeadEmails, markEmailProcessed, sendAnalysisNotificationEmail } from "./gmail";
import { sendLeadNotification } from "./resend";
import { scrapeMarkdown } from "./firecrawl";
import { stripBoilerplate, safeTruncate } from "./clean";
import { matchProductChunks } from "./match";
import { analyzeLead } from "./claude";
import { checkSearchRanking, checkAiVisibility, generateSearchKeyword } from "./visibility";
import { rankTier } from "./rank-tier";

// PROJECT_PLAN.md riskler tablosu: "Lead hacmi aniden artarsa" → her adım
// tek çalıştırmada sınırlı sayıda lead işler, kalanlar bir sonraki çalıştırmada işlenir.
const BATCH_SIZE = 5;
const MAX_SUMMARY_LENGTH = 6000;
const MATCH_COUNT = 5;
const DUPLICATE_WINDOW_HOURS = 24;

async function scrapeWithRetry(url: string): Promise<string> {
  try {
    return await scrapeMarkdown(url);
  } catch {
    return await scrapeMarkdown(url); // tek yeniden deneme — timeout/geçici hata için
  }
}

/**
 * Bir lead'i işlemeye başlamadan önce atomik olarak "kilitler" — durumu
 * yalnızca hâlâ beklenen (fromStatus) durumdaysa toStatus'e çevirir.
 * Gerçek zamanlı tetikleme (form-submit → after()) sayesinde artık aynı
 * lead için birden fazla pipeline çalıştırması eşzamanlı olabiliyor; bu
 * kilit olmadan ikisi de aynı lead'i tarar/analiz eder/bildirir — para
 * boşa gider ve son yazan rastgele kazanır. false dönerse başka bir
 * çalıştırma bu lead'i zaten almış demektir, atlanmalı.
 */
export async function claimLead(id: string, fromStatus: string, toStatus: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("leads")
    .update({ status: toStatus })
    .eq("id", id)
    .eq("status", fromStatus)
    .select("id");
  if (error) throw new Error(`Claim güncelleme hatası: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Aynı website veya telefonla yakın zamanda (24 saat içinde) zaten bir lead
 * işlenmişse onu döner — böylece aynı kişi formu birden fazla kez doldurursa
 * (kazayla çift tıklama, sabırsızlıkla tekrar gönderme vb.) pahalı adımlar
 * (Firecrawl/OpenAI/Claude) tekrar tetiklenmez, satış ekibi de aynı lead için
 * art arda mail almaz.
 */
export async function findRecentDuplicateLead(
  websiteUrl: string | null,
  phone: string | null
): Promise<{ id: string; status: string } | null> {
  if (!websiteUrl && !phone) return null;

  const since = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("leads").select("id, status, website_url, phone").gte("created_at", since);

  const match = (data ?? []).find(
    (l) => (websiteUrl && l.website_url === websiteUrl) || (phone && l.phone === phone)
  );
  return match ? { id: match.id, status: match.status } : null;
}

/** Gün 5-7: Gmail'deki işlenmemiş form maillerini okur, ayrıştırır, Supabase'e yazar. */
export async function runFetchLeads() {
  const emails = await fetchUnprocessedLeadEmails();

  let created = 0;
  let errors = 0;
  let duplicates = 0;

  for (const email of emails) {
    const duplicate = await findRecentDuplicateLead(email.websiteUrl, email.phone);
    if (duplicate) {
      await supabase.from("lead_status_history").insert({
        lead_id: duplicate.id,
        status: duplicate.status,
        detail: `Aynı website/telefon için ${DUPLICATE_WINDOW_HOURS} saat içinde tekrar form gönderimi geldi — tarama/analiz/bildirim tekrar tetiklenmedi.`,
      });
      await markEmailProcessed(email.gmailMessageId);
      duplicates++;
      continue;
    }

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

  return { found: emails.length, created, errors, duplicates };
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
  let skipped = 0;

  for (const lead of leads ?? []) {
    const websiteUrl = lead.website_url!;

    if (!(await claimLead(lead.id, "new", "scraping"))) {
      skipped++; // başka bir eşzamanlı çalıştırma bu lead'i zaten aldı
      continue;
    }

    try {
      const markdown = await scrapeWithRetry(websiteUrl);
      const summary = safeTruncate(stripBoilerplate(markdown), MAX_SUMMARY_LENGTH);

      const { error: updateError } = await supabase.from("leads").update({ site_summary: summary }).eq("id", lead.id);
      if (updateError) throw new Error(`Supabase güncelleme hatası: ${updateError.message}`);

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

  return { found: leads?.length ?? 0, scraped, failed, skipped };
}

/** Gün 10-11: status='scraping' lead'ler için RAG eşleştirme + Claude analizi. */
export async function runAnalyzeLeads() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, site_summary, message, website_url")
    .eq("status", "scraping")
    .not("site_summary", "is", null)
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);

  let analyzed = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of leads ?? []) {
    if (!(await claimLead(lead.id, "scraping", "analyzing"))) {
      skipped++; // başka bir eşzamanlı çalıştırma bu lead'i zaten aldı
      continue;
    }

    try {
      const siteSummary = lead.site_summary!;
      const hasRealMessage = (lead.message ?? "").trim().length > 15;
      // Site içeriği + (varsa) mesaj ayrı ayrı sorgulanıp birleştirilir — sadece
      // site içeriğine bakmak, mesajda belirtilen ama sitenin kendi içeriğinde
      // hiç geçmeyen bir ihtiyacı (örn. "SEO istiyoruz" diyen ama sitesinde hiç
      // "SEO" geçmeyen bir otel) anlamsal olarak kaçırıyordu.
      const retrievalQueries = hasRealMessage ? [siteSummary, lead.message!] : [siteSummary];

      // Görünürlük kontrolü — best-effort, ürün eşleştirmeyle paralel çalışır:
      // önce SADECE site içeriğinden (mesajdan değil, bkz. generateSearchKeyword
      // yorumu) bir arama ifadesi üretilir, sonra o ifadeyle gerçek arama +
      // AI görünürlüğü kontrol edilir. Başarısız olursa (rate limit vb.) null
      // döner, ana öneri akışını etkilemez.
      const checkVisibility = async (): Promise<{
        keyword: string;
        ranking: Awaited<ReturnType<typeof checkSearchRanking>>;
        aiVisibility: Awaited<ReturnType<typeof checkAiVisibility>>;
      } | null> => {
        if (!lead.website_url) return null;
        try {
          const keyword = await generateSearchKeyword(siteSummary);
          const [ranking, aiVisibility] = await Promise.all([
            checkSearchRanking(keyword, lead.website_url),
            checkAiVisibility(keyword, lead.website_url),
          ]);
          return { keyword, ranking, aiVisibility };
        } catch (visibilityErr) {
          const visibilityMessage = visibilityErr instanceof Error ? visibilityErr.message : String(visibilityErr);
          console.error(`Görünürlük kontrolü başarısız (lead ${lead.id}):`, visibilityMessage);
          return null;
        }
      };

      const [matches, visibility] = await Promise.all([
        matchProductChunks(retrievalQueries, MATCH_COUNT),
        checkVisibility(),
      ]);

      if (matches.length === 0) throw new Error("Eşleşen ürün chunk'ı bulunamadı.");

      const analysis = await analyzeLead({
        siteSummary,
        message: lead.message,
        matchedChunks: matches,
        visibility: visibility
          ? {
              keyword: visibility.keyword,
              rankTier: rankTier(visibility.ranking.position),
              aiMentioned: visibility.aiVisibility.mentioned,
            }
          : null,
      });

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          sector: analysis.sektor,
          site_finding: analysis.site_bulgusu,
          recommended_product: analysis.onerilen_urun,
          match_score: analysis.eslesme_skoru,
          reasoning: analysis.gerekce,
          priority: analysis.oncelik,
          sales_note: analysis.satis_notu,
          clarifying_question: analysis.netlestirici_soru,
          search_keyword: visibility?.keyword ?? null,
          search_rank_position: visibility?.ranking.position ?? null,
          search_checked_count: visibility?.ranking.checkedCount ?? null,
          ai_visibility_mentioned: visibility?.aiVisibility.mentioned ?? null,
          ai_visibility_note: visibility?.aiVisibility.note ?? null,
          status: "analyzed",
        })
        .eq("id", lead.id);
      if (updateError) throw new Error(`Supabase güncelleme hatası: ${updateError.message}`);

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

  return { found: leads?.length ?? 0, analyzed, failed, skipped };
}

/** Gün 12: status='analyzed' lead'ler için aynı Gmail hesabına analiz raporu gönderir. */
export async function runNotifySales() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, name, phone, website_url, recommended_product, match_score, reasoning, priority, sales_note, site_finding, sector, clarifying_question, search_keyword, search_rank_position, search_checked_count, ai_visibility_mentioned, ai_visibility_note"
    )
    .eq("status", "analyzed")
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of leads ?? []) {
    if (!(await claimLead(lead.id, "analyzed", "notifying"))) {
      skipped++; // başka bir eşzamanlı çalıştırma bu lead'i zaten aldı
      continue;
    }

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
        siteFinding: lead.site_finding,
        sector: lead.sector,
        clarifyingQuestion: lead.clarifying_question,
        searchKeyword: lead.search_keyword,
        searchRankPosition: lead.search_rank_position,
        aiVisibilityMentioned: lead.ai_visibility_mentioned,
        aiVisibilityNote: lead.ai_visibility_note,
      });

      // İkinci kanal (Resend) — kullanıcı isteğiyle geri eklendi, ana akışı bloklamasın:
      // Gmail (birincil, güvenilir) gönderildiği sürece lead başarılı sayılır.
      try {
        await sendLeadNotification({
          name: lead.name,
          phone: lead.phone,
          websiteUrl: lead.website_url,
          sector: lead.sector,
          siteFinding: lead.site_finding,
          recommendedProduct: lead.recommended_product,
          matchScore: lead.match_score,
          reasoning: lead.reasoning,
          priority: lead.priority,
          salesNote: lead.sales_note,
          clarifyingQuestion: lead.clarifying_question,
          searchKeyword: lead.search_keyword,
          searchRankPosition: lead.search_rank_position,
          aiVisibilityMentioned: lead.ai_visibility_mentioned,
        });
      } catch (resendErr) {
        const resendMessage = resendErr instanceof Error ? resendErr.message : String(resendErr);
        console.error(`Resend bildirimi başarısız (lead ${lead.id}):`, resendMessage);
      }

      const { error: updateError } = await supabase
        .from("leads")
        .update({ status: "sent_to_sales" })
        .eq("id", lead.id);
      if (updateError) throw new Error(`Supabase güncelleme hatası: ${updateError.message}`);

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

  return { found: leads?.length ?? 0, sent, failed, skipped };
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
