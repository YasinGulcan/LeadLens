import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { matchProductChunks } from "@/lib/match";
import { generateDeepAnalysis } from "@/lib/claude";

/**
 * Lead detay sayfasındaki "Derinlemesine Analiz Oluştur" — istendiğinde
 * (otomatik pipeline'ın parçası değil, maliyet nedeniyle) tetiklenir.
 * Ürün eşleştirmesi (embedding+pgvector, LLM'siz — bkz. lib/match.ts) bu
 * çağrı için ücretsiz tekrar hesaplanır, sonuç kalıcı olarak leads.deep_analysis'e yazılır.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: lead } = await supabase
    .from("leads")
    .select("account_id, message, site_summary, recommended_product, sector, site_finding, sales_note")
    .eq("id", id)
    .single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  try {
    const queryTexts = [lead.site_summary, lead.message].filter((t): t is string => !!t && t.trim().length > 0);
    const matchedChunks = queryTexts.length > 0 ? await matchProductChunks(session.accountId, queryTexts) : [];

    const deepAnalysis = await generateDeepAnalysis({
      siteSummary: lead.site_summary,
      message: lead.message,
      matchedChunks,
      recommendedProduct: lead.recommended_product,
      sector: lead.sector,
      siteFinding: lead.site_finding,
      salesNote: lead.sales_note,
    });

    const { error } = await supabase.from("leads").update({ deep_analysis: deepAnalysis }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, deepAnalysis });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
