import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { loadGmailAccount } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { sendDraftReplyEmail } from "@/lib/gmail";
import { logActivity } from "@/lib/activity-log";

/** Lead detay sayfasındaki "Otomatik Gönder" — düzenlenmiş taslağı, bağlı Gmail hesabından lead'in kendi adresine gönderir. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const bodyHtml = typeof body?.bodyHtml === "string" ? body.bodyHtml : "";

  if (!subject || !bodyHtml.trim()) {
    return NextResponse.json({ error: "Konu ve gövde boş olamaz." }, { status: 400 });
  }

  const { data: lead } = await supabase.from("leads").select("account_id, name, email").eq("id", id).single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }
  if (!lead.email) {
    return NextResponse.json({ error: "Bu lead için e-posta adresi kayıtlı değil." }, { status: 400 });
  }

  const gmailAccount = await loadGmailAccount(session.accountId);
  if (!gmailAccount) return NextResponse.json({ error: "Gmail bağlantısı bulunamadı." }, { status: 400 });

  try {
    await sendDraftReplyEmail(gmailAccount, lead.email, subject, bodyHtml);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  await logActivity(session.accountId, session.email, "Taslak yanıt gönderdi", `${lead.name ?? lead.email} → ${lead.email}`);
  return NextResponse.json({ ok: true });
}
