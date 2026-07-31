import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendLeadNotification } from "@/lib/resend";

const BATCH_SIZE = 5;

/**
 * Gün 12: status='analyzed' lead'ler için satış ekibine e-posta bildirimi
 * gönderir (Resend). Başarılı gönderimde status='sent_to_sales'e geçer.
 */
export async function GET() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, phone, website_url, recommended_product, match_score, reasoning, priority")
    .eq("status", "analyzed")
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const lead of leads ?? []) {
    try {
      await sendLeadNotification({
        name: lead.name,
        phone: lead.phone,
        websiteUrl: lead.website_url,
        recommendedProduct: lead.recommended_product,
        matchScore: lead.match_score,
        reasoning: lead.reasoning,
        priority: lead.priority,
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

  return NextResponse.json({ found: leads?.length ?? 0, sent, failed });
}
