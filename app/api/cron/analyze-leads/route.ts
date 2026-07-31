import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { matchProductChunks } from "@/lib/match";
import { analyzeLead } from "@/lib/claude";

const BATCH_SIZE = 5;
const MATCH_COUNT = 5;

/**
 * Gün 10-11: status='scraping' (site taranmış) lead'ler için RAG eşleştirme
 * + Claude analizi yapar. site_summary embed edilip pgvector ile en yakın
 * ürün chunk'ları bulunur, Claude bu bağlamla yapılandırılmış rapor üretir.
 */
export async function GET() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, site_summary, message")
    .eq("status", "scraping")
    .not("site_summary", "is", null)
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  return NextResponse.json({ found: leads?.length ?? 0, analyzed, failed });
}
