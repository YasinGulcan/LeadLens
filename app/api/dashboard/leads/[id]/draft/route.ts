import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { getAccountById } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { generateDraftReply } from "@/lib/claude";

/** Lead detay sayfasındaki "Taslak Oluştur" — istendiğinde (otomatik değil) bir e-posta taslağı üretir, hiçbir şey kaydetmez. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: lead } = await supabase
    .from("leads")
    .select("account_id, name, message, site_finding, recommended_product, sales_note, sector")
    .eq("id", id)
    .single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const account = await getAccountById(session.accountId);
  if (!account) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

  try {
    const draft = await generateDraftReply({
      businessName: account.businessName,
      leadName: lead.name,
      leadMessage: lead.message,
      siteFinding: lead.site_finding,
      recommendedProduct: lead.recommended_product,
      salesNote: lead.sales_note,
      sector: lead.sector,
    });
    return NextResponse.json({ ok: true, subject: draft.subject, bodyHtml: draft.body_html });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
