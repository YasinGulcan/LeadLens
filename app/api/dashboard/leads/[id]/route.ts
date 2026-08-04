import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

/**
 * `/dashboard`'daki lead tablosunda "Sil" butonu. `lead_status_history`
 * satırları `lead_id` üzerindeki `on delete cascade` (bkz.
 * supabase/migrations/0001_init.sql) ile otomatik silinir.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: lead } = await supabase.from("leads").select("account_id").eq("id", id).single();
  if (!lead || lead.account_id !== accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
