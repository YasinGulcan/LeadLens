import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";

/**
 * `/dashboard/sources`'taki "Sil" butonu — sadece hesap sahibi silebilir
 * (ekip üyeleri veri silemez). `product_chunks` satırları `source_id`
 * üzerindeki `on delete cascade` (bkz. supabase/migrations/0002_product_sources.sql)
 * ile otomatik silinir.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi kaynak silebilir." }, { status: 403 });
  }

  const { id } = await params;

  const { data: source } = await supabase
    .from("product_sources")
    .select("account_id, label, url, file_name")
    .eq("id", id)
    .single();
  if (!source || source.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu kaynak size ait değil." }, { status: 403 });
  }

  const { error } = await supabase.from("product_sources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(session.accountId, session.email, "Ürün kaynağı sildi", source.label ?? source.url ?? source.file_name ?? id);
  return NextResponse.json({ ok: true });
}
