import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";

/** Lead detay sayfasındaki "Panoya Kopyala" — e-posta gönderilmiyor, sadece aksiyon loglanıyor. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: lead } = await supabase.from("leads").select("account_id, name, email").eq("id", id).single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  await logActivity(session.accountId, session.email, "Taslak yanıtı kopyaladı", lead.name ?? lead.email ?? id);
  return NextResponse.json({ ok: true });
}
