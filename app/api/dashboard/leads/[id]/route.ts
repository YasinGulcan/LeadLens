import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";

/**
 * `/dashboard`'daki lead tablosunda "Sil" butonu — sadece hesap sahibi
 * silebilir (ekip üyeleri veri silemez). `lead_status_history` satırları
 * `lead_id` üzerindeki `on delete cascade` (bkz. supabase/migrations/0001_init.sql)
 * ile otomatik silinir.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi lead silebilir." }, { status: 403 });
  }

  const { id } = await params;

  const { data: lead } = await supabase.from("leads").select("account_id, name, phone").eq("id", id).single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(session.accountId, session.email, "Lead sildi", lead.name ?? lead.phone ?? id);
  return NextResponse.json({ ok: true });
}
