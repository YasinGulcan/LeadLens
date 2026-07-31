import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Admin panelinden manuel "yeniden dene" — status='error' bir lead'i, hangi
 * aşamada takıldığına göre (elindeki veriye bakarak) doğru önceki duruma
 * geri alır ki bir sonraki pipeline çalıştırmasında o adımdan devam etsin.
 */
export async function POST(req: NextRequest) {
  const { leadId } = await req.json().catch(() => ({}));
  if (typeof leadId !== "string") {
    return NextResponse.json({ error: "leadId gerekli." }, { status: 400 });
  }

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id, status, website_url, site_summary, recommended_product")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return NextResponse.json({ error: "Lead bulunamadı." }, { status: 404 });
  }
  if (lead.status !== "error") {
    return NextResponse.json({ error: "Sadece 'error' durumundaki lead'ler yeniden denenebilir." }, { status: 400 });
  }

  const retryStatus = lead.recommended_product
    ? "analyzed" // bildirim gönderimi başarısız olmuş
    : lead.site_summary
      ? "scraping" // analiz başarısız olmuş
      : lead.website_url
        ? "new" // site taraması başarısız olmuş
        : null; // website_url hiç ayrıştırılamamış — otomatik düzeltilemez

  if (!retryStatus) {
    return NextResponse.json(
      { error: "Bu lead'de website_url eksik, otomatik yeniden denenemez — manuel düzeltme gerekiyor." },
      { status: 400 }
    );
  }

  await supabase.from("leads").update({ status: retryStatus, error_message: null }).eq("id", leadId);
  await supabase.from("lead_status_history").insert({
    lead_id: leadId,
    status: retryStatus,
    detail: "Admin panelinden manuel olarak yeniden denemeye alındı",
  });

  return NextResponse.json({ ok: true, newStatus: retryStatus });
}
