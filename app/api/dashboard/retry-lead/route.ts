import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

// 'analyzing'/'notifying' claim edilip fonksiyon zaman aşımına uğrarsa
// (Vercel timeout, crash vb.) sonsuza kadar takılı kalabilir — bunlar da
// "error" gibi elle kurtarılabilir sayılır.
const RECOVERABLE_STATUSES = ["error", "analyzing", "notifying"];

/**
 * `/dashboard`'daki manuel "yeniden dene" — status='error' ya da takılı
 * kalmış ('analyzing'/'notifying') bir lead'i, hangi aşamada olduğuna göre
 * doğru önceki duruma geri alır ki bir sonraki pipeline çalıştırmasında o
 * adımdan devam etsin. Lead'in gerçekten bu oturumun hesabına ait olduğu
 * doğrulanır — artık her şeyi görebilen tek bir admin yok.
 */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = await req.json().catch(() => ({}));
  if (typeof leadId !== "string") {
    return NextResponse.json({ error: "leadId gerekli." }, { status: 400 });
  }

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id, account_id, status, website_url, site_summary, recommended_product")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return NextResponse.json({ error: "Lead bulunamadı." }, { status: 404 });
  }
  if (lead.account_id !== accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }
  if (!RECOVERABLE_STATUSES.includes(lead.status)) {
    return NextResponse.json(
      { error: "Sadece 'error' ya da takılı kalmış (analyzing/notifying) lead'ler yeniden denenebilir." },
      { status: 400 }
    );
  }

  let retryStatus: string | null;
  if (lead.status === "analyzing") {
    retryStatus = "scraping"; // claim edilmiş ama analiz bitmemiş — taramaya geri dön
  } else if (lead.status === "notifying") {
    retryStatus = "analyzed"; // claim edilmiş ama bildirim bitmemiş — analiz sonucuna geri dön
  } else {
    retryStatus = lead.recommended_product
      ? "analyzed" // bildirim gönderimi başarısız olmuş
      : lead.site_summary
        ? "scraping" // analiz başarısız olmuş
        : lead.website_url
          ? "new" // site taraması başarısız olmuş
          : null; // website_url hiç ayrıştırılamamış — otomatik düzeltilemez
  }

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
    detail: "Panelden manuel olarak yeniden denemeye alındı",
  });

  return NextResponse.json({ ok: true, newStatus: retryStatus });
}
