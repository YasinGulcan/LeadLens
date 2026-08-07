import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { getAccountById } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { generateDraftReply, type DraftTone } from "@/lib/claude";

const DRAFT_TONES: readonly DraftTone[] = ["resmi", "samimi", "teknik"];

/** Lead detay sayfasındaki "Taslak Oluştur" — istendiğinde (otomatik değil) bir e-posta taslağı üretir, hiçbir şey kaydetmez. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const toneRaw = typeof body?.tone === "string" ? body.tone : "";
  const tone: DraftTone | undefined = DRAFT_TONES.includes(toneRaw as DraftTone) ? (toneRaw as DraftTone) : undefined;

  const { data: lead } = await supabase
    .from("leads")
    .select("account_id, name, message, site_finding, recommended_product, sales_note, sector, deep_analysis")
    .eq("id", id)
    .single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const account = await getAccountById(session.accountId);
  if (!account) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

  const matchedServices = (lead.deep_analysis as { matched_services?: { name: string; reason: string }[] } | null)?.matched_services;

  try {
    const draft = await generateDraftReply({
      businessName: account.businessName,
      leadName: lead.name,
      leadMessage: lead.message,
      siteFinding: lead.site_finding,
      recommendedProduct: lead.recommended_product,
      salesNote: lead.sales_note,
      sector: lead.sector,
      tone,
      matchedServices,
    });
    return NextResponse.json({ ok: true, subject: draft.subject, bodyHtml: draft.body_html });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
